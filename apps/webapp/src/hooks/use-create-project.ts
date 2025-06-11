import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { toaster } from '@/components/ui/toaster';
import { trpc } from '@/utils/trpc';
import { useAuth } from './use-auth';

interface Props {
  onSuccess?: (projectId: string) => void;
}

export function useCreateProject({ onSuccess }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [domain, setDomain] = useState('');
  const navigate = useNavigate();
  const { session, refetchAuth } = useAuth();
  const { mutate } = trpc.projects.create.useMutation({
    onMutate: () => {
      setIsLoading(true);
    },
    onSuccess: async ({ id }) => {
      await refetchAuth();
      navigate({ to: '/p/$projectId', params: { projectId: id } });
      onSuccess?.(id);
      setIsLoading(false);
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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (projectName.length < 2) {
      toaster.create({
        title: 'Error',
        description: 'Project name must be at least 2 characters long',
        type: 'error',
      });
      return;
    }

    mutate({
      organizationId: session?.organizations[0].id ?? '',
      name: projectName,
      domain,
    });
  };

  return {
    isLoading,
    projectName,
    setProjectName,
    domain,
    setDomain,
    onSubmit,
  };
}
