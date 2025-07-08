import { Outlet, createFileRoute } from '@tanstack/react-router';
import { ProjectProvider } from '@/contexts/project-context';

export const Route = createFileRoute('/_layout/p/$projectId')({
  component: ProjectLayoutComponent,
});

function ProjectLayoutComponent() {
  return (
    <ProjectProvider>
      <Outlet />
    </ProjectProvider>
  );
}