import { dbAuthUser } from 'database';
import { loggedInProcedure, router } from '../utils/trpc';

export const accountRouter = router({
  settings: loggedInProcedure.query(async (opts) => {
    const { user } = opts.ctx;

    const linkedAccounts = await dbAuthUser.getLinkedAccounts(user.id);

    // Map accounts to a more usable format
    const accounts = linkedAccounts.map((account) => ({
      id: account.id,
      provider: account.providerId,
      accountId: account.accountId,
      createdAt: account.createdAt,
    }));

    // User has password if they have a credential account
    const hasPassword = accounts.some((account) => account.provider === 'credential');

    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        image: user.image,
      },
      accounts,
      hasPassword,
    };
  }),
});
