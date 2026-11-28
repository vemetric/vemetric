import { ChakraProvider } from '@chakra-ui/react';
import { render } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { vemetricTheme } from '@/style/theme';
import { EventCard } from './event-card';

vi.mock('@/components/event-icon-button', () => ({
  EventIconButton: () => null,
}));

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const basePageView = {
  id: 'evt-1',
  name: '$$pageView',
  origin: 'https://example.com',
  pathname: '/pricing',
  urlHash: '',
  createdAt: '2026-07-21 12:00:00.000',
  customData: {},
  queryParams: {},
};

function renderEventCard(props: { lastPageViewDate?: string; isCurrentPageView?: boolean }) {
  return render(
    <ChakraProvider value={vemetricTheme}>
      <EventCard event={basePageView} {...props} />
    </ChakraProvider>,
  );
}

describe('EventCard page-view duration', () => {
  it('hides duration for completed page views with no measured time after creation', () => {
    const { container } = renderEventCard({
      lastPageViewDate: basePageView.createdAt,
      isCurrentPageView: false,
    });

    expect(container.querySelector('button')?.textContent).toBe('/pricing');
    expect(container.querySelector('.chakra-spinner')).toBeNull();
  });

  it('shows 0s for completed page views whose next timestamp differs by less than half a second', () => {
    const { container } = renderEventCard({
      lastPageViewDate: '2026-07-21 12:00:00.300',
      isCurrentPageView: false,
    });

    expect(container.querySelector('button')?.textContent).toBe('/pricing0s');
    expect(container.querySelector('.chakra-spinner')).toBeNull();
  });

  it('shows a pending spinner for the active page view until duration advances past 0s', () => {
    const { container } = renderEventCard({
      lastPageViewDate: basePageView.createdAt,
      isCurrentPageView: true,
    });

    expect(container.querySelector('button')?.textContent).toBe('/pricing');
    expect(container.querySelector('.chakra-spinner')).not.toBeNull();
  });

  it('replaces the spinner with the recorded duration once heartbeats extend the session', () => {
    const { container } = renderEventCard({
      lastPageViewDate: '2026-07-21 12:00:30.000',
      isCurrentPageView: true,
    });

    expect(container.querySelector('button')?.textContent).toBe('/pricing30s');
    expect(container.querySelector('.chakra-spinner')).toBeNull();
  });
});
