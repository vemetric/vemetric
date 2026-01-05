import { Box, Button, Flex, Text } from '@chakra-ui/react';
import { useNavigate } from '@tanstack/react-router';
import { TbCheck, TbChevronDown, TbPlus } from 'react-icons/tb';
import { OrganizationIcon } from './organization-icon';
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

interface MenuProps {
  currentOrganization?: { id: string; name: string };
  organizations: Array<{ id: string; name: string }>;
}

export const OrganizationMenu = ({ currentOrganization, organizations }: MenuProps) => {
  const navigate = useNavigate();

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
            <OrganizationIcon />
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
