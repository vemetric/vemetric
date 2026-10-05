import { formatClickhouseDate } from '@vemetric/common/date';
import type { GeoData } from '@vemetric/common/geo';
import type { UpdateUserDataModel } from '@vemetric/queues/update-user-queue';
import { clickhouseDateToISO, type ClickhouseUser } from 'clickhouse';
import { isDeepEqual } from 'remeda';

export type StoredUser = Omit<ClickhouseUser, 'projectId' | 'id' | 'initialDeviceId'> & {
  projectId: string;
  id: string;
  initialDeviceId?: string;
};

export interface UserState {
  revision: number;
  user?: StoredUser;
  // Hub timestamp of the value each field holds (`displayName`, `avatarUrl`, `data.<key>`), so the
  // newest change of a field wins whatever order the jobs run in. An unset key keeps its timestamp
  // as a tombstone. Fields without an entry date from the persisted row's `updatedAt`.
  fieldsAt?: Record<string, string>;
  // Updates that arrived before the user was created; applied by the create.
  pending?: UserUpdate[];
}

export interface UserUpdate {
  updatedAt: string;
  displayName?: string;
  avatarUrl?: string;
  data?: UpdateUserDataModel;
}

export interface UserCreate {
  createdAt: string;
  identifier: string;
  displayName: string;
  avatarUrl: string;
  data: Record<string, unknown>;
  // Resolved by the caller when the user does not exist yet; ignored otherwise.
  geo?: GeoData;
  firstPageView?: Partial<ClickhouseUser>;
}

export type UserOp =
  | { type: 'create'; create: UserCreate }
  | { type: 'update'; update: UserUpdate }
  | { type: 'enrich'; at: string; firstPageView: Partial<ClickhouseUser> };

// Bounds a state whose user is never created (updates for an anonymous id).
export const MAX_PENDING_UPDATES = 100;

export const normalizeTimestamp = (value: string) => formatClickhouseDate(new Date(clickhouseDateToISO(value)));

// Every persisted row needs a newer `updatedAt` than the previous one: reads pick the row with the
// highest `updatedAt`, so two rows with the same value would be ambiguous.
function nextUpdatedAt(previous: string, at: string) {
  return at > previous ? at : formatClickhouseDate(new Date(Date.parse(clickhouseDateToISO(previous)) + 1));
}

export function toStoredUser(user: ClickhouseUser): StoredUser {
  return {
    ...user,
    projectId: String(user.projectId),
    id: String(user.id),
    initialDeviceId: user.initialDeviceId === undefined ? undefined : String(user.initialDeviceId),
    // An unset FixedString(2) is returned as two zero bytes by ClickHouse.
    countryCode: user.countryCode?.replace(/\0/g, '') ?? '',
    customData: user.customData ?? {},
  };
}

export function toClickhouseUser(user: StoredUser): ClickhouseUser {
  return {
    ...user,
    projectId: BigInt(user.projectId),
    id: BigInt(user.id),
    initialDeviceId: user.initialDeviceId === undefined ? undefined : BigInt(user.initialDeviceId),
  };
}

function storedFields(fields: Partial<ClickhouseUser>): Partial<StoredUser> {
  const { projectId: _projectId, id: _id, initialDeviceId, ...rest } = fields;
  return { ...rest, ...(initialDeviceId === undefined ? {} : { initialDeviceId: String(initialDeviceId) }) };
}

interface Applied {
  user: StoredUser;
  fieldsAt: Record<string, string>;
  changed: boolean;
}

