import { jsonStringify } from '@vemetric/common/json';
import { escape } from 'sqlstring';
import { clickhouseClient, clickhouseInsert } from '../client';
import type { ClickhouseDevice } from './device';
import type { GeoData, ReferrerData, UrlData } from './session';
import { EXAMPLE_URL_DATA } from './session';

const TABLE_NAME = 'user';

export type ClickhouseUser = UrlData &
  GeoData & // TODO: we might remove the GeoData from the user at one point because at the moment it just gets retrieved from the last pageview and not really updated here
  ReferrerData & {
    projectId: bigint;
    id: bigint;
    identifier: string;
    displayName?: string;

    createdAt: string;
    firstSeenAt: string;
    updatedAt: string;

    initialDeviceId?: bigint;

    userAgent?: string;

    customData: Record<string, any>;
  };

const EXAMPLE_USER: Required<ClickhouseUser> = {
  ...EXAMPLE_URL_DATA,
  projectId: BigInt(1),
  id: BigInt(1),
  identifier: '',
  displayName: '',
  createdAt: '',
  firstSeenAt: '',
  updatedAt: '',
  initialDeviceId: BigInt(1),
  countryCode: '',
  city: '',
  latitude: null,
  longitude: null,
  userAgent: '',
  referrer: '',
  referrerUrl: '',
  referrerType: '',
  customData: {},
};

const transformKeySelector = (key: keyof ClickhouseUser, prefix = '', idColName = 'id') =>
  key === idColName ? prefix + key : `argMax(${prefix}${key}, ${prefix}updatedAt)`;

const USER_KEYS = Object.keys(EXAMPLE_USER) as Array<keyof ClickhouseUser>;
const USER_KEY_IDENTIFIER_SELECTOR = USER_KEYS.map((key) => transformKeySelector(key, 'identifier')).join(',');
const JSON_KEYS = USER_KEYS.filter((key) => typeof EXAMPLE_USER[key] === 'object');
const BIGINT_KEYS = USER_KEYS.filter((key) => typeof EXAMPLE_USER[key] === 'bigint');

function mapRowToUser(row: any, idColName?: string): ClickhouseUser {
  const user: ClickhouseUser = JSON.parse(jsonStringify(EXAMPLE_USER));

  USER_KEYS.forEach((key) => {
    const keyValue = row[transformKeySelector(key, idColName)];
    if (JSON_KEYS.includes(key)) {
      (user as any)[key] = keyValue ? JSON.parse(keyValue) : undefined;
    } else if (BIGINT_KEYS.includes(key)) {
      (user as any)[key] = BigInt(keyValue);
    } else {
      (user as any)[key] = keyValue;
    }
  });

  return user;
}

export const clickhouseUser = {
  findByIdentifier: async (projectId: bigint, identifier: string): Promise<ClickhouseUser | null> => {
    const resultSet = await clickhouseClient.query({
      query: `SELECT ${USER_KEY_IDENTIFIER_SELECTOR} FROM ${TABLE_NAME} WHERE projectId=${escape(
        projectId,
      )} AND identifier=${escape(identifier)} GROUP BY identifier HAVING argMax(deleted, updatedAt) = 0 LIMIT 1`,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return mapRowToUser(row, 'identifier');
  },
  findById: async (
    projectId: bigint,
    id: bigint,
    includeDevice?: boolean,
  ): Promise<
    | (ClickhouseUser & {
        device?: Pick<ClickhouseDevice, 'clientName' | 'clientVersion' | 'osName' | 'osVersion' | 'deviceType'>;
      })
    | null
  > => {
    const deviceSelect = includeDevice
      ? `, any(d.clientName) as device_clientName, any(d.clientVersion) as device_clientVersion, any(d.osName) as device_osName, any(d.osVersion) as device_osVersion, any(d.deviceType) as device_deviceType`
      : '';

    const deviceJoin = includeDevice
      ? ' LEFT JOIN device d ON u.initialDeviceId = d.id AND u.projectId = d.projectId'
      : '';

    const resultSet = await clickhouseClient.query({
      query: `SELECT ${USER_KEYS.map((key) => transformKeySelector(key, 'u.')).join(',')}${deviceSelect}
      FROM ${TABLE_NAME} u${deviceJoin}
      WHERE u.projectId=${escape(projectId)} AND u.id=${escape(id)}
      GROUP BY u.id
      HAVING argMax(u.deleted, u.updatedAt) = 0
      LIMIT 1
    `,
      format: 'JSONEachRow',
    });
    const result = (await resultSet.json()) as Array<any>;
    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    const user = mapRowToUser(row);

    if (includeDevice && row.device_clientName !== null) {
      const device = {
        clientName: row.device_clientName,
        clientVersion: row.device_clientVersion,
        osName: row.device_osName,
        osVersion: row.device_osVersion,
        deviceType: row.device_deviceType,
      };
      return { ...user, device };
    }

    return user;
  },
  insert: async (users: Array<ClickhouseUser>) => {
    await clickhouseInsert({
      table: TABLE_NAME,
      values: users,
    });
  },
};
