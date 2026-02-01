import { useState, type PropsWithChildren } from 'react';
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from '@/components/ui/menu';
import { trpc } from '@/utils/trpc';
import { CreateInvitationDialog } from './create-invitation-dialog';

interface Props {
  organizationId: string;
}

export const CreateInvitationMenu = ({ organizationId, children }: PropsWithChildren<Props>) => {
  const [createInviteRole, setCreateInviteRole] = useState<'ADMIN' | 'MEMBER' | null>(null);
  const utils = trpc.useUtils();

  return (
    <>
      <MenuRoot>
        <MenuTrigger asChild>{children}</MenuTrigger>
        <MenuContent portalled={false}>
          <MenuItem value="member" onClick={() => setCreateInviteRole('MEMBER')}>
            Invite as Member
          </MenuItem>
          <MenuItem value="admin" onClick={() => setCreateInviteRole('ADMIN')}>
            Invite as Admin
          </MenuItem>
        </MenuContent>
      </MenuRoot>

      <CreateInvitationDialog
        organizationId={organizationId}
        role={createInviteRole}
        onClose={() => setCreateInviteRole(null)}
        onSuccess={() => {
          utils.organization.invitations.invalidate({ organizationId });
          setCreateInviteRole(null);
        }}
      />
    </>
  );
};
