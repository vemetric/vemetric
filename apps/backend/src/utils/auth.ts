import { getDripSequence, getStepDelay } from '@vemetric/email/email-drip-sequences';
import { emailDripQueue } from '@vemetric/queues/email-drip-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware, customSession, lastLoginMethod } from 'better-auth/plugins';
import { dbAuthAccount, dbOrganization, dbProject, prismaClient } from 'database';
import { DOMAIN } from '../consts';
import { sendEmailVerificationLink, sendPasswordResetLink } from './email';
import { logger } from './logger';
import { vemetric } from './vemetric-client';

export const TRUSTED_ORIGINS = ['https://app.' + DOMAIN, 'https://' + DOMAIN];

const emailVerificationTimestamps = new Map<string, number>();

export const auth = betterAuth({
  basePath: '/auth',
  trustedOrigins: TRUSTED_ORIGINS,
  database: prismaAdapter(prismaClient, {
    provider: 'postgresql',
  }),
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
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetLink(user.email, user.name, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      const lastSent = emailVerificationTimestamps.get(user.email);
      if (lastSent && Date.now() - lastSent < 1000 * 60 * 5) {
        // 5 minutes rate limit
        return;
      }

      await sendEmailVerificationLink(user.email, url);
      emailVerificationTimestamps.set(user.email, Date.now());
    },
  },
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path === '/verify-email' && ctx.context.newSession !== null) {
        const userId = ctx.context.newSession.user.id;
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
    }),
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const provider = await dbAuthAccount.findProviderByUserId(user.id);
          await vemetric.trackEvent('Signup', { userIdentifier: user.id, eventData: { provider } });
        },
      },
    },
  },
  plugins: [
    lastLoginMethod(),
    customSession(async ({ user, session }) => {
      const userOrganizations = await dbOrganization.getUserOrganizations(user.id, true);
      const userProjects = await dbProject.findByUserId(user.id);

      return {
        user,
        session,
        organizations: userOrganizations.map((userOrg) => userOrg.organization),
        projects: userProjects.map((userProject) => ({
          id: String(userProject.project.id),
          name: userProject.project.name,
          domain: userProject.project.domain,
          token: userProject.project.token,
          organizationId: userProject.project.organizationId,
        })),
      };
    }),
  ],
  advanced: {
    cookiePrefix: 'auth',
    crossSubDomainCookies: {
      enabled: true,
      domain: DOMAIN,
    },
  },
});
