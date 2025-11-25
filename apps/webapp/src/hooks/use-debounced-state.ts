import { useEffect, useState } from 'react';

interface Props<T> {
  defaultValue: T;
  onUpdate?: (value: T) => void;
  delay?: number;
}

export const useDebouncedState = <T>({ defaultValue, delay = 300, onUpdate }: Props<T>) => {
  const [state, setState] = useState(defaultValue);
  const [debouncedState, setDebouncedState] = useState<T>(defaultValue);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedState(state);
      onUpdate?.(state);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, delay]);

  return [state, setState, debouncedState] as const;
};
