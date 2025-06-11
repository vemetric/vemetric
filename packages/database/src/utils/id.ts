import { customId16, customId21 } from '@vemetric/common/id';
import { createSiphash, createSiphashKey } from '@vemetric/common/siphash';

const projectIdKey = createSiphashKey('VMTRC_PROJE_ID!&');
const userIdKey = createSiphashKey('VMTRC_USERE_ID!&');

export function generateOrganizationId() {
  return customId16();
}

export function generateProjectId() {
  return createSiphash(projectIdKey, customId16());
}

interface GenerateUserIdOptions {
  projectId: bigint;
  ipAddress: string;
  userAgent: string;
  salt: string;
}

export function generateUserId(options?: GenerateUserIdOptions): bigint {
  if (!options) {
    return createSiphash(userIdKey, customId21());
  }

  const { projectId, ipAddress, userAgent, salt } = options;
  const data = `${projectId}:${ipAddress}:${userAgent}:${salt}`;
  return createSiphash(userIdKey, data);
}

export function generateSessionId() {
  return customId21();
}

export function generateToken() {
  return customId16();
}
