import { Image } from '@chakra-ui/react';
import { useState, type ReactNode } from 'react';
import { getFaviconUrl } from '@/utils/favicon';

interface Props {
  client: { icon: string | null; metadataHost: string | null };
  boxSize: string;
  rounded: string;
  /** Shown for apps without a logo, and when it can't be loaded. */
  fallback: ReactNode;
}

/**
 * The logo of an app connected via OAuth (e.g. Claude). Many client metadata documents don't name one (Claude's
 * doesn't), so their verified domain's favicon is shown instead. Dynamically registered apps have neither, since
 * they could pretend to be another app.
 */
export const OauthAppIcon = ({ client, boxSize, rounded, fallback }: Props) => {
  const [failed, setFailed] = useState(false);
  const src = client.icon ?? (client.metadataHost ? getFaviconUrl(client.metadataHost, 128) : null);

  if (!src || failed) {
    return <>{fallback}</>;
  }
  return <Image src={src} alt="" boxSize={boxSize} rounded={rounded} flexShrink={0} onError={() => setFailed(true)} />;
};
