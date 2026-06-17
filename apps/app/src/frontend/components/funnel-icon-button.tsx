import { TbChartFunnel } from 'react-icons/tb';
import type { CardIconProps } from './card-icon';
import { EmojiIconButton } from './emoji-icon-button';

interface Props extends CardIconProps {
  icon: string | null;
  onIconChange: (icon: string | null) => void;
}

export const FunnelIconButton = ({ icon, onIconChange, ...props }: Props) => {
  return <EmojiIconButton icon={icon} onIconChange={onIconChange} defaultIcon={<TbChartFunnel />} {...props} />;
};
