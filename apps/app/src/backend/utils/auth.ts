import { getBaseDomain, getVemetricUrl } from '@vemetric/common/env';
import { isSelfHosted } from '@vemetric/common/self-hosted';
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
import { emailVerificationRateLimiter } from './rate-limit';
import {
  INVITATION_TOKEN_COOKIE,
  applyClaimedInvitation,
  assertRegistrationAllowed,
  extractInvitationToken,
} from './registration-guard';
import { getEnabledSocialProviders, getSocialProviderCredentials } from './social-providers';
import { vemetric } from './vemetric-client';

export const TRUSTED_ORIGINS = [getVemetricUrl('app'), getVemetricUrl()];
const isLocalhost = getBaseDomain().includes('localhost');

/**
 * Credentials of the social login providers that are fully configured.
 *
 * Resolved while the module is loaded, so a provider with only one of its two values set fails
 * the process start. Unconfigured providers are not registered at all.
 */
const SOCIAL_PROVIDER_CREDENTIALS = getSocialProviderCredentials();

/**
 * Providers whose accounts may be linked automatically. Only enabled providers are listed, next to
 * the email and password login, which is always available.
 */
const ENABLED_SOCIAL_PROVIDERS = getEnabledSocialProviders();

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
      trustedProviders: [...ENABLED_SOCIAL_PROVIDERS, 'email-password'],
      allowDifferentEmails: true,
    },
  },
  socialProviders: SOCIAL_PROVIDER_CREDENTIALS,
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
        before: async (user, context) => {
          const invitationToken = extractInvitationToken(
            context?.request?.url,
            context?.getCookie?.(INVITATION_TOKEN_COOKIE) ?? null,
          );
          await assertRegistrationAllowed(invitationToken);
          return { data: user };
        },
        after: async (user, context) => {
          const invitationToken = extractInvitationToken(
            context?.request?.url,
            context?.getCookie?.(INVITATION_TOKEN_COOKIE) ?? null,
          );
          await applyClaimedInvitation(user.id, invitationToken);

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
          // Self hosted instances skip pricing entirely, so the frontend's pricing
          // onboarding guard must never see an organization stuck in that step.
          // This does not change the stored value, only what the session reports.
          ...(isSelfHosted() ? { pricingOnboarded: true } : {}),
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