// Same rules as the previous update worker (`{ ...setOnce, ...existing, ...set }`, then `unset`),
// applied per field: a change older than the field's current value is ignored.
export function applyUpdate(user: StoredUser, fieldsAt: Record<string, string>, update: UserUpdate): Applied {
  const at = normalizeTimestamp(update.updatedAt);
  const customData: Record<string, unknown> = { ...(user.customData ?? {}) };
  const next: StoredUser = { ...user, customData };
  const nextAt = { ...fieldsAt };
  const fieldAt = (field: string, present: boolean) => nextAt[field] ?? (present ? user.updatedAt : '');

  if (update.displayName && at >= fieldAt('displayName', true)) {
    next.displayName = update.displayName;
    nextAt.displayName = at;
  }
  if (typeof update.avatarUrl === 'string' && at >= fieldAt('avatarUrl', true)) {
    next.avatarUrl = update.avatarUrl;
    nextAt.avatarUrl = at;
  }

  const { set, setOnce, unset } = update.data ?? {};
  for (const [key, value] of Object.entries(setOnce ?? {})) {
    // Keeps an unset tombstone, and lets any `set` of the key win, as before.
    if (!(key in customData) && at >= (nextAt[`data.${key}`] ?? '')) {
      customData[key] = value;
      nextAt[`data.${key}`] = nextAt[`data.${key}`] ?? '';
    }
  }
  for (const [key, value] of Object.entries(set ?? {})) {
    if (at >= fieldAt(`data.${key}`, key in customData)) {
      customData[key] = value;
      nextAt[`data.${key}`] = at;
    }
  }
  for (const key of unset ?? []) {
    if (at >= fieldAt(`data.${key}`, key in customData)) {
      delete customData[key];
      nextAt[`data.${key}`] = at;
    }
  }

  const changed =
    next.displayName !== user.displayName ||
    next.avatarUrl !== user.avatarUrl ||
    !isDeepEqual(customData, user.customData ?? {});
  if (changed) next.updatedAt = nextUpdatedAt(user.updatedAt, at);
  return { user: changed ? next : user, fieldsAt: nextAt, changed };
}

/**
 * Applies one operation. Returns null when the state stays the same; `dirty` tells whether the
 * user row changed and has to be written to ClickHouse.
 */
export function applyUserOp(
  state: UserState,
  op: UserOp,
  ids: { projectId: string; userId: string },
): { state: UserState; dirty: boolean } | null {
  const fieldsAt = state.fieldsAt ?? {};

  if (op.type === 'enrich') {
    const user = state.user;
    if (!user || user.origin) return null;
    const enriched: StoredUser = {
      ...user,
      ...storedFields(op.firstPageView),
      updatedAt: nextUpdatedAt(user.updatedAt, normalizeTimestamp(op.at)),
    };
    return { state: { ...state, user: enriched }, dirty: true };
  }

  if (op.type === 'update') {
    if (!state.user) {
      const pending = [...(state.pending ?? []), op.update].slice(-MAX_PENDING_UPDATES);
      return { state: { ...state, pending }, dirty: false };
    }
    const applied = applyUpdate(state.user, fieldsAt, op.update);
    if (!applied.changed && isDeepEqual(applied.fieldsAt, fieldsAt)) return null;
    return { state: { ...state, user: applied.user, fieldsAt: applied.fieldsAt }, dirty: applied.changed };
  }

  const create = op.create;
  if (state.user) {
    // An existing user only takes the create's data, like an update (as before).
    return applyUserOp(
      state,
      { type: 'update', update: { updatedAt: create.createdAt, data: { set: create.data } } },
      ids,
    );
  }

  const createdAt = normalizeTimestamp(create.createdAt);
  let user: StoredUser = {
    projectId: ids.projectId,
    id: ids.userId,
    identifier: create.identifier,
    displayName: create.displayName,
    avatarUrl: create.avatarUrl || '',
    createdAt,
    firstSeenAt: createdAt,
    updatedAt: createdAt,
    customData: create.data,
    countryCode: '',
    city: '',
    latitude: null,
    longitude: null,
    ...(create.geo ?? {}),
    ...storedFields(create.firstPageView ?? {}),
  };
  let createdFieldsAt: Record<string, string> = {
    displayName: createdAt,
    avatarUrl: createdAt,
    ...Object.fromEntries(Object.keys(create.data).map((key) => [`data.${key}`, createdAt])),
  };
  const pending = [...(state.pending ?? [])].sort((a, b) =>
    normalizeTimestamp(a.updatedAt) < normalizeTimestamp(b.updatedAt) ? -1 : 1,
  );
  for (const update of pending) {
    const applied = applyUpdate(user, createdFieldsAt, update);
    user = applied.user;
    createdFieldsAt = applied.fieldsAt;
  }
  return { state: { revision: state.revision, user, fieldsAt: createdFieldsAt }, dirty: true };
}
