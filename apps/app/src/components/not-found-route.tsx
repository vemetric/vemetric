import { Navigate } from '@tanstack/react-router';

export const notFoundRoute = () => {
  return <Navigate to="/" />;
};
