import { ChakraProvider } from '@chakra-ui/react';
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { vemetricTheme } from '@/style/theme';
import { LiveTimeAgo } from './live-time-ago';

describe('LiveTimeAgo', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates the relative time every second and clears its timer on unmount', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:04.000Z'));
    const { container, unmount } = render(
      <ChakraProvider value={vemetricTheme}>
        <LiveTimeAgo value={new Date('2026-01-15T12:00:00.000Z')} />
        <LiveTimeAgo value={new Date('2026-01-15T12:00:02.000Z')} />
        <LiveTimeAgo value={new Date('2026-01-15T11:58:59.000Z')} format="duration" suffix={null} />
      </ChakraProvider>,
    );

    expect(container.textContent).toBe('4s ago2s ago1m 5s');
    expect(vi.getTimerCount()).toBe(1);

    act(() => vi.advanceTimersByTime(1000));
    expect(container.textContent).toBe('5s ago3s ago1m 6s');

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
