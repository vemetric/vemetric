import { verifyProjectDeletionToken, verifyUnsubscribeToken } from '@vemetric/common/email-token';
import { getVemetricUrl } from '@vemetric/common/env';
import { dbAuthUser, dbOrganization, dbProject, OrganizationRole } from 'database';
import type { Hono } from 'hono';
import type { HonoContextVars } from '../types';
import { logger } from '../utils/logger';
import { vemetric } from '../utils/vemetric-client';

const redirectUrls = {
  unsubscribe: `${getVemetricUrl('app')}/email/unsubscribe`,
  projectDeletion: `${getVemetricUrl('app')}/email/confirm-project-deletion`,
};

export async function useEmailRoutes(app: Hono<{ Variables: HonoContextVars }>) {
  app.get('/email/unsubscribe', async (c) => {
    const token = c.req.query('token');

    if (!token) {
      return c.redirect(`${redirectUrls.unsubscribe}?error=true`);
    }

    const userId = verifyUnsubscribeToken(token);
    if (!userId) {
      logger.warn({ token }, 'Invalid unsubscribe token');
      return c.redirect(`${redirectUrls.unsubscribe}?error=true`);
    }

    try {
      await dbAuthUser.update(userId, { receiveEmailTips: false });

      return c.redirect(redirectUrls.unsubscribe);
    } catch (error) {
      logger.error({ err: error, userId }, 'Failed to unsubscribe user');
      return c.redirect(`${redirectUrls.unsubscribe}?error=true`);
    }
  });

  app.get('/email/confirm-project-deletion', async (c) => {
    const token = c.req.query('token');

    if (!token) {
      return c.redirect(`${redirectUrls.projectDeletion}?error=missing_token`);
    }

    const payload = verifyProjectDeletionToken(token);
    if (!payload) {
      logger.warn({ token }, 'Invalid or expired project deletion token');
      return c.redirect(`${redirectUrls.projectDeletion}?error=invalid_token`);
    }

    const { projectId, userId } = payload;

    try {
      // Verify project still exists
      const project = await dbProject.findById(projectId);
      if (!project) {
        return c.redirect(`${redirectUrls.projectDeletion}?error=not_found`);
      }

      // Verify the user is still an admin of the organization that owns the project
      const isAdmin = await dbOrganization.hasUserAccess(project.organizationId, userId, OrganizationRole.ADMIN);
      if (!isAdmin) {
        logger.warn(
          { projectId, userId, organizationId: project.organizationId },
          'User no longer admin for project deletion',
        );
        return c.redirect(`${redirectUrls.projectDeletion}?error=unauthorized`);
      }

      // Delete the project
      await dbProject.delete(projectId);

      logger.info({ projectId, userId, domain: project.domain }, 'Project deleted via email confirmation');

      try {
        await vemetric.trackEvent('ProjectDeleted', {
          userIdentifier: userId,
          eventData: { projectId, domain: project.domain },
        });
      } catch (err) {
        logger.error({ err, projectId, domain: project.domain }, 'Track event error');
      }

      return c.redirect(`${redirectUrls.projectDeletion}?success=true&domain=${encodeURIComponent(project.domain)}`);
    } catch (error) {
      logger.error({ err: error, projectId, userId }, 'Failed to delete project via email confirmation');
      return c.redirect(`${redirectUrls.projectDeletion}?error=deletion_failed`);
    }
  });
}
