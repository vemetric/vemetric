import { Box, Button, Icon } from '@chakra-ui/react';
import { useQuery } from '@tanstack/react-query';
import { TbBrandDiscord, TbBrandGithub } from 'react-icons/tb';

export const SocialButtons = () => {
  const { data } = useQuery({
    queryKey: ['github-stars'],
    queryFn: async () => {
      const response = await fetch('https://api.github.com/repos/vemetric/vemetric');
      if (!response.ok) {
        throw new Error('Failed to fetch social stats');
      }
      return response.json();
    },
  });

  const { data: discordData } = useQuery({
    queryKey: ['discord-members'],
    queryFn: async () => {
      const response = await fetch('https://discord.com/api/v9/invites/8kwPRwAQkf?with_counts=true');
      if (!response.ok) {
        throw new Error('Failed to fetch social stats');
      }
      return response.json();
    },
  });

  return (
    <>
      <Button
        asChild
        size="2xs"
        rounded="full"
        className="group"
        display="flex"
        alignItems="center"
        gap="0"
        px="1"
        variant="surface"
      >
        <a href="https://vemetric.com/discord" target="_blank" rel="noopener noreferrer">
          <Icon as={TbBrandDiscord} transition="all .3s ease-in-out" _groupHover={{ transform: 'rotate(-20deg)' }} />
          <Box
            overflow="hidden"
            textAlign="right"
            whiteSpace="nowrap"
            opacity="0"
            w="0px"
            _groupHover={{ w: '78px', opacity: '1' }}
            transition="all .3s ease-in-out"
          >
            {discordData?.approximate_member_count ?? 100} Members
          </Box>
        </a>
      </Button>
      <Button
        asChild
        size="2xs"
        rounded="full"
        className="group"
        display="flex"
        alignItems="center"
        gap="0"
        px="1"
        colorPalette="gray"
        border="none"
        variant="surface"
      >
        <a href="https://github.com/vemetric/vemetric" target="_blank" rel="noopener noreferrer">
          <Icon as={TbBrandGithub} transition="all .3s ease-in-out" _groupHover={{ transform: 'rotate(-20deg)' }} />
          <Box
            overflow="hidden"
            textAlign="right"
            whiteSpace="nowrap"
            opacity="0"
            w="0px"
            _groupHover={{ w: '60px', opacity: '1' }}
            transition="all .3s ease-in-out"
          >
            {data?.stargazers_count ?? 100} Stars
          </Box>
        </a>
      </Button>
    </>
  );
};
