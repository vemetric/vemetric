import { Button, Flex, Text } from '@chakra-ui/react';
import { TbAlertTriangle } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import {
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  keyName: string | null;
  isRevoking: boolean;
  onRevoke: () => void;
  onClose: () => void;
}

export const RevokeApiKeyDialog = ({ keyName, isRevoking, onRevoke, onClose }: Props) => (
  <DialogRoot open={keyName !== null} onOpenChange={onClose}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Revoke API Key</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <Flex gap={2} align="flex-start">
          <CardIcon bg="red.subtle" color="red.600" borderColor="red.muted">
            <TbAlertTriangle />
          </CardIcon>
          <Text fontSize="sm">
            Revoke key <strong>{keyName}</strong>? Existing integrations using this key will stop working immediately.
          </Text>
        </Flex>
      </DialogBody>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button colorPalette="red" loading={isRevoking} onClick={onRevoke}>
          Revoke Key
        </Button>
      </DialogFooter>
      <DialogCloseTrigger />
    </DialogContent>
  </DialogRoot>
);
