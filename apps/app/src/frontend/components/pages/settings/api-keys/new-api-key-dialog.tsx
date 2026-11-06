import { Button, Flex, Text } from '@chakra-ui/react';
import { CodeBox } from '@/components/code-box';
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
  rawKey: string | null;
  onClose: () => void;
}

export const NewApiKeyDialog = ({ rawKey, onClose }: Props) => (
  <DialogRoot open={Boolean(rawKey)} onOpenChange={onClose}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Copy API Key</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <Flex direction="column" gap={3}>
          <Text fontSize="sm" color="fg.muted">
            This is the only time the full key is shown.
            <br />
            Copy it now and store it securely.
          </Text>
          {rawKey && <CodeBox>{rawKey}</CodeBox>}
        </Flex>
      </DialogBody>
      <DialogFooter>
        <Button onClick={onClose}>Done</Button>
      </DialogFooter>
      <DialogCloseTrigger />
    </DialogContent>
  </DialogRoot>
);
