import { Card, Button, Field, Flex, Stack, Text, Badge, HStack, Icon, Input, Spinner } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { TbBan, TbUser, TbX } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { toaster } from '@/components/ui/toaster';
import { Tooltip } from '@/components/ui/tooltip';
import { trpc } from '@/utils/trpc';

interface Props {
  projectId: string;
  currentIp: string | null;
  initialExcludedIps?: string[];
}

export const ExcludedIpsCard = (props: Props) => {
  const { projectId, currentIp, initialExcludedIps = [] } = props;
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

  const excludeIp = (ip: string, onSuccess?: () => void) => {
    const trimmedIp = ip.trim();

    if (trimmedIp === '') {
      return; // Don't submit empty values
    }

    addExcludedIp(
      {
        projectId,
        ip: trimmedIp,
      },
      { onSuccess },
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    excludeIp(excludedIpValue, () => {
      setExcludedIpValue('');
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
                  <Tooltip
                    key={ip}
                    content="This is your current IP address"
                    disabled={ip !== currentIp}
                    positioning={{ placement: 'top' }}
                  >
                    <Badge
                      colorPalette={ip === currentIp ? 'purple' : 'gray'}
                      display="flex"
                      alignItems="center"
                      size="sm"
                      cursor="pointer"
                      className="group"
                      onClick={() => removeIp(ip)}
                    >
                      {ip === currentIp && <Icon as={TbUser} />}
                      {ip}{' '}
                      {removedIp === ip ? (
                        <Spinner size="xs" />
                      ) : (
                        <Icon as={TbX} _groupHover={{ color: 'red.600', opacity: 0.8 }} />
                      )}
                    </Badge>
                  </Tooltip>
                ))}
              </HStack>
            )}
            <Flex as="form" gap={2} w="100%" onSubmit={handleSubmit}>
              <Input
                size="sm"
                disabled={isAddingIp}
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
          {currentIp && !excludedIps.includes(currentIp) && (
            <Flex align="center" gap={2} flexWrap="wrap">
              <Text fontSize="sm" opacity={0.7}>
                Your current IP address is:
              </Text>
              <Badge colorPalette="purple">{currentIp}</Badge>
              <Button size="2xs" variant="subtle" loading={isAddingIp} onClick={() => excludeIp(currentIp)}>
                Exclude it
              </Button>
            </Flex>
          )}
        </Stack>
      </Card.Body>
    </Card.Root>
  );
};
