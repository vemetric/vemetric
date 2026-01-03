import { customId16, customId21 } from '@vemetric/common/id';
import { createSiphash, createSiphashKey } from '@vemetric/common/siphash';
import { customAlphabet } from 'nanoid';

const projectIdKey = createSiphashKey('VMTRC_PROJE_ID!&');
const userIdKey = createSiphashKey('VMTRC_USERE_ID!&');

const apiKeyAlphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const customId32 = customAlphabet(apiKeyAlphabet, 32);

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
  const data = `${String(projectId)}:${ipAddress}:${userAgent}:${salt}`;
  return createSiphash(userIdKey, data);
}

export function generateSessionId() {
  return customId21();
}

export function generateToken() {
  return customId16();
}

export function generateApiKey(): { key: string; prefix: string } {
  const randomPart = customId32();
  const key = `vm_sk_${randomPart}`;
  const prefix = key.slice(0, 10);
  return { key, prefix };
}
