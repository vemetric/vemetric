import { Badge } from '@chakra-ui/react';

interface Props {
  role: 'ADMIN' | 'MEMBER';
}

export const MemberBadge = ({ role }: Props) => {
  return <Badge colorPalette={role === 'ADMIN' ? 'purple' : 'gray'}>{role}</Badge>;
};
