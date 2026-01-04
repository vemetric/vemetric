import { Flex, Box } from '@chakra-ui/react';
import { useCurrentOrganization } from '@/hooks/use-current-organization';
import { Logo } from './logo';
import { OrganizationMenu } from './organization-menu';
import { PageWrapper } from './page-wrapper';
import { UserMenu } from './user-menu';

interface Props {
  children: React.ReactNode;
}

export const BaseLayout = (props: Props) => {
  const { children } = props;

  const { currentOrganization, organizations } = useCurrentOrganization();

  return (
    <>
      <Flex
        align="center"
        justify="space-between"
        bg={{ base: 'bg.card', md: 'none' }}
        px={{ base: 1.5, md: 5 }}
        pt={{ base: 0, md: 4 }}
        pb={{ base: 0, md: 0 }}
        h={{ base: '50px', md: 'auto' }}
        borderBottom={{ base: '1px solid', md: 'none' }}
        borderColor="purple.fg/10"
      >
        <Flex align="center" gap={3}>
          <Logo h={{ base: '32px', md: '44px' }} />
          {currentOrganization && <Box w="1px" h="20px" ml="1" bg="border.emphasized" />}
          <OrganizationMenu currentOrganization={currentOrganization} organizations={organizations || []} />
        </Flex>
        <UserMenu />
      </Flex>
      <PageWrapper flexDir="column">{children}</PageWrapper>
    </>
  );
};
