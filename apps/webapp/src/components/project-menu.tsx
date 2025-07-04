import { Button, Flex, Image, Text } from '@chakra-ui/react';
import { Link, useMatches, useParams } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { TbChevronDown, TbDashboard } from 'react-icons/tb';
import { useAuth } from '@/hooks/use-auth';
import { getFaviconUrl } from '@/utils/favicon';
import { CreateProjectDialog } from './create-project-dialog';
import { MenuContent, MenuItem, MenuRoot, MenuTrigger } from './ui/menu';

const OPEN_PROJECT_OVERVIEW = 'open-project-overview';
const OPEN_CREATE_PROJECT = 'open-create-project';

export const ProjectMenu = () => {
  const matches = useMatches();
  const routeId = matches[matches.length - 1].routeId;

  const ref = useRef<HTMLButtonElement>(null);
  const [minWidth, setMinWidth] = useState<number | null>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const { session } = useAuth();
  const { projects } = session ?? {};
  const params = useParams({ strict: false });
  const project = projects?.find((project) => project.id === params.projectId);

  useEffect(() => {
    if (ref.current) {
      setMinWidth(Math.ceil(ref.current.clientWidth) + 2);
    }
  }, []);

  return (
    <>
      <MenuRoot>
        <MenuTrigger asChild>
          <Button
            variant="surface"
            boxShadow={{ md: 'none' }}
            size={{ base: 'xs', md: 'sm' }}
            ref={ref}
            p={1.5}
            h="auto"
            pr={5}
            mr={-3}
          >
            {project ? (
              <Flex w="100%" align="center">
                <Image
                  src={getFaviconUrl('https://' + project.domain)}
                  alt={project.name}
                  boxSize="18px"
                  mr={1.5}
                  flexShrink={0}
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
        <MenuContent minWidth={minWidth ? minWidth + 'px' : 'none'}>
          <MenuItem asChild value={OPEN_PROJECT_OVERVIEW} minW={0}>
            <Link to="/">
              <Flex align="center">
                <Flex align="center" justify="center" boxSize="18px" fontSize="1.3em" mb={0.5} mr="6px">
                  <TbDashboard />
                </Flex>
                Project Overview
              </Flex>
            </Link>
          </MenuItem>
          {projects?.map((project) => {
            let route = '/p/$projectId';
            if (routeId === '/_layout/p/$projectId/settings/') {
              route = '/p/$projectId/settings';
            } else if (routeId.startsWith('/_layout/p/$projectId/users/')) {
              route = '/p/$projectId/users';
            } else if (routeId.startsWith('/_layout/p/$projectId/events/')) {
              route = '/p/$projectId/events';
            }

            return (
              <MenuItem asChild value={project.id} key={project.id}>
                <Link to={route} params={{ projectId: project.id }}>
                  <Flex as="span" w="100%" align="center">
                    <Image
                      src={getFaviconUrl('https://' + project.domain)}
                      alt={project.name}
                      boxSize="18px"
                      mr="10px"
                      flexShrink={0}
                      rounded="xs"
                      overflow="hidden"
                    />
                    <Text as="span" lineClamp={1}>
                      {project.name}
                    </Text>
                  </Flex>
                </Link>
              </MenuItem>
            );
          })}
          <MenuItem
            value={OPEN_CREATE_PROJECT}
            minW={0}
            bg="purple.muted"
            _hover={{ bg: 'purple.emphasized' }}
            roundedTop="none"
            onClick={() => setProjectDialogOpen(true)}
          >
            <Flex align="center">
              <Flex align="center" justify="center" boxSize="18px" fontSize="1.3em" mb={0.5} mr="6px">
                +
              </Flex>
              New Project
            </Flex>
          </MenuItem>
        </MenuContent>
      </MenuRoot>

      <CreateProjectDialog open={projectDialogOpen} setOpen={setProjectDialogOpen} />
    </>
  );
};
