import { jsonStringify } from '@vemetric/common/json';
import { escape } from 'sqlstring';
import { clickhouseClient, clickhouseInsert } from '../client';

const TABLE_NAME = 'device';

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

type ClickhouseDevice = DeviceData & {
  projectId: bigint;
  userId: bigint;
  id: bigint;
  createdAt: string;
};

const EXAMPLE_DEVICE: Required<ClickhouseDevice> = {
  ...EXAMPLE_DEVICE_DATA,
  projectId: BigInt(1),
  userId: BigInt(1),
  id: BigInt(1),
  createdAt: '',
};

const transformKeySelector = (key: keyof ClickhouseDevice) => (key === 'id' ? key : `any(${key})`);
const DEVICE_KEYS = Object.keys(EXAMPLE_DEVICE) as Array<keyof ClickhouseDevice>;
const DEVICE_KEY_SELECTOR = DEVICE_KEYS.map(transformKeySelector).join(',');
const JSON_KEYS = DEVICE_KEYS.filter((key) => typeof EXAMPLE_DEVICE[key] === 'object');
const BIGINT_KEYS = DEVICE_KEYS.filter((key) => typeof EXAMPLE_DEVICE[key] === 'bigint');

export const clickhouseDevice = {
  exists: async (projectId: bigint, id: bigint) => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT id FROM ${TABLE_NAME} WHERE projectId = ${escape(projectId)} AND id = ${escape(
        id,
      )} GROUP BY id HAVING sum(sign) > 0 LIMIT 1`,
      format: 'JSONEachRow',
    });
    const dataset = await resultSet.json<[unknown]>();
    return dataset.length > 0;
  },
  findByUserId: async (projectId: bigint, userId: bigint): Promise<Array<ClickhouseDevice>> => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT ${DEVICE_KEY_SELECTOR} FROM ${TABLE_NAME} WHERE projectId=${escape(projectId)} AND userId=${escape(
        userId,
      )} GROUP BY id HAVING sum(sign) > 0`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    return result.map((row) => {
      const device: ClickhouseDevice = JSON.parse(jsonStringify(EXAMPLE_DEVICE));
      DEVICE_KEYS.forEach((key) => {
        const keyValue = row[transformKeySelector(key)];
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
  insert: async (devices: Array<Omit<ClickhouseDevice, 'createdAt'>>) => {
    await clickhouseInsert({
      table: TABLE_NAME,
      values: devices.map((device) => ({ ...device, sign: 1 })),
    });
  },
  delete: async (devices: Array<ClickhouseDevice>) => {
    await clickhouseInsert({
      table: TABLE_NAME,
      values: devices.map((device) => ({ ...device, sign: -1 })),
    });
  },
};
