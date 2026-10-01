import { Outlet, createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { ProjectProvider } from '@/contexts/project-context';
import { requireProjectAccess } from '@/utils/auth-guards';

export const Route = createFileRoute('/_layout/p/$projectId')({
  beforeLoad: ({ params }) => requireProjectAccess(params.projectId),
  component: ProjectLayoutComponent,
});

function ProjectLayoutComponent() {
  // Reserve space for the scrollbar so switching between project pages with and without scrollable content doesn't shift the layout
  useEffect(() => {
    const html = document.documentElement;
    html.style.scrollbarGutter = 'stable';
    return () => {
      html.style.removeProperty('scrollbar-gutter');
    };
  }, []);

  return (
    <ProjectProvider>
      <Outlet />
    </ProjectProvider>
  );
}
