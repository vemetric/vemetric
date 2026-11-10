import { cimd } from '@better-auth/cimd';
import { fetchClientMetadataResource } from '@better-auth/cimd/node';
import { mcp } from '@better-auth/mcp';
import { getBaseDomain, getMcpUrl, getVemetricUrl } from '@vemetric/common/env';
import { getDripSequence, getStepDelay } from '@vemetric/email/email-drip-sequences';
import { emailDripQueue } from '@vemetric/queues/email-drip-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import type { BetterAuthOptions } from 'better-auth';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { customSession, emailOTP, lastLoginMethod } from 'better-auth/plugins';
import { dbOrganization, prismaClient } from 'database';
import { logger } from './backend-logger';
import { sendEmailVerificationLink, sendPasswordResetLink } from './email';
import { MCP_SCOPE, OAUTH_ACCESS_TOKEN_PREFIX, OAUTH_CONSENT_PAGE, OAUTH_REFRESH_TOKEN_PREFIX } from './oauth-consts';
import { emailVerificationRateLimiter } from './rate-limit';
import { vemetric } from './vemetric-client';

export const TRUSTED_ORIGINS = [getVemetricUrl('app'), getVemetricUrl()];

const isLocalhost = getBaseDomain().includes('localhost');

const options = {
  basePath: '/_api/auth',
  trustedOrigins: TRUSTED_ORIGINS,
  database: prismaAdapter(prismaClient, {
    provider: 'postgresql',
  }),
  user: {
    changeEmail: {
      enabled: true,
    },
    additionalFields: {
      receiveEmailTips: {
        type: 'boolean',
        input: false,
      },
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'github', 'email-password'],
      allowDifferentEmails: true,
    },
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string, //!expecting client id from env file
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string, //!expecting client secret from env file
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID as string, //!expecting client id from env file
      clientSecret: process.env.GITHUB_CLIENT_SECRET as string, //!expecting client secret from env file
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    requireEmailVerification: isLocalhost ? false : true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetLink(user.email, user.name, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (!emailVerificationRateLimiter.tryAcquire(user.email)) {
        return;
      }
      const isChangeEmailVerification = url.includes('changeEmail');
      const verificationCode = isChangeEmailVerification ? undefined : await createEmailVerificationOtp(user.email);
      if (!isChangeEmailVerification && !verificationCode) {
        logger.error({ email: user.email }, 'Failed to resolve verification OTP for combined verification email');
        throw new Error('Failed to resolve verification OTP');
      }
      await sendEmailVerificationLink(user.email, url, verificationCode);
    },
    async afterEmailVerification(user) {
      await queueNoProjectDrip(user.id);
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          if (!user.emailVerified) {
            return;
          }
          // OAuth users are often created as already verified and never hit afterEmailVerification.
          await queueNoProjectDrip(user.id);
        },
      },
    },
    account: {
      create: {
        after: async (account) => {
          await vemetric.trackEvent('Signup', {
            userIdentifier: account.userId,
            eventData: { provider: account.providerId === 'credential' ? 'email' : account.providerId },
          });
        },
      },
    },
  },
  onAPIError: {
    errorURL: getVemetricUrl('app'),
  },
  plugins: [
    lastLoginMethod(),
    // OAuth 2.1 authorization server for MCP clients (Claude, ChatGPT, Cursor, …).
    mcp({
      resource: getMcpUrl(),
      resources: [
        {
          identifier: getMcpUrl(),
          name: 'Vemetric MCP server',
          allowedScopes: [MCP_SCOPE, 'offline_access'],
        },
      ],
      scopes: [MCP_SCOPE, 'offline_access'],
      // Users authorize clients; there are no machine-to-machine clients (`client_credentials`).
      grantTypes: ['authorization_code', 'refresh_token'],
      loginPage: '/login',
      consentPage: OAUTH_CONSENT_PAGE,
      // Opaque access tokens only: `/mcp` looks them up by their hash, so disconnecting an app takes effect right away.
      disableJwtPlugin: true,
      prefix: { opaqueAccessToken: OAUTH_ACCESS_TOKEN_PREFIX, refreshToken: OAUTH_REFRESH_TOKEN_PREFIX },
      // MCP clients register themselves (public clients with PKCE). Clients that don't say whether they're native apps
      // (e.g. Cursor with a loopback redirect) would be rejected as web apps otherwise.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultApplicationType: 'infer',
    }),
    // Client ID Metadata Documents: newer MCP clients use an https URL to their metadata as client_id.
    cimd({ fetchClientMetadataResource, metadataProfile: 'mcp-2026-07-28' }),
    emailOTP({
      sendVerificationOnSignUp: false,
      sendVerificationOTP: async ({ email, type }) => {
        logger.error(
          { email, type },
          'Unexpected OTP-only verification email request. Use sendVerificationEmail flow.',
        );
        throw new Error('OTP-only verification email flow is disabled.');
      },
    }),
  ],
  advanced: {
    cookiePrefix: 'auth',
    crossSubDomainCookies: {
      enabled: true,
      domain: getBaseDomain().split(':')[0], // remove port if present
    },
  },
} satisfies BetterAuthOptions;

export const auth = betterAuth({
  ...options,
  plugins: [
    ...options.plugins,
    customSession(async ({ user, session }) => {
      const userOrganizations = await dbOrganization.getUserOrganizationsWithProjects(user.id);
      const allProjects = userOrganizations.flatMap(({ organization }) => {
        return organization.project.map((project) => ({
          id: String(project.id),
          name: project.name,
          domain: project.domain,
          token: project.token,
          organizationId: project.organizationId,
        }));
      });

      return {
        user,
        session,
        organizations: userOrganizations.map((userOrg) => ({
          ...userOrg.organization,
          role: userOrg.role,
        })),
        projects: allProjects,
      };
    }, options),
  ],
});

async function createEmailVerificationOtp(email: string): Promise<string | undefined> {
  try {
    return await auth.api.createVerificationOTP({
      body: {
        email,
        type: 'email-verification',
      },
    });
  } catch (err) {
    logger.warn({ err, email }, 'Failed to create verification OTP, attempting to reuse existing OTP');
  }

  try {
    const existing = await auth.api.getVerificationOTP({
      query: {
        email,
        type: 'email-verification',
      },
    });
    return existing.otp ?? undefined;
  } catch (err) {
    logger.error({ err, email }, 'Failed to read existing email verification OTP');
    return undefined;
  }
}

async function queueNoProjectDrip(userId: string) {
  try {
    const sequence = getDripSequence('NO_PROJECT');
    logger.info({ userId, queueName: emailDripQueue.name, sequence }, 'Queuing user for email drip sequence');
    await addToQueue(
      emailDripQueue,
      {
        userId,
        sequenceType: sequence.type,
        stepNumber: 0,
      },
      {
        delay: getStepDelay(sequence.type, 0),
      },
    );
  } catch (err) {
    logger.error(
      {
        err,
        userId,
      },
      'Failed to queue user for email drip sequence',
    );
  }
}
