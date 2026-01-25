import {
  Card,
  Button,
  Field,
  Flex,
  Stack,
  Text,
  Badge,
  HStack,
  Icon,
  Spinner,
  Select,
  createListCollection,
  Span,
} from '@chakra-ui/react';
import { COUNTRIES, MAX_EXCLUDED_COUNTRIES } from '@vemetric/common/countries';
import { useState, useEffect, useMemo, Fragment } from 'react';
import { TbWorldX, TbX } from 'react-icons/tb';
import { CardIcon } from '~/components/card-icon';
import { CountryFlag } from '~/components/country-flag';
import { toaster } from '~/components/ui/toaster';
import { trpc } from '~/utils/trpc';

interface Props {
  projectId: string;
  initialExcludedCountries?: string[];
}

export const ExcludedCountriesCard = (props: Props) => {
  const { projectId, initialExcludedCountries = [] } = props;
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [removedCountry, setRemovedCountry] = useState('');
  const [excludedCountries, setExcludedCountries] = useState<string[]>(initialExcludedCountries);

  useEffect(() => {
    setExcludedCountries(initialExcludedCountries);
  }, [initialExcludedCountries]);

  const utils = trpc.useUtils();

  // Create list of countries for select dropdown, filtering out already excluded ones
  const availableCountries = useMemo(() => {
    const countries = Object.entries(COUNTRIES)
      .filter(([code]) => !excludedCountries.includes(code))
      .map(([code, name]) => ({
        label: (
          <Flex gap={1.5} align="center">
            <CountryFlag countryCode={code} />
            <Text className="value-hidden">{name}</Text>
          </Flex>
        ),
        value: code,
      }))
      .sort((a, b) => {
        const aName = COUNTRIES[a.value as keyof typeof COUNTRIES];
        const bName = COUNTRIES[b.value as keyof typeof COUNTRIES];
        return aName.localeCompare(bName);
      });

    return createListCollection({
      items: countries,
      itemToString: (item) => COUNTRIES[item.value as keyof typeof COUNTRIES] ?? 'Unknown',
      itemToValue: (item) => item.value,
    });
  }, [excludedCountries]);

  const { mutate: addExcludedCountries, isLoading: isAddingCountry } = trpc.projects.addExcludedCountries.useMutation({
    onSuccess: (data) => {
      setExcludedCountries(data.excludedCountries);
      setSelectedCountries([]);
      toaster.create({
        title: 'Country excluded successfully',
        type: 'success',
      });
      utils.projects.settings.invalidate({ projectId });
    },
    onError: (error) => {
      toaster.create({
        title: 'Error',
        description: error.message,
        type: 'error',
      });
    },
  });

  const { mutate: removeExcludedCountry, isLoading: isRemovingCountry } =
    trpc.projects.removeExcludedCountry.useMutation({
      onSuccess: (data) => {
        setExcludedCountries(data.excludedCountries);
        utils.projects.settings.invalidate({ projectId });
      },
      onError: (error) => {
        toaster.create({
          title: 'Error',
          description: error.message,
          type: 'error',
        });
      },
      onSettled: () => {
        setRemovedCountry('');
      },
    });

  const handleAddCountry = async () => {
    if (selectedCountries.length === 0) return;

    addExcludedCountries({ projectId, countryCodes: selectedCountries });
  };

  const removeCountry = (countryCode: string) => {
    if (isRemovingCountry) return;

    setRemovedCountry(countryCode);
    removeExcludedCountry({
      projectId,
      countryCode,
    });
  };

  return (
    <Card.Root>
      <Card.Header>
        <Flex align="center" gap={2}>
          <CardIcon>
            <TbWorldX />
          </CardIcon>
          <Text fontWeight="semibold">Excluded Countries</Text>
        </Flex>
      </Card.Header>
      <Card.Body p={4} pb={3}>
        <Stack gap="3">
          <Field.Root>
            <Field.HelperText px="0.5">Block tracking requests from specific countries</Field.HelperText>
            {excludedCountries.length > 0 && (
              <HStack wrap="wrap" mt={2}>
                {excludedCountries.map((countryCode) => (
                  <Badge
                    key={countryCode}
                    colorPalette="gray"
                    display="flex"
                    alignItems="center"
                    gap={1}
                    size="sm"
                    cursor="pointer"
                    className="group"
                    onClick={() => removeCountry(countryCode)}
                  >
                    <CountryFlag countryCode={countryCode} />
                    {COUNTRIES[countryCode as keyof typeof COUNTRIES] || countryCode}
                    {removedCountry === countryCode ? (
                      <Spinner size="xs" />
                    ) : (
                      <Icon as={TbX} _groupHover={{ color: 'red.600', opacity: 0.8 }} />
                    )}
                  </Badge>
                ))}
              </HStack>
            )}
            <Flex gap={2} w="100%" mt={2}>
              <Select.Root
                collection={availableCountries}
                size="sm"
                multiple
                value={selectedCountries}
                onValueChange={({ value }) => setSelectedCountries(value)}
                disabled={isAddingCountry}
              >
                <Select.HiddenSelect />
                <Select.Control flex={1}>
                  <Select.Trigger>
                    <Select.ValueText placeholder="Select countries to exclude">
                      {selectedCountries.length > 0 && (
                        <Flex
                          align="center"
                          flexWrap="wrap"
                          rowGap={1}
                          css={{ '& .value-hidden': { display: 'none' } }}
                          py={1}
                        >
                          {selectedCountries.map((value, index) => (
                            <Fragment key={value}>
                              {index > 0 && <Span>,&nbsp;</Span>}
                              <Span className={value === 'any' ? 'value-hidden' : ''}>
                                {availableCountries.items.find((item) => item.value === value)?.label}
                              </Span>
                            </Fragment>
                          ))}
                        </Flex>
                      )}
                    </Select.ValueText>
                  </Select.Trigger>
                  <Select.IndicatorGroup>
                    <Select.Indicator />
                  </Select.IndicatorGroup>
                </Select.Control>
                <Select.Positioner>
                  <Select.Content>
                    {availableCountries.items.map((country) => (
                      <Select.Item key={country.value} item={country.value}>
                        {country.label}
                        <Select.ItemIndicator />
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select.Positioner>
              </Select.Root>
              <Button
                size="sm"
                onClick={handleAddCountry}
                loading={isAddingCountry}
                disabled={selectedCountries.length === 0}
              >
                Exclude {selectedCountries.length > 0 && `(${selectedCountries.length})`}
              </Button>
            </Flex>
            {excludedCountries.length >= MAX_EXCLUDED_COUNTRIES && (
              <Text fontSize="xs" color="orange.500" mt={1}>
                Maximum limit of {MAX_EXCLUDED_COUNTRIES} countries reached
              </Text>
            )}
          </Field.Root>
        </Stack>
      </Card.Body>
    </Card.Root>
  );
};
