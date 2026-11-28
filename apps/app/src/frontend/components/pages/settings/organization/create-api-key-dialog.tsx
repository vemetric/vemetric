import { Box, Button, Field, Input } from '@chakra-ui/react';
import { useState } from 'react';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog';
import { toaster } from '@/components/ui/toaster';
import { useCurrentOrganization } from '@/hooks/use-current-organization';
import { trpc } from '@/utils/trpc';
import { ProjectAccessSelector } from './members/project-access-selector';

interface Props {
  organizationId: string;
  onClose: () => void;
  onCreated: (rawKey: string) => void;
}

export const CreateApiKeyDialog = ({ organizationId, onClose, onCreated }: Props) => {
  const { currentOrgaProjects: projects } = useCurrentOrganization();
  const [name, setName] = useState('');
  const [hasRestrictions, setHasRestrictions] = useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);

  const { mutate: createKey, isPending } = trpc.apiKeys.createOrganizationKey.useMutation({
    onSuccess: (result) => onCreated(result.rawKey),
    onError: (error) => {
      toaster.create({
        title: 'Error',
        description: error.message,
        type: 'error',
      });
    },
  });

  const onCreate = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toaster.create({ title: 'Error', description: 'Please provide a key name', type: 'error' });
      return;
    }
    if (hasRestrictions && selectedProjectIds.length === 0) {
      toaster.create({ title: 'Error', description: 'Please choose at least one project', type: 'error' });
      return;
    }

    createKey({
      organizationId,
      name: trimmedName,
      allProjects: !hasRestrictions,
      projectIds: hasRestrictions ? selectedProjectIds : [],
    });
  };

  return (
    <DialogRoot open onOpenChange={onClose}>
      <DialogContent as="form" onSubmit={onCreate} mt={20}>
        <DialogHeader>
          <DialogTitle>Create Organization API Key</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Field.Root>
            <Field.Label>Key Name</Field.Label>
            <Input
              placeholder="Enter a name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              disabled={isPending}
            />
          </Field.Root>
          <Box mt={4} pt={4} borderTop="1px solid" borderColor="border.muted">
            <ProjectAccessSelector
              projects={projects}
              selectedProjectIds={selectedProjectIds}
              onSelectionChange={setSelectedProjectIds}
              hasRestrictions={hasRestrictions}
              onRestrictionsChange={(enabled) => {
                setHasRestrictions(enabled);
                if (!enabled) {
                  setSelectedProjectIds([]);
                }
              }}
              disabled={isPending}
              fullAccessText="The key will have access to all current and future projects in the organization."
              restrictTooltip="When enabled, the key will only have access to the selected projects. Newly created projects won't be automatically added."
            />
          </Box>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" colorPalette="purple" loading={isPending}>
            Create API Key
          </Button>
        </DialogFooter>
        <DialogCloseTrigger />
      </DialogContent>
    </DialogRoot>
  );
};
