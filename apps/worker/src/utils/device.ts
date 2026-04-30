import type { DeviceData } from 'clickhouse';
import { clickhouseDevice } from 'clickhouse';
import { UAParser } from 'ua-parser-js';
import { logJobStep } from './job-logger';

export const UNKNOWN = 'Unknown';

const TABLET_REGEX = /ipad|android(?!.*mobile)|tablet/i;

export async function getDeviceDataFromHeaders(headers: Record<string, string>): Promise<DeviceData> {
  const plainResult = UAParser(headers);
  const result = await UAParser(headers).withClientHints();
  const lowerCaseUserAgent = headers['user-agent']?.toLowerCase() || '';

  const isServer = !(result.browser.name || plainResult.browser.name);
  let deviceType = (result.device.type || plainResult.device.type || 'unknown') as DeviceData['deviceType'];
  if (deviceType === 'unknown') {
    const browserName = (result.browser.name || plainResult.browser.name || '').toLowerCase();
    if (browserName.includes('mobile') || lowerCaseUserAgent.includes('iPhone')) {
      deviceType = 'mobile';
    } else if (TABLET_REGEX.test(lowerCaseUserAgent)) {
      deviceType = 'tablet';
    } else if (lowerCaseUserAgent.includes('Android')) {
      deviceType = 'mobile';
    } else if (!isServer) {
      deviceType = 'desktop';
    }
  }

  let clientName = result.browser.name || plainResult.browser.name || UNKNOWN;

  if (
    result.browser.name === 'Chromium' ||
    result.browser.name === 'Win32' ||
    result.browser.name === '`Chrome`' ||
    result.browser.name === 'Opera Mobi' ||
    (result.browser.name === 'Chrome WebView' && plainResult.browser.version === 'Opera GX') ||
    result.browser.name === 'content_shell' ||
    result.browser.name === UNKNOWN
  ) {
    // these values work better when not working with the Sec-CH Headers, therefore we use the plainResult (only detected via UserAgent)
    clientName = plainResult.browser.name || result.browser.name || UNKNOWN;
  }

  const deviceData: DeviceData = {
    osName: result.os.name || plainResult.os.name || UNKNOWN,
    osVersion: result.os.version || plainResult.os.version || UNKNOWN,
    clientName,
    clientVersion: plainResult.browser.version || result.browser.version || UNKNOWN,
    clientType: isServer ? 'server' : 'browser',
    deviceType,
  };

  return deviceData;
}

export async function insertDeviceIfNotExists(
  projectId: bigint,
  userId: bigint,
  deviceId: bigint,
  deviceData: DeviceData,
  job?: { log: (row: string) => Promise<number> },
) {
  await logJobStep(job, 'device before clickhouseDevice.exists', { projectId, userId, deviceId });
  const deviceExists = await clickhouseDevice.exists(projectId, deviceId);
  await logJobStep(
    job,
    deviceExists ? 'device after clickhouseDevice.exists existing' : 'device after clickhouseDevice.exists missing',
    {
      projectId,
      userId,
      deviceId,
    },
  );
  if (deviceExists) {
    return;
  }

  await logJobStep(job, 'device before clickhouseDevice.insert', {
    projectId,
    userId,
    deviceId,
    osName: deviceData.osName,
    osVersion: deviceData.osVersion,
    clientName: deviceData.clientName,
    clientVersion: deviceData.clientVersion,
    clientType: deviceData.clientType,
    deviceType: deviceData.deviceType,
  });
  await clickhouseDevice.insert([
    {
      projectId,
      userId,
      id: deviceId,
      osName: deviceData.osName,
      osVersion: deviceData.osVersion,
      clientName: deviceData.clientName,
      clientType: deviceData.clientType,
      clientVersion: deviceData.clientVersion,
      deviceType: deviceData.deviceType,
    },
  ]);
  await logJobStep(job, 'device after clickhouseDevice.insert', { projectId, userId, deviceId });
}
