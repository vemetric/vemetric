import { Box } from '@chakra-ui/react';
import { Outlet, createFileRoute } from '@tanstack/react-router';
import { ProjectProvider } from '@/contexts/project-context';
import { requireProjectAccess } from '@/utils/auth-guards';

export const Route = createFileRoute('/_layout/p/$projectId')({
  beforeLoad: ({ params }) => requireProjectAccess(params.projectId),
  component: ProjectLayoutComponent,
});

function ProjectLayoutComponent() {
  return (
    <ProjectProvider>
      {/* data-project-layout enables the stable scrollbar gutter defined in the theme's globalCss */}
      <Box display="contents" data-project-layout>
        <Outlet />
      </Box>
    </ProjectProvider>
  );
}
