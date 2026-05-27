import type { FlexProps } from '@chakra-ui/react';
import { Flex, Span } from '@chakra-ui/react';
import { COUNTRIES } from '@vemetric/common/countries';
import { CountryFlag } from './country-flag';

interface Props extends FlexProps {
  city?: string;
  countryCode?: string;
}

export const LocationLabel = ({ city, countryCode = 'unknown', ...props }: Props) => {
  const countryName = COUNTRIES[countryCode as keyof typeof COUNTRIES] ?? 'Unknown';
  const hasCity = city && city?.toLowerCase() !== 'unknown' && city.trim() !== '';

  return (
    <Flex align="center" gap="1" truncate {...props} title={hasCity ? `${city}, ${countryName}` : countryName}>
      <CountryFlag countryCode={countryCode} />
      <Span truncate>
        {hasCity ? `${city}, ` : ''}
        {countryName}
      </Span>
    </Flex>
  );
};
