import { useCallback, useState } from 'react';
import { Helmet } from 'react-helmet';
import { v4 as uuidv4 } from 'uuid';

interface Props {
  src: string;
  onLoad?: () => void;
  defer?: boolean;
}

export const HelmetScript = ({ src, onLoad, defer }: Props) => {
  const [uid] = useState(uuidv4());

  const onChangeClientState = useCallback(() => {
    const scriptElem = document.getElementById(uid);
    if (scriptElem !== null && onLoad) {
      scriptElem.onload = onLoad;
    }
  }, [onLoad, uid]);

  return (
    <Helmet onChangeClientState={onChangeClientState}>
      <script id={uid} src={src} defer={defer} />
    </Helmet>
  );
};
