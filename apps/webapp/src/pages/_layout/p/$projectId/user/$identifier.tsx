import { Navigate, createFileRoute } from '@tanstack/react-router';
import { SplashScreen } from '@/components/splash-screen';
import { trpc } from '@/utils/trpc';

export const Route = createFileRoute('/_layout/p/$projectId/user/$identifier')({
  component: Page,
});

/**
 * The purpose of this route is to redirect to the correct route with the userId
 */
function Page() {
  const { projectId, identifier } = Route.useParams();
  const { data, isSuccess } = trpc.users.identifier.useQuery({ projectId, identifier });
  const userId = data?.userId;

  if (isSuccess && userId) {
    return <Navigate to="/p/$projectId/users/$userId" params={{ projectId, userId: String(userId) }} />;
  }

  if (isSuccess && !userId) {
    return <div>User with Identifier not found: {identifier}</div>;
  }

  return <SplashScreen />;
}
