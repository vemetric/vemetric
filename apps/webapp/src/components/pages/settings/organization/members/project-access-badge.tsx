import { Badge } from '@chakra-ui/react';
import { TbShieldLock } from 'react-icons/tb';
import { useCurrentOrganization } from '@/hooks/use-current-organization';

interface Props {
  projectAccess: {
    hasFullAccess: boolean;
    accessibleCount: number;
  };
}

export const ProjectAccessBadge = ({ projectAccess }: Props) => {
  const { currentOrgaProjects } = useCurrentOrganization();

  return (
    <Badge size="xs" variant="subtle" colorPalette={projectAccess.hasFullAccess ? 'green' : 'orange'}>
      {!projectAccess.hasFullAccess && <TbShieldLock style={{ display: 'inline', verticalAlign: 'middle' }} />}
      {projectAccess.hasFullAccess
        ? 'All projects'
        : `${projectAccess.accessibleCount}/${currentOrgaProjects.length} projects`}
    </Badge>
  );
};
