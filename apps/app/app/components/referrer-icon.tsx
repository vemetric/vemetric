import type { ISources } from '@vemetric/common/sources';
import { TbQuestionMark, TbDirectionSign, TbSearch, TbSocial, TbAi, TbAd, TbMail } from 'react-icons/tb';
import { getFaviconUrl } from '~/utils/favicon';
import { LoadingImage } from './loading-image';

interface Props {
  source: ISources;
  referrer?: string;
  referrerUrl: string;
  referrerType?: string;
}

export const ReferrerIcon = ({ source = 'referrer', referrer, referrerUrl, referrerType }: Props) => {
  if (!source.startsWith('referrer')) {
    return null;
  }

  const isDirect = source === 'referrer' && referrer === '';

  if (source === 'referrer' || source === 'referrerUrl') {
    return (
      <>
        {isDirect ? (
          <TbDirectionSign />
        ) : (
          <LoadingImage src={getFaviconUrl(referrerUrl || referrer || '')} alt={referrer + ' Favicon'} boxSize="16px" />
        )}
      </>
    );
  }

  return <ReferrerTypeIcon referrerType={referrerType} />;
};

export const ReferrerTypeIcon = ({ referrerType }: { referrerType?: string }) => {
  switch (referrerType) {
    case 'direct':
      return <TbDirectionSign />;
    case 'search':
      return <TbSearch />;
    case 'social':
      return <TbSocial />;
    case 'llm':
      return <TbAi />;
    case 'paid':
      return <TbAd />;
    case 'email':
      return <TbMail />;
    default:
      return <TbQuestionMark />;
  }
};
