import { Button, Field, Input, Stack, Text } from '@chakra-ui/react';
import { useState } from 'react';
import { TbNetwork, TbDashboard } from 'react-icons/tb';
import {
  DialogActionTrigger,
  DialogBody,
  DialogCloseTrigger,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
  DialogBackdrop,
} from '@/components/ui/dialog';
import { useCreateProject } from '@/hooks/use-create-project';
import { InputGroup } from './ui/input-group';
import { Tooltip } from './ui/tooltip';

interface CreateProjectDialogProps {
  children?: React.ReactNode;
  open?: boolean;
  setOpen?: (open: boolean) => void;
}

export const CreateProjectDialog = ({ children, open: _open, setOpen: _setOpen }: CreateProjectDialogProps) => {
  const [open, setOpen] = useState(false);
  const { isLoading, projectName, setProjectName, domain, setDomain, onSubmit } = useCreateProject({
    onSuccess: () => {
      (_setOpen ?? setOpen)(false);
      setProjectName('');
      setDomain('');
    },
  });

  return (
    <DialogRoot
      placement={{ base: 'top', md: 'center' }}
      size="md"
      open={_open ?? open}
      onOpenChange={({ open }) => {
        (_setOpen ?? setOpen)(open);
      }}
    >
      <DialogBackdrop />
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent as="form" onSubmit={onSubmit}>
        <DialogHeader>
          <Stack gap="1">
            <DialogTitle fontWeight="medium">Let&apos;s create a new Project</DialogTitle>
            <DialogDescription>We&apos;re excited to help you gain more insights!</DialogDescription>
          </Stack>
        </DialogHeader>
        <DialogBody px="6">
          <Stack gap={{ base: '6', md: '8' }}>
            <Stack gap={{ base: '4', md: '6' }}>
              <Field.Root>
                <Field.Label>Project Name</Field.Label>
                <InputGroup startElement={<TbDashboard />} width="full">
                  <Input
                    placeholder="Wonka's Chocolate Factory"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    disabled={isLoading}
                  />
                </InputGroup>
              </Field.Root>
              <Field.Root>
                <Field.Label>Domain</Field.Label>
                <Tooltip
                  positioning={{ placement: 'bottom-start' }}
                  closeOnClick={false}
                  closeOnPointerDown={false}
                  closeOnScroll={false}
                  content={
                    <>
                      <Text>
                        Vemetric supports tracking across subdomains. (e.g. your landing page is on example.com, and
                        your app is on dashboard.example.com)
                      </Text>
                      <Text mt={2}>Therefore we&apos;d suggest to use the root domain for your project.</Text>
                    </>
                  }
                >
                  <InputGroup startElement={<TbNetwork />} width="full">
                    <Input
                      placeholder="example.com"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      disabled={isLoading}
                    />
                  </InputGroup>
                </Tooltip>
              </Field.Root>
            </Stack>
          </Stack>
        </DialogBody>
        <DialogFooter>
          <DialogActionTrigger asChild>
            <Button variant="outline" colorPalette="gray" disabled={isLoading}>
              Cancel
            </Button>
          </DialogActionTrigger>
          <Button type="submit" colorPalette="purple" loading={isLoading}>
            Submit
          </Button>
        </DialogFooter>
        <DialogCloseTrigger colorPalette="gray" />
      </DialogContent>
    </DialogRoot>
  );
};
