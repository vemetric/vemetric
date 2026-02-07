import { Box, Flex, LinkOverlay, Card } from '@chakra-ui/react';
import { useSnapshot } from 'valtio';
import { headerStore } from '@/stores/header-store';
import { DocsButton } from './docs-button';
import { Logo } from './logo';
import { ProjectMenu } from './project-menu';

export const Header = () => {
  const breadcrumbs = useSnapshot(headerStore).breadcrumbs;
  const docsLink = useSnapshot(headerStore).docsLink;

  return (
    <Box pos="sticky" top={{ base: 0, md: '60px', lg: 0 }} bg="bg.muted" zIndex="sticky" pt={{ base: 0, md: 4, lg: 2 }}>
      <Card.Root
        flexDir="row"
        borderWidth={{ base: '0px', md: '1px' }}
        borderBottomWidth="1px!important"
        rounded="none"
        roundedTop={{ base: 'none', md: 'lg' }}
        alignItems="center"
        justifyContent={{ base: 'space-between', md: 'flex-start' }}
        px={1.5}
        h="50px"
        gap={{ base: 4, md: 0 }}
        borderBottomColor="purple.fg/10"
      >
        <Logo height="32px" display={{ base: 'block', md: 'none' }} mr={2} />
        <Flex
          align="stretch"
          border="1px solid"
          borderColor="gray.emphasized"
          rounded="lg"
          boxShadow="xs"
          overflow="hidden"
        >
          <ProjectMenu />
          <Flex align="stretch" fontWeight="medium" textStyle={{ base: 'xs', md: 'sm' }}>
            {breadcrumbs.map((breadcrumb, index) => (
              <Flex pos="relative" align="center" key={index} className="group">
                <Box
                  pos="absolute"
                  top="0"
                  left="0"
                  w="110%"
                  h="100%"
                  borderLeft="1.5px solid"
                  borderColor="gray.emphasized"
                  transform="skewX(-20deg)"
                  bg="bg.card"
                  _groupHover={{
                    bg: 'gray.subtle',
                  }}
                />
                <Box zIndex="1" px={3.5} truncate>
                  {typeof breadcrumb === 'string' ? (
                    <LinkOverlay href="#">{breadcrumb}</LinkOverlay>
                  ) : (
                    (breadcrumb as any)
                  )}
                </Box>
              </Flex>
            ))}
          </Flex>
        </Flex>
        {docsLink && (
          <Flex justify="flex-end" hideBelow="md" flexGrow={1}>
            <DocsButton href={docsLink} />
          </Flex>
        )}
      </Card.Root>
    </Box>
  );
};
