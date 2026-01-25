import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toaster } from '@/components/ui/toaster';
import { authClient } from '@/utils/auth';
import { trpc } from '@/utils/trpc';
import { useDebouncedState } from './use-debounced-state';

interface Props {
  organizationId: string;
  onSuccess?: (projectId: string) => void;
}

export function useCreateProject({ organizationId, onSuccess }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [domain, setDomain, debouncedDomain] = useDebouncedState({ defaultValue: '' });

  const navigate = useNavigate();
  const { data: session, refetch: refetchAuth } = authClient.useSession();
  const { mutate } = trpc.projects.create.useMutation({
    onMutate: () => {
      setIsLoading(true);
    },
    onSuccess: async ({ id }) => {
      await refetchAuth();
      navigate({ to: '/p/$projectId', params: { projectId: id } });
      onSuccess?.(id);
    },
    onError: (error) => {
      toaster.create({
        title: 'Error',
        description: error.message,
        type: 'error',
      });
      setIsLoading(false);
    },
  });

  // Check if user is admin of the organization
  const organization = session?.organizations.find((org) => org.id === organizationId);
  const isAdmin = organization?.role === 'ADMIN';

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAdmin) {
      toaster.create({
        title: 'Permission denied',
        description: 'Only organization admins can create projects.',
        type: 'error',
      });
      return;
    }

    if (projectName.length < 2) {
      toaster.create({
        title: 'Error',
        description: 'Project name must be at least 2 characters long',
        type: 'error',
      });
      return;
    }

    mutate({
      organizationId,
      name: projectName,
      domain,
    });
  };

  return {
    isLoading,
    projectName,
    setProjectName,
    debouncedDomain,
    domain,
    setDomain,
    onSubmit,
  };
}
