/**
 * Creates the initial administrator account of a self hosted instance.
 *
 *   VEMETRIC_ADMIN_PASSWORD='...' bun run apps/app/src/backend/scripts/bootstrap-admin.ts --email admin@example.com
 *
 * The installer runs this inside the app container so that a fresh instance is usable without
 * going through the signup screen, which would require a working SMTP server for the email
 * verification step. The account is created as already verified for that reason.
 *
 * Everything is written in a single transaction, so a failure halfway through leaves no
 * partial account behind. Re-running the script against an instance that already has a user
 * is refused: the first account is a bootstrap step, not an account management tool. The same
 * bootstrap lock the signup guard uses is claimed first, so the script and a concurrent signup
 * cannot both create a first account.
 *
 * The one exception is `--reset-password`, which sets a new password for an existing account.
 * Without a mail server there is no reset link, so this is the only way back into an instance
 * whose password was lost.
 */
import { OrganizationRole, dbBootstrapLock, dbOrganization, prismaClient } from 'database';
import { auth } from '../utils/auth';

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Primary keys for the auth tables, matching the 32 character ids better-auth generates. */
function generateId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

interface BootstrapArgs {
  email: string;
  password: string;
  name: string;
  organizationName: string;
  resetPassword: boolean;
}

/**
 * Reads `--key value` pairs. The password is deliberately not one of them: process arguments
 * are readable by every local user through `ps`, so it is passed through the environment.
 */
function parseArgs(argv: Array<string>): BootstrapArgs {
  const values = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) {
      continue;
    }
    const key = arg.slice(2);
    if (key === 'reset-password') {
      flags.add(key);
      continue;
    }
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }
    values.set(key, next);
    index += 1;
  }

  const email = values.get('email')?.trim() ?? '';
  const password = process.env.VEMETRIC_ADMIN_PASSWORD ?? '';

  if (!EMAIL_PATTERN.test(email)) {
    throw new Error('A valid --email is required.');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`VEMETRIC_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
  }

  return {
    email: email.toLowerCase(),
    password,
    name: values.get('name')?.trim() || email.split('@')[0],
    organizationName: values.get('organization')?.trim() || 'My Organization',
    resetPassword: flags.has('reset-password'),
  };
}

/**
 * Hashes through better-auth's own context so the stored hash always matches whatever
 * algorithm the running instance verifies logins with.
 */
async function hashPassword(password: string): Promise<string> {
  const context = await auth.$context;
  return context.password.hash(password);
}

/**
 * Replaces the credential password of an existing account. The account row is created rather
 * than updated when the user so far only signed in through an OAuth provider.
 *
 * A password reset is a lockout recovery, so it also ends every session of that user. Leaving
 * the sessions alive would mean the new password protects nothing: whoever is holding a stolen
 * session cookie, which is the usual reason for resetting the password in the first place,
 * would keep full access. The deletion runs in the same transaction as the credential write,
 * so the instance never ends up with a new password and old sessions still valid.
 * @param email Email address of the account to reset.
 * @param passwordHash Hash of the new password.
 */
async function resetPassword(email: string, passwordHash: string) {
  const user = await prismaClient.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    throw new Error(`No account found for ${email}.`);
  }

  const now = new Date();

  const revokedSessions = await prismaClient.$transaction(async (client) => {
    const credential = await client.account.findFirst({
      where: { userId: user.id, providerId: 'credential' },
      select: { id: true },
    });

    if (credential) {
      await client.account.update({
        where: { id: credential.id },
        data: { password: passwordHash, updatedAt: now },
      });
    } else {
      await client.account.create({
        data: {
          id: generateId(),
          accountId: user.id,
          providerId: 'credential',
          userId: user.id,
          password: passwordHash,
          createdAt: now,
          updatedAt: now,
        },
      });
    }

    const { count } = await client.session.deleteMany({ where: { userId: user.id } });
    return count;
  });

  process.stdout.write(`${JSON.stringify({ userId: user.id, email, passwordReset: true, revokedSessions })}\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const passwordHash = await hashPassword(args.password);

  if (args.resetPassword) {
    await resetPassword(args.email, passwordHash);
    return;
  }

  // The same compare-and-set the signup guard uses. Without it the script would only check
  // whether a user exists, which a concurrent first signup can invalidate between the check
  // and the insert, leaving an instance with two competing first accounts. Claiming the lock
  // makes script and signup mutually exclusive. A lock left behind by a crashed attempt is
  // reclaimed once it is stale, which is the same recovery path the signup guard follows.
  if (!(await dbBootstrapLock.tryAcquire()) && !(await dbBootstrapLock.reclaimIfStale())) {
    throw new Error('Another bootstrap attempt is currently in progress. Please retry in a moment.');
  }

  const userId = generateId();
  const now = new Date();

  const organizationId = await prismaClient.$transaction(async (client) => {
    const existingUser = await client.user.findFirst({ select: { id: true } });
    if (existingUser) {
      throw new Error('This instance already has an account. Bootstrapping is only possible on a fresh installation.');
    }

    await client.user.create({
      data: {
        id: userId,
        email: args.email,
        emailVerified: true,
        name: args.name,
        receiveEmailTips: false,
      },
    });

    await client.account.create({
      data: {
        id: generateId(),
        accountId: userId,
        providerId: 'credential',
        userId,
        password: passwordHash,
        createdAt: now,
        updatedAt: now,
      },
    });

    const organization = await dbOrganization.create({ name: args.organizationName, client });
    await dbOrganization.addUser({
      organizationId: organization.id,
      userId,
      role: OrganizationRole.ADMIN,
      client,
    });

    return organization.id;
  });

  process.stdout.write(`${JSON.stringify({ userId, email: args.email, organizationId })}\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
  });
