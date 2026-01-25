import { createFileRoute, Navigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { toaster } from '~/components/ui/toaster';

const searchSchema = z.object({
  error: z.boolean().optional(),
});

export const Route = createFileRoute('/email/unsubscribe')({
  component: UnsubscribePage,
  validateSearch: zodValidator(searchSchema),
});

function UnsubscribePage() {
  const { error } = Route.useSearch();
  const [hasShownToast, setHasShownToast] = useState(false);

  useEffect(() => {
    if (!hasShownToast) {
      setHasShownToast(true);

      if (error) {
        toaster.create({
          id: 'email-unsubscribe-error',
          title: 'Unsubscribe failed',
          description: 'We encountered an error. Please contact us if this persists.',
          type: 'error',
          duration: 10000,
          meta: { closable: true },
        });
      } else {
        toaster.create({
          id: 'email-unsubscribe-success',
          title: 'Successfully unsubscribed',
          description: 'You will no longer receive email tips from Vemetric.',
          type: 'success',
          duration: 10000,
          meta: { closable: true },
        });
      }
    }
  }, [error, hasShownToast]);

  return <Navigate to="/" />;
}
