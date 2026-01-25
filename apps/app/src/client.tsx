import { StartClient } from '@tanstack/react-start/client';
import { hydrateRoot } from 'react-dom/client';
import 'simplebar-react/dist/simplebar.min.css';

window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

hydrateRoot(
  document,
  <>
    <StartClient />
  </>,
);
