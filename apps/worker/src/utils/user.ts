import type { UpdateUserDataModel } from '@vemetric/queues/update-user-queue';
import type { ClickhouseEvent } from 'clickhouse';

export const getUpdatedUserData = (existingUserData: object, newUserData: UpdateUserDataModel) => {
  const { set, setOnce, unset } = newUserData ?? {};
  const updatedUserData = { ...setOnce, ...existingUserData, ...set };

  if (unset) {
    unset.forEach((prop) => {
      delete (updatedUserData as any)[prop];
    });
  }

  return updatedUserData;
};

export const getUserFirstPageViewData = (firstPageView: ClickhouseEvent | null) => {
  if (!firstPageView) {
    return {};
  }

  return {
    firstSeenAt: firstPageView.createdAt,
    countryCode: firstPageView.countryCode,
    city: firstPageView.city,
    initialDeviceId: firstPageView.deviceId,
    userAgent: firstPageView.userAgent,
    referrer: firstPageView.referrer,
    referrerUrl: firstPageView.referrerUrl,
    referrerType: firstPageView.referrerType,

    origin: firstPageView.origin,
    pathname: firstPageView.pathname,
    urlHash: firstPageView.urlHash,
    queryParams: firstPageView.queryParams,

    utmSource: firstPageView.utmSource,
    utmMedium: firstPageView.utmMedium,
    utmCampaign: firstPageView.utmCampaign,
    utmContent: firstPageView.utmContent,
    utmTerm: firstPageView.utmTerm,
  };
};
