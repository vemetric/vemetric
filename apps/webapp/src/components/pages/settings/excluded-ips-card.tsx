import { Card, Button, Field, Flex, Stack, Text, Badge, HStack, Icon, Input, Spinner } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { TbBan, TbX } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { toaster } from '@/components/ui/toaster';
import { trpc } from '@/utils/trpc';

interface Props {
  projectId: string;
  initialExcludedIps?: string[];
}

export const ExcludedIpsCard = (props: Props) => {
  const { projectId, initialExcludedIps = [] } = props;
  const [excludedIpValue, setExcludedIpValue] = useState('');
  const [removedIp, setRemovedIp] = useState('');
  const [excludedIps, setExcludedIps] = useState<string[]>(initialExcludedIps);

  useEffect(() => {
    setExcludedIps(initialExcludedIps);
  }, [initialExcludedIps]);

  const utils = trpc.useUtils();

  const { mutate: addExcludedIp, isLoading: isAddingIp } = trpc.projects.addExcludedIp.useMutation({
    onSuccess: (data) => {
      setExcludedIps(data.excludedIps);
      setExcludedIpValue('');
      toaster.create({
        title: 'IP address excluded successfully',
        type: 'success',
      });
      // Invalidate the settings query to update the parent component
      utils.projects.settings.invalidate({ projectId });
    },
    onError: (error) => {
      let parsedZodError: unknown;
      try {
        parsedZodError = JSON.parse(error.message);
      } catch {
        parsedZodError = null;
      }

      if (Array.isArray(parsedZodError) && parsedZodError[0]?.validation === 'ip') {
        toaster.create({
          title: `Error`,
          description: `Please enter a valid IP address.`,
          type: 'error',
        });
        return;
      }

      toaster.create({
        title: 'Error',
        description: error.message,
        type: 'error',
      });
    },
  });

  const { mutate: removeExcludedIp, isLoading: isRemovingIp } = trpc.projects.removeExcludedIp.useMutation({
    onSuccess: (data) => {
      setExcludedIps(data.excludedIps);
      // Invalidate the settings query to update the parent component
      utils.projects.settings.invalidate({ projectId });
    },
    onError: (error) => {
      toaster.create({
        title: 'Error',
        description: error.message,
        type: 'error',
      });
    },
    onSettled: () => {
      setRemovedIp('');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedIp = excludedIpValue.trim();

    if (trimmedIp === '') {
      return; // Don't submit empty values
    }

    addExcludedIp({
      projectId,
      ip: trimmedIp,
    });
  };

  const removeIp = (ip: string) => {
    if (isRemovingIp) return;

    setRemovedIp(ip);
    removeExcludedIp({
      projectId,
      ip,
    });
  };

  return (
    <Card.Root>
      <Card.Header>
        <Flex align="center" gap={2}>
          <CardIcon>
            <TbBan />
          </CardIcon>
          <Text fontWeight="semibold">Excluded IP Addresses</Text>
        </Flex>
      </Card.Header>
      <Card.Body p={4} pb={3}>
        <Stack gap="3">
          <Field.Root>
            <Field.HelperText px="0.5">Add IP addresses to exclude from tracking</Field.HelperText>
            {excludedIps.length > 0 && (
              <HStack wrap="wrap" mt={2}>
                {excludedIps.map((ip) => (
                  <Badge
                    key={ip}
                    display="flex"
                    alignItems="center"
                    size="sm"
                    cursor="pointer"
                    className="group"
                    onClick={() => removeIp(ip)}
                  >
                    {ip}{' '}
                    {removedIp === ip ? (
                      <Spinner size="xs" />
                    ) : (
                      <Icon as={TbX} _groupHover={{ color: 'red.600', opacity: 0.8 }} />
                    )}
                  </Badge>
                ))}
              </HStack>
            )}
            <Flex as="form" gap={2} w="100%" onSubmit={handleSubmit}>
              <Input
                size="sm"
                value={excludedIpValue}
                onChange={(e) => {
                  setExcludedIpValue(e.target.value);
                }}
                placeholder="Enter an IP address"
                flex={1}
              />
              <Button size="sm" type="submit" loading={isAddingIp}>
                Exclude
              </Button>
            </Flex>
          </Field.Root>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
};
