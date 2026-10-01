import { Global } from '@emotion/react';
import { Outlet, createFileRoute } from '@tanstack/react-router';
import { ProjectProvider } from '@/contexts/project-context';
import { requireProjectAccess } from '@/utils/auth-guards';

export const Route = createFileRoute('/_layout/p/$projectId')({
  beforeLoad: ({ params }) => requireProjectAccess(params.projectId),
  component: ProjectLayoutComponent,
});

// Reserve space for the scrollbar so switching between project pages with and without scrollable content doesn't shift the layout
const projectGlobalStyles = { html: { scrollbarGutter: 'stable' } };

function ProjectLayoutComponent() {
  return (
    <ProjectProvider>
      <Global styles={projectGlobalStyles} />
      <Outlet />
    </ProjectProvider>
  );
}
