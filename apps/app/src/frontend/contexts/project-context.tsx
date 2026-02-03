import { useParams } from '@tanstack/react-router';
import { createContext, useContext } from 'react';
import { trpc } from '@/utils/trpc';

interface ProjectContextType {
  eventIcons: Record<string, string>;
  setEventIcon: (eventName: string, emoji: string) => void;
  removeEventIcon: (eventName: string) => void;
  isLoading: boolean;
  projectId?: string;
  domain?: string;
}

const ProjectContext = createContext<ProjectContextType | null>(null);

export const ProjectProvider = ({ children }: { children: React.ReactNode }) => {
  const { projectId, domain } = useParams({ strict: false });
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.projects.getEventIcons.useQuery(
    { projectId: projectId, domain: domain },
    {
      enabled: !!projectId || !!domain,
    },
  );

  const eventIcons = data ?? {};

  const setEventIconMutation = trpc.projects.setEventIcon.useMutation({
    onMutate: async ({ eventName, emoji }) => {
      await utils.projects.getEventIcons.cancel({ projectId: projectId, domain: domain });

      const previousData = utils.projects.getEventIcons.getData({ projectId: projectId, domain: domain });

      utils.projects.getEventIcons.setData({ projectId: projectId, domain: domain }, (old) => ({
        ...old,
        [eventName]: emoji,
      }));

      return { previousData };
    },
    onError: (_err, _newData, context) => {
      if (context?.previousData) {
        utils.projects.getEventIcons.setData({ projectId: projectId, domain: domain }, context.previousData);
      }
    },
    onSettled: () => {
      utils.projects.getEventIcons.invalidate({ projectId: projectId, domain: domain });
    },
  });

  const removeEventIconMutation = trpc.projects.removeEventIcon.useMutation({
    onMutate: async ({ eventName }) => {
      await utils.projects.getEventIcons.cancel({ projectId: projectId, domain: domain });

      const previousData = utils.projects.getEventIcons.getData({ projectId: projectId, domain: domain });

      utils.projects.getEventIcons.setData({ projectId: projectId, domain: domain }, (old) => {
        const updated = { ...old };
        delete updated[eventName];
        return updated;
      });

      return { previousData };
    },
    onError: (_err, _newData, context) => {
      if (context?.previousData) {
        utils.projects.getEventIcons.setData({ projectId: projectId, domain: domain }, context.previousData);
      }
    },
    onSettled: () => {
      utils.projects.getEventIcons.invalidate({ projectId: projectId, domain: domain });
    },
  });

  const setEventIcon = (eventName: string, emoji: string) => {
    setEventIconMutation.mutate({ projectId: projectId ?? '', eventName, emoji });
  };

  const removeEventIcon = (eventName: string) => {
    removeEventIconMutation.mutate({ projectId: projectId ?? '', eventName });
  };

  const value: ProjectContextType = {
    eventIcons,
    setEventIcon,
    removeEventIcon,
    isLoading,
    projectId,
    domain,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};

export const useProjectContext = () => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
};
