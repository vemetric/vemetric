import { jsonStringify } from '@vemetric/common/json';
import { escape } from 'sqlstring';
import { clickhouseClient, clickhouseInsert, ingestionInsertSettings } from '../client';

const TABLE_NAME = 'device_v2';

export interface DeviceData {
  osName: string;
  osVersion: string;
  clientName: string;
  clientVersion: string;
  clientType: 'browser' | 'server' | 'unknown';
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'console' | 'smarttv' | 'wearable' | 'embedded' | 'server' | 'unknown';
}

export const EXAMPLE_DEVICE_DATA: Required<DeviceData> = {
  osName: '',
  osVersion: '',
  clientName: '',
  clientVersion: '',
  clientType: 'browser',
  deviceType: 'desktop',
};

export type ClickhouseDevice = DeviceData & {
  projectId: bigint;
  userId: bigint;
  id: bigint;
  createdAt: string;
  importSource?: string;
  deleted?: number;
};

const EXAMPLE_DEVICE: Required<ClickhouseDevice> = {
  ...EXAMPLE_DEVICE_DATA,
  projectId: BigInt(1),
  userId: BigInt(1),
  id: BigInt(1),
  createdAt: '',
  importSource: '',
  deleted: 0,
};

// Wrap values so argMax preserves NULL from the winning revision. Retries of a
// revision must contain the same snapshot; separate aggregates allow column pruning.
const transformKeySelector = (key: keyof ClickhouseDevice) =>
  key === 'projectId' || key === 'userId' || key === 'id' ? key : `argMax(tuple(${key}), revision).1 AS ${key}`;
const DEVICE_KEYS = Object.keys(EXAMPLE_DEVICE) as Array<keyof ClickhouseDevice>;
const DEVICE_KEY_SELECTOR = DEVICE_KEYS.join(',');
// Every mapped column resolves to the highest revision; `deleted` is the tombstone flag.
const CURRENT_DEVICE_KEY_SELECTOR = DEVICE_KEYS.map(transformKeySelector).join(', ');
const JSON_KEYS = DEVICE_KEYS.filter((key) => typeof EXAMPLE_DEVICE[key] === 'object');
const BIGINT_KEYS = DEVICE_KEYS.filter((key) => typeof EXAMPLE_DEVICE[key] === 'bigint');

export function currentDeviceRows(projectId: bigint, userId?: bigint, id?: bigint) {
  return `(SELECT ${CURRENT_DEVICE_KEY_SELECTOR}
    FROM ${TABLE_NAME}
    WHERE projectId = ${escape(projectId)}
      ${userId === undefined ? '' : `AND userId = ${escape(userId)}`}
      ${id === undefined ? '' : `AND id = ${escape(id)}`}
    GROUP BY projectId, userId, id
    HAVING deleted = 0)`;
}

export const clickhouseDevice = {
  findByUserId: async (projectId: bigint, userId: bigint): Promise<Array<ClickhouseDevice>> => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT ${DEVICE_KEY_SELECTOR} FROM ${currentDeviceRows(projectId, userId)}`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => {
      const device: ClickhouseDevice = JSON.parse(jsonStringify(EXAMPLE_DEVICE));
      DEVICE_KEYS.forEach((key) => {
        const keyValue = row[key];
        if (JSON_KEYS.includes(key)) {
          (device as any)[key] = keyValue ? JSON.parse(keyValue) : undefined;
        } else if (BIGINT_KEYS.includes(key)) {
          (device as any)[key] = BigInt(keyValue);
        } else {
          (device as any)[key] = keyValue;
        }
      });
      return device;
    });
  },
  insert: async (devices: Array<Omit<ClickhouseDevice, 'createdAt'> & { createdAt?: string }>) => {
    await clickhouseInsert({
      table: TABLE_NAME,
      settings: ingestionInsertSettings(),
      values: devices.map((device) => {
        const createdAt = device.createdAt ?? new Date().toISOString().replace('T', ' ').replace('Z', '');
        const timestamp = Date.parse(createdAt.replace(' ', 'T') + 'Z');
        if (!Number.isSafeInteger(timestamp) || timestamp < 0) throw new Error('Invalid device creation timestamp');
        return {
          ...device,
          createdAt,
          revision: String(BigInt('18446744073709551614') - BigInt(timestamp)),
        };
      }),
    });
  },
  delete: async (devices: Array<Pick<ClickhouseDevice, 'projectId' | 'userId' | 'id'>>) => {
    await clickhouseInsert({
      table: TABLE_NAME,
      // Compact tombstone: the key and version are enough to win the revision and hide the row.
      values: devices.map((device) => ({
        projectId: device.projectId,
        userId: device.userId,
        id: device.id,
        revision: '18446744073709551615',
        deleted: 1,
      })),
    });
  },
};
