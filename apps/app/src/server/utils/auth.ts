import { getBaseDomain, getVemetricUrl } from '@vemetric/common/env';
import { getDripSequence, getStepDelay } from '@vemetric/email/email-drip-sequences';
import { emailDripQueue } from '@vemetric/queues/email-drip-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createAuthMiddleware, customSession, lastLoginMethod } from 'better-auth/plugins';
import { dbOrganization, prismaClient } from 'database';
import { sendEmailVerificationLink, sendPasswordResetLink } from './email';
import { logger } from './logger';
import { vemetric } from './vemetric-client';

export const TRUSTED_ORIGINS = [getVemetricUrl('app'), getVemetricUrl()];

const emailVerificationTimestamps = new Map<string, number>();

export const auth = betterAuth({
  basePath: '/auth',
  trustedOrigins: TRUSTED_ORIGINS,
  database: prismaAdapter(prismaClient, {
    provider: 'postgresql',
  }),
  user: {
    changeEmail: {
      enabled: true,
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
    requireEmailVerification: getBaseDomain().includes('localhost') ? false : true,
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
    }),
  ],
  advanced: {
    cookiePrefix: 'auth',
    crossSubDomainCookies: {
      enabled: true,
      domain: getBaseDomain().split(':')[0], // remove port if present
    },
  },
});
