import { createSiphash, createSiphashKey } from '@vemetric/common/siphash';
import type { DeviceData } from '../models/device';

const deviceIdKey = createSiphashKey('VMTRC_DEVIC_ID&!');

export function getDeviceId(projectId: bigint, userId: bigint, data: DeviceData) {
  return createSiphash(
    deviceIdKey,
    String(projectId) +
      String(userId) +
      data.osName +
      data.osVersion +
      data.clientName +
      data.clientVersion +
      data.clientType +
      data.deviceType,
  );
}
