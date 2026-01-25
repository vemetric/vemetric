import { StrictMode, startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { StartClient } from '@tanstack/react-start/client';
import { createRouter } from './router';

const router = createRouter();

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient router={router} />
    </StrictMode>,
  );
});
