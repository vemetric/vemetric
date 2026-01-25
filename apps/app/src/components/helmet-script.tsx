import { useEffect } from 'react';

interface Props {
  src: string;
  onLoad?: () => void;
  defer?: boolean;
}

export const HelmetScript = ({ src, onLoad, defer }: Props) => {
  useEffect(() => {
    const existing = document.querySelector(`script[data-helmet-script="${src}"]`);
    if (existing) {
      if (onLoad) {
        existing.addEventListener('load', onLoad, { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.defer = Boolean(defer);
    script.dataset.helmetScript = src;
    if (onLoad) {
      script.addEventListener('load', onLoad, { once: true });
    }
    document.head.appendChild(script);

    return () => {
      if (onLoad) {
        script.removeEventListener('load', onLoad);
      }
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, [defer, onLoad, src]);

  return null;
};
