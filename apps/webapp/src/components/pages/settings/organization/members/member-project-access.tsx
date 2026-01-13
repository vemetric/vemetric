import { Box, Flex, Text, Button, Spinner, Switch, Listbox, createListCollection } from '@chakra-ui/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { TbCheckbox, TbShieldCheck, TbShieldLock, TbSquare } from 'react-icons/tb';
import { LoadingImage } from '@/components/loading-image';
import { toaster } from '@/components/ui/toaster';
import { Tooltip } from '@/components/ui/tooltip';
import { useCurrentOrganization } from '@/hooks/use-current-organization';
import { getFaviconUrl } from '@/utils/favicon';
import { trpc } from '@/utils/trpc';

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

  const toggleRestrictions = (enabled: boolean) => {
    if (!canEdit) return;
    setHasRestrictions(enabled);
    if (!enabled && data) {
      setSelectedProjectIds(projects.map((p) => p.id));
    }
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

  const handleValueChange = (details: { value: string[] }) => {
    if (!canEdit) return;
    setSelectedProjectIds(details.value);
    setIsDirty(true);
  };

  const selectAll = () => {
    if (data && canEdit) {
      setSelectedProjectIds(projects.map((p) => p.id));
      setIsDirty(true);
    }
  };

  const selectNone = () => {
    if (canEdit) {
      setSelectedProjectIds([]);
      setIsDirty(true);
    }
  };

  // Create the collection for the Listbox
  const projectsToShow = useMemo(() => {
    if (!data) return [];
    if (isCurrentUser && hasRestrictions) {
      return projects.filter((p) => selectedProjectIds.includes(p.id));
    }
    return projects;
  }, [data, isCurrentUser, hasRestrictions, selectedProjectIds, projects]);

  const collection = useMemo(
    () =>
      createListCollection({
        items: projectsToShow.map((p) => ({
          label: p.name,
          value: p.id,
          domain: p.domain,
        })),
      }),
    [projectsToShow],
  );

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

  const allSelected = data && projects.length > 0 && selectedProjectIds.length === projects.length;
  const noneSelected = selectedProjectIds.length === 0;

  return (
    <Box py={3} px={4} bg="bg.muted" borderTop="1px solid" borderColor="border.muted">
      <Flex justify="space-between" align="center" mb={3}>
        <Flex align="center" gap={2}>
          <Box color="purple.fg">
            {isAdmin || !hasRestrictions ? <TbShieldCheck size={18} /> : <TbShieldLock size={18} />}
          </Box>
          <Text fontSize="sm" fontWeight="medium">
            {isCurrentUser ? 'Your Project Access' : 'Project Access'}
          </Text>
        </Flex>

        {canEdit && (
          <Tooltip
            content="When enabled, newly created projects will not be automatically added to this user's access list."
            closeOnClick={false}
          >
            <Box>
              <Switch.Root
                colorPalette="purple"
                size="sm"
                checked={hasRestrictions}
                onCheckedChange={(e) => toggleRestrictions(e.checked)}
              >
                <Switch.HiddenInput />
                <Switch.Label fontSize="sm" color="fg.muted">
                  Restrict access
                </Switch.Label>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Root>
            </Box>
          </Tooltip>
        )}
      </Flex>

      <Flex direction="column" gap={3}>
        {isAdmin ? (
          <Text fontSize="sm" color="fg.muted">
            {isCurrentUser
              ? 'As an admin, you have access to all projects in the organization.'
              : 'Admins always have access to all projects in the organization. To restrict project access, first change this user\'s role to "Member".'}
          </Text>
        ) : !hasRestrictions ? (
          <Text fontSize="sm" color="fg.muted">
            This user has access to all projects in the organization. Enable &quot;Restrict access&quot; to limit which
            projects they can view.
          </Text>
        ) : (
          <>
            {canEdit && (
              <Flex gap={2}>
                <Button size="xs" variant="surface" onClick={selectAll} disabled={allSelected}>
                  <TbCheckbox /> Select all
                </Button>
                <Button size="xs" variant="surface" onClick={selectNone} disabled={noneSelected}>
                  <TbSquare /> Select none
                </Button>
              </Flex>
            )}

            {projectsToShow.length === 0 ? (
              <Text fontSize="sm" color="fg.muted">
                No projects in this organization yet.
              </Text>
            ) : (
              <Listbox.Root
                collection={collection}
                selectionMode="multiple"
                value={selectedProjectIds}
                onValueChange={handleValueChange}
                disabled={!canEdit}
              >
                <Listbox.Content maxH="200px" borderWidth="1px" rounded="md">
                  {collection.items.map((project) => (
                    <Listbox.Item item={project} key={project.value} rounded="md">
                      <Flex align="center" gap={3} flex="1">
                        <LoadingImage
                          src={getFaviconUrl(project.domain)}
                          alt={project.label}
                          boxSize="24px"
                          rounded="md"
                          overflow="hidden"
                        />
                        <Box>
                          <Listbox.ItemText fontSize="sm" fontWeight="medium">
                            {project.label}
                          </Listbox.ItemText>
                          <Text fontSize="xs" color="fg.muted">
                            {project.domain}
                          </Text>
                        </Box>
                      </Flex>
                      <Listbox.ItemIndicator color="purple.fg" />
                    </Listbox.Item>
                  ))}
                </Listbox.Content>
              </Listbox.Root>
            )}
          </>
        )}

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
    </Box>
  );
};
