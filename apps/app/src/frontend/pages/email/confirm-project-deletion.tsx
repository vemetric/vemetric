import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { toaster } from '@/components/ui/toaster';

const searchSchema = z.object({
  success: z.coerce.boolean().optional(),
  deletionError: z.enum(['missingToken', 'invalidToken', 'notFound', 'unauthorized', 'deletionFailed']).optional(),
  domain: z.string().optional(),
});

export const Route = createFileRoute('/email/confirm-project-deletion')({
  component: ConfirmProjectDeletionPage,
  validateSearch: searchSchema,
});

const ERROR_MESSAGES: Record<string, { title: string; description: string }> = {
  missingToken: {
    title: 'Invalid link',
    description: 'The confirmation link is incomplete. Please try again from the email.',
  },
  invalidToken: {
    title: 'Link expired or invalid',
    description: 'This confirmation link has expired or is invalid. Please request a new deletion confirmation.',
  },
  notFound: {
    title: 'Project not found',
    description: 'The project may have already been deleted.',
  },
  unauthorized: {
    title: 'Unauthorized',
    description: 'You no longer have permission to delete this project.',
  },
  deletionFailed: {
    title: 'Deletion failed',
    description: 'We encountered an error while deleting the project. Please try again or contact us.',
  },
};

function ConfirmProjectDeletionPage() {
  const { success, deletionError, domain } = Route.useSearch();
  const [hasShownToast, setHasShownToast] = useState(false);

  useEffect(() => {
    if (!hasShownToast) {
      setHasShownToast(true);

      if (success) {
        toaster.create({
          id: 'project-deletion-success',
          title: 'Project deleted',
          description: domain
            ? `The project "${domain}" has been permanently deleted.`
            : 'The project has been permanently deleted.',
          type: 'success',
          duration: 10000,
          meta: { closable: true },
        });
      } else if (deletionError) {
        const errorInfo = ERROR_MESSAGES[deletionError] || {
          title: 'Error',
          description: 'An unexpected error occurred.',
        };
        toaster.create({
          id: 'project-deletion-error',
          title: errorInfo.title,
          description: errorInfo.description,
          type: 'error',
          duration: 10000,
          meta: { closable: true },
        });
      }
    }
  }, [success, deletionError, domain, hasShownToast]);

  return <Navigate to="/" />;
}
