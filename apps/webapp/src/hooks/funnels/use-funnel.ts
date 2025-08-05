import { type FunnelStep } from '@vemetric/common/funnel';
import { useState, useRef } from 'react';
import { clone } from 'remeda';
import { toaster } from '@/components/ui/toaster';
import { useProjectContext } from '@/contexts/project-context';
import { trpc } from '@/utils/trpc';

export const DEFAULT_STEP: FunnelStep = {
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

interface UseFunnelProps {
  funnelId?: string;
  onSuccess?: (id: string) => void;
}

export function useFunnel({ funnelId, onSuccess }: UseFunnelProps) {
  const { projectId } = useProjectContext();
  const isInitialized = useRef(false);
  const isEditMode = !!funnelId;

  const hasChanges = useRef(false);

  const [funnelName, _setFunnelName] = useState('');
  const setFunnelName = (name: string) => {
    hasChanges.current = true;
    _setFunnelName(name);
  };

  const [steps, _setSteps] = useState<FunnelStep[]>([clone(DEFAULT_STEP)]);
  const setSteps = (steps: FunnelStep[]) => {
    hasChanges.current = true;
    _setSteps(steps);
  };

  // Only fetch data in edit mode
  const { data: funnelData, isLoading: isLoadingFunnel } = trpc.funnels.get.useQuery(
    { id: funnelId!, projectId: projectId! },
    { enabled: isEditMode },
  );

  // Initialize form data only once when data first loads (edit mode only)
  if (isEditMode && funnelData?.funnel && !isInitialized.current) {
    _setFunnelName(funnelData.funnel.name);
    _setSteps(funnelData.funnel.steps as FunnelStep[]);
    isInitialized.current = true;
  }

  const utils = trpc.useUtils();

  const { mutate: upsertFunnel, isLoading: isSubmitting } = trpc.funnels.upsert.useMutation({
    onSuccess: ({ id }) => {
      utils.funnels.list.invalidate();
      if (id) {
        utils.funnels.get.invalidate({ projectId: projectId!, id });
        utils.funnels.getFunnelResults.invalidate({ projectId: projectId!, id });
      }
      toaster.create({
        title: 'Success',
        description: `Funnel ${isEditMode ? 'updated' : 'created'} successfully`,
        type: 'success',
      });
      onSuccess?.(id);
    },
    onError: (error) => {
      toaster.create({
        title: 'Error',
        description: error.message || `Failed to ${isEditMode ? 'update' : 'create'} funnel`,
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

    upsertFunnel({
      ...(isEditMode && { id: funnelId! }),
      projectId: projectId!,
      name: funnelName.trim(),
      steps,
    });
  };

  const resetForm = () => {
    hasChanges.current = false;
    isInitialized.current = false;
    _setFunnelName('');
    _setSteps([clone(DEFAULT_STEP)]);
  };

  return {
    hasChanges,
    funnelName,
    setFunnelName,
    steps,
    setSteps,
    onSubmit,
    isSubmitting,
    resetForm,
    isEditMode,
    isLoadingFunnel: isEditMode && isLoadingFunnel,
  };
}
