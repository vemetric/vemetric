import { Box, Flex, Image } from '@chakra-ui/react';
import { COUNTRIES } from '@vemetric/common/countries';

export const CountryFlag = ({ countryCode }: { countryCode: string }) => {
  const isKnownCountry = Boolean(COUNTRIES[countryCode as keyof typeof COUNTRIES]);

  return (
    <Box
      bg="bg"
      opacity={0.8}
      pos="relative"
      rounded="1.5px"
      overflow="hidden"
      boxShadow="sm"
      _before={{
        content: '""',
        pos: 'absolute',
        display: 'block',
        inset: 0,
        mixBlendMode: 'overlay',
        border: '1px solid rgba(0, 0, 0, .5)',
        bg: 'linear-gradient(45deg, rgba(0,0,0,0.20) 0%, rgba(39,39,39,0.22) 11%, rgba(255,255,255,0.30) 27%, rgba(0,0,0,0.24) 41%, rgba(0,0,0,0.55) 52%, rgba(255,255,255,0.26) 63%, rgba(0,0,0,0.27) 74%, rgba(255,255,255,0.30) 100%)',
      }}
    >
      {isKnownCountry ? (
        <Image src={`/flags/${countryCode}.svg`} width="auto" height="15px" />
      ) : (
        <Flex
          w="20px"
          h="15px"
          align="center"
          justify="center"
          fontSize="xs"
          fontWeight="bold"
          bg="gray.800"
          color="white"
        >
          ?
        </Flex>
      )}
    </Box>
  );
};
