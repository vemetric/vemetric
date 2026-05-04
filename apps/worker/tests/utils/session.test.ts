import type { GeoData } from '@vemetric/common/geo';
import { clickhouseSession, type ClickhouseSession } from 'clickhouse';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { increaseClickhouseSessionDuration } from '../../src/utils/session';

vi.mock('clickhouse', () => ({
  clickhouseSession: {
    insert: vi.fn(),
  },
}));

const baseSession = {
  projectId: BigInt(1),
  userId: BigInt(2),
  id: 'session-id',
  startedAt: '2026-05-04 10:00:00.000',
  endedAt: '2026-05-04 10:00:00.000',
  duration: 0,
  countryCode: '',
  city: '',
  latitude: null,
  longitude: null,
} as ClickhouseSession;

const geoData: GeoData = {
  countryCode: 'AT',
  city: 'Vienna',
  latitude: 48.2082,
  longitude: 16.3738,
};

describe('increaseClickhouseSessionDuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fills missing session geo data when duration increases', async () => {
    await increaseClickhouseSessionDuration(baseSession, '2026-05-04 10:01:00.000', geoData);

    expect(clickhouseSession.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        countryCode: 'AT',
        city: 'Vienna',
        latitude: 48.2082,
        longitude: 16.3738,
        endedAt: '2026-05-04 10:01:00.000',
        duration: 60,
      }),
    ]);
  });

  it('does not overwrite existing session geo data', async () => {
    const session = {
      ...baseSession,
      countryCode: 'DE',
      city: 'Berlin',
      latitude: 52.52,
      longitude: 13.405,
    };

    await increaseClickhouseSessionDuration(session, '2026-05-04 10:01:00.000', geoData);

    expect(clickhouseSession.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        countryCode: 'DE',
        city: 'Berlin',
        latitude: 52.52,
        longitude: 13.405,
        endedAt: '2026-05-04 10:01:00.000',
        duration: 60,
      }),
    ]);
  });
});
