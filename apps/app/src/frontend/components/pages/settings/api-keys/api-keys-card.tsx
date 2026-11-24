import { AbsoluteCenter, Badge, Box, Card, Flex, IconButton, Spinner, Switch, Table, Text } from '@chakra-ui/react';
import { useState, type ReactNode } from 'react';
import { TbKey, TbTrash } from 'react-icons/tb';
import { CardIcon } from '@/components/card-icon';
import { CodeBox } from '@/components/code-box';
import { EmptyState } from '@/components/ui/empty-state';
import { Tooltip } from '@/components/ui/tooltip';
import { UserIdentity } from '@/components/user-identity';
import { dateTimeFormatter } from '@/utils/date-time-formatter';

type KeyUser = { name: string | null; email: string; image: string | null } | null;

export interface ApiKeyRow {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string | Date;
  revokedAt: string | Date | null;
  createdBy: KeyUser;
  revokedBy: KeyUser;
}

interface Props<T extends ApiKeyRow> {
  keys: T[];
  isLoading: boolean;
  emptyTitle: string;
  onRevoke: (key: T) => void;
  /** An extra column, e.g. the projects an organization key covers. */
  extraColumn?: { header: string; render: (key: T) => ReactNode };
  headerAction?: ReactNode;
}

export const ApiKeysCard = <T extends ApiKeyRow>({
  keys,
  isLoading,
  emptyTitle,
  onRevoke,
  extraColumn,
  headerAction,
}: Props<T>) => {
  const [showRevokedKeys, setShowRevokedKeys] = useState(false);

  const activeKeys = keys.filter((key) => !key.revokedAt);
  const revokedKeys = keys.filter((key) => Boolean(key.revokedAt));
  const visibleKeys = showRevokedKeys ? [...activeKeys, ...revokedKeys] : activeKeys;

  return (
    <Card.Root>
      <Card.Header>
        <Flex align="center" gap={2}>
          <CardIcon>
            <TbKey />
          </CardIcon>
          <Text fontWeight="semibold">Keys</Text>
          {!isLoading && <Badge colorPalette="purple">{activeKeys.length}</Badge>}
          <Box flexGrow={1} />
          {headerAction}
        </Flex>
      </Card.Header>
      <Card.Body overflow="auto">
        {isLoading ? (
          <Box h="100px" pos="relative">
            <AbsoluteCenter>
              <Spinner />
            </AbsoluteCenter>
          </Box>
        ) : visibleKeys.length === 0 ? (
          <Box p={6} textAlign="center">
            <EmptyState icon={<TbKey />} title={emptyTitle} />
          </Box>
        ) : (
          <Table.Root size="sm" variant="outline" rounded="md">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Name</Table.ColumnHeader>
                <Table.ColumnHeader>Prefix</Table.ColumnHeader>
                {extraColumn && <Table.ColumnHeader>{extraColumn.header}</Table.ColumnHeader>}
                <Table.ColumnHeader>Status</Table.ColumnHeader>
                <Table.ColumnHeader w="80px">Actions</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {visibleKeys.map((key) => (
                <Table.Row
                  key={key.id}
                  css={{ '&:last-of-type > td': { borderBottom: 'none' } }}
                  opacity={key.revokedAt ? 0.65 : 1}
                >
                  <Table.Cell>{key.name}</Table.Cell>
                  <Table.Cell>
                    <CodeBox size="sm" disableCopy>
                      {key.keyPrefix}
                    </CodeBox>
                  </Table.Cell>
                  {extraColumn && <Table.Cell>{extraColumn.render(key)}</Table.Cell>}
                  <Table.Cell w="100px">
                    <Tooltip
                      content={
                        <Box py="1">
                          <Text fontSize="xs" mb={2}>
                            Created on {dateTimeFormatter.formatDate(key.createdAt)} by
                          </Text>
                          <UserIdentity
                            displayName={key.createdBy?.name || key.createdBy?.email || 'Unknown'}
                            image={key.createdBy?.image}
                            avatarSize="2xs"
                          />
                          {key.revokedAt && (
                            <>
                              <Text fontSize="xs" mt={5} mb={2}>
                                Revoked on {dateTimeFormatter.formatDate(key.revokedAt)} by
                              </Text>
                              <UserIdentity
                                displayName={key.revokedBy?.name || key.revokedBy?.email || 'Unknown'}
                                image={key.revokedBy?.image}
                                avatarSize="2xs"
                              />
                            </>
                          )}
                        </Box>
                      }
                    >
                      <Badge colorPalette={key.revokedAt ? 'red' : 'green'} cursor="help">
                        {key.revokedAt ? 'Revoked' : 'Active'}
                      </Badge>
                    </Tooltip>
                  </Table.Cell>
                  <Table.Cell>
                    {!key.revokedAt && (
                      <IconButton
                        aria-label="Revoke API key"
                        variant="ghost"
                        size="xs"
                        colorPalette="red"
                        onClick={() => onRevoke(key)}
                      >
                        <TbTrash />
                      </IconButton>
                    )}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        )}

        <Flex mt={4} align="center" justify="flex-end" gap={2}>
          <Switch.Root
            size="sm"
            checked={showRevokedKeys}
            onCheckedChange={({ checked }) => setShowRevokedKeys(checked)}
          >
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="xs" color="fg.subtle">
              Show revoked keys
            </Switch.Label>
          </Switch.Root>
        </Flex>
      </Card.Body>
    </Card.Root>
  );
};
