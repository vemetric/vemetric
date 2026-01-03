import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { useNavigate } from '@tanstack/react-router';
import { TbBuilding, TbCheck, TbChevronDown, TbPlus } from 'react-icons/tb';
import { authClient } from '@/utils/auth';
import { MenuContent, MenuItem, MenuItemGroup, MenuRoot, MenuSeparator, MenuTrigger } from './ui/menu';

interface Props {
  currentOrganization?: { id: string; name: string };
  organizations: Array<{ id: string; name: string }>;
  onSwitchOrganization: (orgId: string) => void;
  onCreateOrganization: () => void;
  grouped?: boolean;
}

export const OrganizationMenuContent = (props: Props) => {
  const { organizations, onSwitchOrganization, onCreateOrganization, currentOrganization, grouped = true } = props;

  const organizationItems = organizations?.map((org) => (
    <MenuItem
      key={org.id}
      value={org.id}
      py={2}
      onClick={() => onSwitchOrganization(org.id)}
      bg={org.id === currentOrganization?.id ? 'purple.muted' : undefined}
    >
      <Flex gap="2" align="center" justify="space-between" w="100%">
        <Text>{org.name}</Text>
        {org.id === currentOrganization?.id && (
          <Box color="purple.fg">
            <TbCheck />
          </Box>
        )}
      </Flex>
    </MenuItem>
  ));

  return (
    <>
      {grouped ? <MenuItemGroup title="Organizations">{organizationItems}</MenuItemGroup> : organizationItems}
      <MenuSeparator my="0" />
      <MenuItem value="create-org" py={2} onClick={onCreateOrganization}>
        <Flex align="center" gap={2}>
          <TbPlus />
          <Text>Create Organization</Text>
        </Flex>
      </MenuItem>
    </>
  );
};

export const OrganizationMenu = () => {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const { organizations } = session ?? {};

  // Use first organization as current (on base layout we don't have project context)
  const currentOrganization = organizations?.[0];

  const handleOrganizationSwitch = (orgId: string) => {
    navigate({ to: '/o/$organizationId', params: { organizationId: orgId } });
  };

  const handleCreateOrganization = () => {
    navigate({ to: '/onboarding/organization' });
  };

  if (!currentOrganization) {
    return null;
  }

  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <Button variant="ghost" size={{ base: 'xs', md: 'sm' }} px={1} h="auto" py={1}>
          <Flex align="center" gap={2}>
            <Flex
              align="center"
              justify="center"
              boxSize={{ base: '20px', md: '24px' }}
              bg="purple.muted"
              rounded="md"
              color="purple.fg"
              fontSize="sm"
            >
              <TbBuilding />
            </Flex>
            <Text fontWeight="medium" display={{ base: 'none', md: 'block' }}>
              {currentOrganization.name}
            </Text>
            <TbChevronDown />
          </Flex>
        </Button>
      </MenuTrigger>
      <MenuContent maxH="80vh" minW="200px">
        <OrganizationMenuContent
          currentOrganization={currentOrganization}
          organizations={organizations || []}
          onSwitchOrganization={handleOrganizationSwitch}
          onCreateOrganization={handleCreateOrganization}
        />
      </MenuContent>
    </MenuRoot>
  );
};
