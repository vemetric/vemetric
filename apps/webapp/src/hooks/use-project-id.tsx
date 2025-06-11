import type { PropsWithChildren } from 'react';
import { createContext, useContext } from 'react';

type ProjectIdOrDomain = { projectId?: string; domain?: string };

export const ProjectIdContext = createContext<ProjectIdOrDomain>({});

export const ProjectIdProvider = ({ children, ...props }: PropsWithChildren<ProjectIdOrDomain>) => {
  return <ProjectIdContext.Provider value={props}>{children}</ProjectIdContext.Provider>;
};

export const useProjectId = () => {
  return useContext(ProjectIdContext);
};
