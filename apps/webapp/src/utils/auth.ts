import type { Auth } from 'backend';
import { customSessionClient, lastLoginMethodClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

const hostname = location.hostname.split('.').slice(-2).join('.');

export const authClient = createAuthClient({
  baseURL: 'https://backend.' + hostname + '/auth',
  plugins: [lastLoginMethodClient(), customSessionClient<Auth>()],
});
