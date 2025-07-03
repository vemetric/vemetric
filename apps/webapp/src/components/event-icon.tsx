import { TbBolt, TbEye, TbExternalLink } from 'react-icons/tb';

interface Props {
  name: string;
}

export const EventIcon = ({ name }: Props) => {
  let icon = <TbBolt />;
  if (name === '$$pageView') {
    icon = <TbEye />;
  } else if (name === '$$outboundLink') {
    icon = <TbExternalLink />;
  }

  return icon;
};
