import { verifyProjectDeletionToken, verifyUnsubscribeToken } from '@vemetric/common/email-token';
import { getVemetricUrl } from '@vemetric/common/env';
import { dbAuthUser, dbOrganization, dbProject, OrganizationRole, serializableTransaction } from 'database';
import type { Hono } from 'hono';
import type { HonoContextVars } from '../types';
import { logger } from '../utils/backend-logger';
import { buildUrl } from '../utils/url';
import { vemetric } from '../utils/vemetric-client';

const redirectUrls = {
  unsubscribe: `${getVemetricUrl('app')}/email/unsubscribe`,
  projectDeletion: `${getVemetricUrl('app')}/email/confirm-project-deletion`,
};

export async function useEmailRoutes(app: Hono<{ Variables: HonoContextVars }>) {
  app.get('/email/unsubscribe', async (c) => {
    const token = c.req.query('token');

    if (!token) {
      return c.redirect(buildUrl(redirectUrls.unsubscribe, { error: 'true' }));
    }

    const userId = verifyUnsubscribeToken(token);
    if (!userId) {
      logger.warn('Invalid unsubscribe token');
      return c.redirect(buildUrl(redirectUrls.unsubscribe, { error: 'true' }));
    }

    try {
      await dbAuthUser.update(userId, { receiveEmailTips: false });

      return c.redirect(redirectUrls.unsubscribe);
    } catch (error) {
      logger.error({ err: error, userId }, 'Failed to unsubscribe user');
      return c.redirect(buildUrl(redirectUrls.unsubscribe, { error: 'true' }));
    }
  });

  app.get('/email/confirm-project-deletion', async (c) => {
    const token = c.req.query('token');

    if (!token) {
      return c.redirect(buildUrl(redirectUrls.projectDeletion, { error: 'missing_token' }));
    }

    const payload = verifyProjectDeletionToken(token);
    if (!payload) {
      logger.warn('Invalid or expired project deletion token');
      return c.redirect(buildUrl(redirectUrls.projectDeletion, { error: 'invalid_token' }));
    }

    const { projectId, userId } = payload;

    try {
      // Use serializable transaction to prevent race conditions
      const result = await serializableTransaction(async (tx) => {
        // Verify project still exists
        const project = await dbProject.findById(projectId, tx);
        if (!project) {
          return { error: 'not_found' as const };
        }

        // Verify the user is still an admin of the organization that owns the project
        const isAdmin = await dbOrganization.hasUserAccess(project.organizationId, userId, OrganizationRole.ADMIN, tx);
        if (!isAdmin) {
          logger.warn(
            { projectId, userId, organizationId: project.organizationId },
            'User no longer admin for project deletion',
          );
          return { error: 'unauthorized' as const };
        }

        // Delete the project within the transaction
        await dbProject.delete(projectId, tx);

        return { success: true as const, domain: project.domain };
      });

      if ('error' in result) {
        return c.redirect(buildUrl(redirectUrls.projectDeletion, { error: result.error }));
      }

      logger.info({ projectId, userId, domain: result.domain }, 'Project deleted via email confirmation');

      try {
        await vemetric.trackEvent('ProjectDeleted', {
          userIdentifier: userId,
          eventData: { projectId, domain: result.domain },
        });
      } catch (err) {
        logger.error({ err, projectId, domain: result.domain }, 'Track event error');
      }

      return c.redirect(buildUrl(redirectUrls.projectDeletion, { success: 'true', domain: result.domain }));
    } catch (error) {
      logger.error({ err: error, projectId, userId }, 'Failed to delete project via email confirmation');
      return c.redirect(buildUrl(redirectUrls.projectDeletion, { error: 'deletion_failed' }));
    }
  });
}
