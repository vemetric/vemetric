import { describe, expect, it } from 'vitest';
import { currentDeviceRows } from '../src/models/device';

describe('currentDeviceRows', () => {
  it('scopes by project and hides tombstoned devices by default', () => {
    const rows = currentDeviceRows(BigInt(7));
    expect(rows).toContain('FROM device_v2');
    expect(rows).toContain("projectId = '7'");
    expect(rows).toContain('GROUP BY projectId, userId, id');
    expect(rows).toContain('HAVING deleted = 0');
    expect(rows).not.toContain('AND userId =');
    expect(rows).not.toContain('AND id =');
  });

  it('scopes to a single user (and optional device) at the scan', () => {
    expect(currentDeviceRows(BigInt(7), BigInt(2))).toContain("AND userId = '2'");

    const scoped = currentDeviceRows(BigInt(7), BigInt(2), BigInt(3));
    expect(scoped).toContain("AND userId = '2'");
    expect(scoped).toContain("AND id = '3'");
  });
});
