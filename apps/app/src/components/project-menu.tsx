import type { FlexProps } from '@chakra-ui/react';
import { Box, Button, Flex, Text, useBreakpointValue } from '@chakra-ui/react';
import { Link, useMatches, useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { TbArrowLeft, TbCheck, TbChevronDown, TbChevronRight, TbPlus, TbSettings } from 'react-icons/tb';
import { useCurrentOrganization } from '@/hooks/use-current-organization';
import { useOrgSettingsDialog } from '@/hooks/use-org-settings-dialog';
import { getFaviconUrl } from '@/utils/favicon';
import { CreateProjectDialog } from './create-project-dialog';
import { LoadingImage } from './loading-image';
import { OrganizationIcon } from './organization-icon';
import { OrganizationMenuContent } from './organization-menu';
import { MenuContent, MenuItem, MenuItemGroup, MenuRoot, MenuSeparator, MenuTrigger, MenuTriggerItem } from './ui/menu';

const IconBox = ({ children, ...props }: FlexProps) => (
  <Flex align="center" justify="center" boxSize="24px" bg="gray.subtle" rounded="md" fontSize="md" {...props}>
    {children}
  </Flex>
);

export const ProjectMenu = () => {
  const matches = useMatches();
  const routeId = matches[matches.length - 1].routeId;
  const navigate = useNavigate();

  const { projectId } = useParams({ strict: false });
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const { currentOrganization, currentOrgaProjects, organizations } = useCurrentOrganization();
  const { open: openOrgSettings } = useOrgSettingsDialog();
  const project = currentOrgaProjects?.find((p) => p.id === projectId);

  const getProjectRoute = () => {
    if (routeId === '/_layout/p/$projectId/settings/') {
      return '/p/$projectId/settings';
    } else if (routeId.startsWith('/_layout/p/$projectId/users/')) {
      return '/p/$projectId/users';
    } else if (routeId.startsWith('/_layout/p/$projectId/events/')) {
      return '/p/$projectId/events';
    } else if (routeId.startsWith('/_layout/p/$projectId/funnels/')) {
      return '/p/$projectId/funnels';
    }
    return '/p/$projectId';
  };

  const handleOrganizationSwitch = (orgId: string) => {
    navigate({ to: '/o/$organizationId', params: { organizationId: orgId } });
  };

  const handleCreateOrganization = async () => {
    navigate({ to: '/onboarding/organization' });
  };

  // On mobile, use drill-down pattern instead of submenu (no space for nested menu)
  const isMobile = useBreakpointValue({ base: true, md: false });
  const [mobileView, setMobileView] = useState<'main' | 'organizations'>('main');

  // Reset mobile view when menu closes
  const handleOpenChange = (details: { open: boolean }) => {
    if (!details.open) {
      setMobileView('main');
    }
  };

  const projectsSection = (
    <>
      <MenuItemGroup
        title={
          <Flex align="center" gap={4} justify="space-between">
            <Text>PROJECTS</Text>
            <Button
              size="xs"
              variant="plain"
              p="0"
              colorPalette="purple"
              outline="none"
              onClick={() => handleOrganizationSwitch(currentOrganization?.id || '')}
            >
              Overview <TbChevronRight />
            </Button>
          </Flex>
        }
        pt="2"
      >
        {currentOrgaProjects.map((p) => {
          const isSelected = p.id === project?.id;
          return (
            <MenuItem asChild value={p.id} key={p.id} bg={isSelected ? 'purple.muted' : undefined}>
              <Link to={getProjectRoute()} params={{ projectId: p.id }}>
                <Flex gap="2" as="span" w="100%" align="center" justify="space-between">
                  <Flex align="center" gap={2.5}>
                    <LoadingImage
                      src={getFaviconUrl(p.domain)}
                      alt={p.name}
                      boxSize="24px"
                      rounded="md"
                      overflow="hidden"
                    />
                    <Text as="span" lineClamp={1}>
                      {p.name}
                    </Text>
                  </Flex>
                  {isSelected && (
                    <Box color="purple.fg">
                      <TbCheck />
                    </Box>
                  )}
                </Flex>
              </Link>
            </MenuItem>
          );
        })}
      </MenuItemGroup>
      <MenuSeparator my="0" />
      <MenuItem value="new-project" py={2} onClick={() => setProjectDialogOpen(true)}>
        <Flex align="center" gap={2.5}>
          <IconBox>
            <TbPlus />
          </IconBox>
          <Text>New Project</Text>
        </Flex>
      </MenuItem>
    </>
  );

  return (
    <>
      <MenuRoot positioning={{ strategy: 'fixed' }} onOpenChange={handleOpenChange}>
        <MenuTrigger asChild>
          <Button
            variant="surface"
            boxShadow={{ md: 'none' }}
            size={{ base: 'xs', md: 'sm' }}
            p={1.5}
            h="auto"
            pr={5}
            mr={-3}
          >
            {project ? (
              <Flex w="100%" align="center" gap="1.5">
                <LoadingImage
                  src={getFaviconUrl(project.domain)}
                  alt={project.name}
                  boxSize="18px"
                  rounded="xs"
                  overflow="hidden"
                />
                <Text lineClamp={1}>{project.name}</Text>
              </Flex>
            ) : (
              'Unknown project'
            )}
            <TbChevronDown />
          </Button>
        </MenuTrigger>
        <MenuContent maxH="80vh" minW="300px" maxW={isMobile ? '300px' : undefined}>
          {isMobile ? (
            /* Mobile: Use relative container so both views stack and maintain consistent height */
            <Box pos="relative">
              {/* Organizations view */}
              <Box bg="bg.panel" display={mobileView === 'organizations' ? 'block' : 'none'}>
                <MenuItem value="back" py={2.5} px={3} closeOnSelect={false} onClick={() => setMobileView('main')}>
                  <Flex align="center" gap={2}>
                    <TbArrowLeft />
                    <Text fontWeight="medium">Organizations</Text>
                  </Flex>
                </MenuItem>
                <MenuSeparator my="0" />
                <OrganizationMenuContent
                  currentOrganization={currentOrganization}
                  organizations={organizations || []}
                  onSwitchOrganization={handleOrganizationSwitch}
                  onCreateOrganization={handleCreateOrganization}
                  grouped={false}
                />
              </Box>

              {/* Main view */}
              <Box display={mobileView === 'main' ? 'block' : 'none'}>
                <MenuItem
                  py={2.5}
                  px={3}
                  value="organization"
                  closeOnSelect={false}
                  onClick={() => setMobileView('organizations')}
                >
                  <Flex align="center" gap={2} flex={1}>
                    <OrganizationIcon />
                    <Text fontWeight="medium">{currentOrganization?.name || 'Organization'}</Text>
                  </Flex>
                  <Button
                    variant="surface"
                    size="xs"
                    p={1}
                    h="auto"
                    minW="auto"
                    onClick={(e) => {
                      e.stopPropagation();
                      openOrgSettings();
                    }}
                  >
                    <TbSettings />
                  </Button>
                  <TbChevronRight />
                </MenuItem>
                <MenuSeparator my="0" />
                {projectsSection}
              </Box>
            </Box>
          ) : (
            /* Desktop: Standard layout with submenu */
            <>
              <MenuRoot positioning={{ placement: 'right-start', gutter: 2 }}>
                <MenuTriggerItem py={2.5} px={3} cursor="pointer" value="choose-organization">
                  <Flex align="center" gap={2} flex={1}>
                    <OrganizationIcon />
                    <Text fontWeight="medium" lineClamp={1}>
                      {currentOrganization?.name || 'Organization'}
                    </Text>
                  </Flex>
                  <Button
                    tabIndex={-1}
                    variant="surface"
                    size="xs"
                    p={1}
                    h="auto"
                    minW="auto"
                    onClick={() => openOrgSettings()}
                  >
                    <TbSettings />
                  </Button>
                </MenuTriggerItem>
                <MenuContent minW="200px">
                  <OrganizationMenuContent
                    currentOrganization={currentOrganization}
                    organizations={organizations || []}
                    onSwitchOrganization={handleOrganizationSwitch}
                    onCreateOrganization={handleCreateOrganization}
                  />
                </MenuContent>
              </MenuRoot>
              <MenuSeparator my="0" />
              {projectsSection}
            </>
          )}
        </MenuContent>
      </MenuRoot>

      {currentOrganization && (
        <CreateProjectDialog
          open={projectDialogOpen}
          setOpen={setProjectDialogOpen}
          organizationId={currentOrganization.id}
        />
      )}
    </>
  );
};
