import { type FunnelStep } from '@vemetric/common/funnel';
import { useState } from 'react';
import { clone } from 'remeda';
import { toaster } from '@/components/ui/toaster';
import { useProjectContext } from '@/contexts/project-context';
import { trpc } from '@/utils/trpc';

interface UseAddFunnelProps {
  onSuccess?: (id: string) => void;
}

const DEFAULT_STEP: FunnelStep = {
  name: '',
  filter: {
    type: 'page',
    pathFilter: {
      value: '',
      operator: 'is',
    },
    originFilter: {
      value: '',
      operator: 'any',
    },
  },
};

export function useAddFunnel({ onSuccess }: UseAddFunnelProps) {
  const { projectId } = useProjectContext();
  const [funnelName, setFunnelName] = useState('');
  const [steps, setSteps] = useState<FunnelStep[]>([clone(DEFAULT_STEP)]);

  const { mutate, isLoading } = trpc.funnels.create.useMutation({
    onSuccess: ({ id }) => {
      toaster.create({
        title: 'Success',
        description: 'Funnel created successfully',
        type: 'success',
      });
      onSuccess?.(id);
    },
    onError: (error) => {
      toaster.create({
        title: 'Error',
        description: error.message || 'Failed to create funnel',
        type: 'error',
      });
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate funnel name
    if (funnelName.trim().length < 2) {
      toaster.create({
        title: 'Error',
        description: 'Funnel name must be at least 2 characters long',
        type: 'error',
      });
      return;
    }

    // Validate steps
    if (steps.length === 0) {
      toaster.create({
        title: 'Error',
        description: 'At least one step is required',
        type: 'error',
      });
      return;
    }

    mutate({
      projectId: projectId!,
      name: funnelName.trim(),
      steps,
    });
  };

  const resetForm = () => {
    setFunnelName('');
    setSteps([clone(DEFAULT_STEP)]);
  };

  return {
    funnelName,
    setFunnelName,
    steps,
    setSteps,
    onSubmit,
    isLoading,
    resetForm,
  };
}
