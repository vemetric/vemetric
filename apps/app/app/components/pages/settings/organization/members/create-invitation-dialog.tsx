import { Box, Button, Text } from '@chakra-ui/react';
import { INVITATION_EXPIRY_MS } from '@vemetric/common/organization';
import { useState } from 'react';
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogCloseTrigger,
} from '~/components/ui/dialog';
import { toaster } from '~/components/ui/toaster';
import { useCurrentOrganization } from '~/hooks/use-current-organization';
import { trpc } from '~/utils/trpc';
import { getAppUrl } from '~/utils/url';
import { MemberBadge } from './member-badge';
import { MemberRoleAlert } from './member-role-alert';
import { ProjectAccessSelector } from './project-access-selector';

interface Props {
  organizationId: string;
  role: 'ADMIN' | 'MEMBER' | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateInvitationDialog = (props: Props) => {
  const { organizationId, role, onClose, onSuccess } = props;
  const { currentOrgaProjects: projects } = useCurrentOrganization();

  const [hasRestrictions, setHasRestrictions] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const { mutate: createInvitation, isPending } = trpc.organization.createInvitation.useMutation({
    onSuccess: async (data) => {
      const inviteUrl = `${getAppUrl()}/invite/${data.invitation.token}`;
      await navigator.clipboard.writeText(inviteUrl);
      toaster.create({
        title: 'Invitation link created and copied to clipboard',
        type: 'success',
      });
      onSuccess();
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
    setHasRestrictions(enabled);
    if (!enabled) {
      setSelectedProjectIds([]);
    }
  };

  const handleCreate = () => {
    // For MEMBER with restrictions, pass the selected project IDs
    // For ADMIN or MEMBER without restrictions, don't pass projectIds (full access)
    const projectIds = role === 'MEMBER' && hasRestrictions ? selectedProjectIds : [];
    createInvitation({ organizationId, role: role!, projectIds, hasRestrictions });
  };

  if (!role) {
    return null;
  }

  const showProjectSelection = role === 'MEMBER' && projects.length > 0;

  return (
    <DialogRoot open onOpenChange={onClose}>
      <DialogContent mt={20}>
        <DialogHeader>
          <DialogTitle>Create Invitation Link</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Text mb={3}>
            Create an invitation link for a new <MemberBadge role={role} />? The link will be copied to your clipboard
            and expires in {INVITATION_EXPIRY_MS / (1000 * 60 * 60 * 24)} days.
          </Text>
          <MemberRoleAlert role={role} />

          {showProjectSelection && (
            <Box mt={4} pt={4} borderTop="1px solid" borderColor="border.muted">
              <ProjectAccessSelector
                projects={projects}
                selectedProjectIds={selectedProjectIds}
                onSelectionChange={setSelectedProjectIds}
                hasRestrictions={hasRestrictions}
                onRestrictionsChange={handleRestrictionsChange}
                fullAccessText="The invited user will have access to all projects in the organization."
                restrictTooltip="When enabled, the invited user will only have access to the selected projects. Newly created projects won't be automatically added."
              />
            </Box>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button colorPalette="purple" loading={isPending} onClick={handleCreate}>
            Create & Copy Link
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};
