import { Box, Flex, Text, Button, Spinner } from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TbShieldCheck } from 'react-icons/tb';
import { toaster } from '@/components/ui/toaster';
import { useCurrentOrganization } from '@/hooks/use-current-organization';
import { trpc } from '@/utils/trpc';
import { ProjectAccessSelector } from './project-access-selector';

interface Props {
  userId: string;
  userName: string;
  role: 'ADMIN' | 'MEMBER';
  isCurrentUser: boolean;
  onClose: () => void;
}

export const MemberProjectAccess = (props: Props) => {
  const { userId, role, isCurrentUser, onClose } = props;
  const { organizationId, currentOrgaProjects: projects, isPending } = useCurrentOrganization();

  const isAdmin = role === 'ADMIN';
  const canEdit = !isCurrentUser && !isAdmin;

  const utils = trpc.useUtils();

  const { data, isLoading, refetch } = trpc.organization.memberProjectAccess.useQuery(
    { organizationId, userId },
    { enabled: !isAdmin },
  );

  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [hasRestrictions, setHasRestrictions] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!data || isInitialized.current) return;
    isInitialized.current = true;

    setSelectedProjectIds(data.accessibleProjectIds);
    setHasRestrictions(data.hasRestrictions);
  }, [data]);

  const { mutate: updateAccess, isPending: isSaving } = trpc.organization.updateMemberProjectAccess.useMutation({
    onSuccess: () => {
      toaster.create({
        title: 'Project access updated',
        type: 'success',
      });
      refetch();
      // Also invalidate members query to update the badge
      utils.organization.members.invalidate({ organizationId });
      setIsDirty(false);
    },
    onError: (error) => {
      toaster.create({
        title: 'Error',
        description: error.message,
        type: 'error',
      });
    },
  });

  const handleRestrictionsChange = (enabled: boolean) => {
    if (!canEdit) return;
    setHasRestrictions(enabled);
    if (!enabled && data) {
      setSelectedProjectIds(projects.map((p) => p.id));
    }
    setIsDirty(true);
  };

  const handleSelectionChange = (projectIds: string[]) => {
    if (!canEdit) return;
    setSelectedProjectIds(projectIds);
    setIsDirty(true);
  };

  const handleSave = () => {
    updateAccess({
      organizationId,
      userId,
      projectIds: selectedProjectIds,
      hasRestrictions,
    });
  };

  // Filter projects to show for read-only view (current user seeing their own restricted access)
  const projectsToShow = useMemo(() => {
    if (!data) return [];
    if (isCurrentUser && hasRestrictions) {
      return projects.filter((p) => selectedProjectIds.includes(p.id));
    }
    return projects;
  }, [data, isCurrentUser, hasRestrictions, selectedProjectIds, projects]);

  if (!isAdmin && (isLoading || isPending)) {
    return (
      <Box py={4} textAlign="center">
        <Spinner size="sm" />
      </Box>
    );
  }

  if (!isAdmin && !data) {
    return null;
  }

  return (
    <Box py={3} px={4} bg="bg.muted" borderTop="1px solid" borderColor="border.muted">
      {isAdmin ? (
        <>
          <Flex align="center" gap={2} mb={3}>
            <Box color="purple.fg">
              <TbShieldCheck size={18} />
            </Box>
            <Text fontSize="sm" fontWeight="medium">
              {isCurrentUser ? 'Your Project Access' : 'Project Access'}
            </Text>
          </Flex>
          <Text fontSize="sm" color="fg.muted">
            {isCurrentUser
              ? 'As an admin, you have access to all projects in the organization.'
              : 'Admins always have access to all projects in the organization. To restrict project access, first change this user\'s role to "Member".'}
          </Text>
        </>
      ) : (
        <Flex direction="column" gap={3}>
          <ProjectAccessSelector
            projects={projectsToShow}
            selectedProjectIds={selectedProjectIds}
            onSelectionChange={handleSelectionChange}
            hasRestrictions={hasRestrictions}
            onRestrictionsChange={handleRestrictionsChange}
            disabled={!canEdit}
            fullAccessText='This user has access to all projects in the organization. Enable "Restrict access" to limit which projects they can view.'
            restrictTooltip="When enabled, newly created projects will not be automatically added to this user's access list."
          />

          {canEdit && (
            <Flex justify="flex-end" gap={2}>
              <Button size="sm" variant="ghost" onClick={onClose}>
                Cancel
              </Button>
              <Button size="sm" colorPalette="purple" onClick={handleSave} loading={isSaving} disabled={!isDirty}>
                Save Changes
              </Button>
            </Flex>
          )}
        </Flex>
      )}
    </Box>
  );
};
