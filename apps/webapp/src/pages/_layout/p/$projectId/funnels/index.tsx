import { createFileRoute, Link } from '@tanstack/react-router';
import { useSetBreadcrumbs } from '@/stores/header-store';

export const Route = createFileRoute('/_layout/p/$projectId/funnels/')({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();

  /* TODO: 
  const { data: funnelResults } = trpc.funnels.getFunnelResults.useQuery({ projectId }); */

  useSetBreadcrumbs(['Funnels']);

  return (
    <>
      Go to{' '}
      <Link to="/p/$projectId/funnels/$funnelId" params={{ projectId, funnelId: '123' }}>
        Funnel 123
      </Link>
    </>
  );
}
