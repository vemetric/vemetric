import { getReferrerTypeLabel, REFERRER_TYPE_DESCRIPTIONS } from '@vemetric/common/sources';

interface ReferrerFields {
  referrer?: string;
  referrerUrl?: string;
  referrerType?: string;
}

// The source if there is one, otherwise the referrer type ("None" or "Internal").
export const getReferrerLabel = ({ referrer, referrerType }: ReferrerFields) =>
  referrer || getReferrerTypeLabel(referrerType || 'none');

export const getReferrerTooltip = ({ referrer, referrerUrl, referrerType }: ReferrerFields) => {
  const type = referrerType || 'none';
  if (referrer) {
    const via = referrerUrl ? `Referred via ${referrerUrl}` : 'Referred via a ref or utm_source parameter';
    return `${via} (type: ${getReferrerTypeLabel(type)})`;
  }
  const description = REFERRER_TYPE_DESCRIPTIONS[type] ?? getReferrerTypeLabel(type);
  return type === 'internal' && referrerUrl ? `${description}: ${referrerUrl}` : description;
};
