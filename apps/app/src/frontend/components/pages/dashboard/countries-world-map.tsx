import { AspectRatio, Box, Button, Center, Flex, Icon, Text, useBreakpointValue } from '@chakra-ui/react';
import { COUNTRIES } from '@vemetric/common/countries';
import { formatNumber } from '@vemetric/common/math';
import { memo, useState } from 'react';
import { TbLock, TbLockOpen, TbUserSquareRounded } from 'react-icons/tb';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { CountryFlag } from '@/components/country-flag';
import { Tooltip } from '@/components/ui/tooltip';
import { countriesMapLocked, countriesMapViewState, type CountriesMapViewState } from '@/utils/local-storage';
import { ChartTooltip } from './chart-tooltip';

const geoUrl = 'https://assets.vemetric.com/topo.json';
const DEFAULT_MAP_VIEW = {
  center: [0, 40] as [number, number],
  zoom: 0.85,
};
const MIN_ZOOM = 0.85;
const MAX_ZOOM = 4;

const readMapViewState = (): CountriesMapViewState => {
  const state = countriesMapViewState.get();
  if (!state) return DEFAULT_MAP_VIEW;

  return {
    center: state.center,
    zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.zoom)),
  };
};

interface CountryData {
  countryCode: string;
  users: number;
}

interface Props {
  data: CountryData[];
  onCountryClick?: (countryCode: string) => void;
}

export const CountriesWorldMap = memo(({ data, onCountryClick }: Props) => {
  const [hoveredCountryCode, setHoveredCountryCode] = useState<string | null>(null);
  const [mapViewState, setMapViewState] = useState<CountriesMapViewState>(readMapViewState);
  const [isMapLocked, setIsMapLocked] = useState<boolean>(() => countriesMapLocked.get());
  const isTouch = useBreakpointValue({ base: true, md: true, lg: false });
  const maxUsers = Math.max(...data.map((d) => d.users), 1);
  const countryDataMap = new Map(data.map((d) => [d.countryCode, d.users]));
  const hoveredCountryUsers = hoveredCountryCode ? (countryDataMap.get(hoveredCountryCode) ?? 0) : 0;

  const getCountryColor = (countryCode: string) => {
    const users = countryDataMap.get(countryCode);
    if (!users) return 'var(--geo-fill-color)';

    const intensity = users / maxUsers;
    // Purple gradient: from light (#9333EA) to darker (#7851D7)
    const r = Math.round(147 + (120 - 147) * intensity);
    const g = Math.round(51 + (81 - 51) * intensity);
    const b = Math.round(234 + (219 - 234) * intensity);
    const opacity = 0.3 + intensity * 0.7;

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  return (
    <AspectRatio ratio={5 / 3} w="100%">
      <Box position="relative" boxSize="100%" overflow="hidden" rounded="md">
        <ComposableMap projection="geoMercator" height={400} style={{ width: '100%', height: '100%' }}>
          <ZoomableGroup
            center={mapViewState.center}
            zoom={mapViewState.zoom}
            minZoom={MIN_ZOOM}
            maxZoom={MAX_ZOOM}
            filterZoomEvent={(event) => {
              const zoomEvent = event as unknown as { ctrlKey?: boolean; button?: number } | null;
              if (isMapLocked) return false;
              return zoomEvent ? !zoomEvent.ctrlKey && !zoomEvent.button : false;
            }}
            translateExtent={[
              [-70, -240],
              [880, 630],
            ]}
            onMoveEnd={(position) => {
              if (isMapLocked) return;

              const nextState = {
                center: position.coordinates,
                zoom: Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, position.zoom)),
              } satisfies CountriesMapViewState;

              setMapViewState(nextState);
              countriesMapViewState.set(nextState);
            }}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }: { geographies: any[] }) =>
                geographies.map((geo: any) => {
                  const countryCode = geo.properties?.code as string | undefined;
                  const users = countryCode ? (countryDataMap.get(countryCode) ?? 0) : 0;

                  return (
                    <Box
                      key={geo.rsmKey}
                      asChild
                      css={{
                        '--geo-fill-color': {
                          base: 'var(--chakra-colors-gray-subtle)',
                          _dark: 'var(--chakra-colors-gray-900)',
                        },
                        '--geo-hover-color': {
                          base: 'var(--chakra-colors-gray-muted)',
                          _dark: 'var(--chakra-colors-gray-700)',
                        },
                      }}
                    >
                      <Geography
                        geography={geo}
                        fill={countryCode ? getCountryColor(countryCode) : 'var(--geo-fill-color)'}
                        stroke="var(--chakra-colors-border-muted)"
                        strokeWidth={0.5}
                        style={{
                          default: { outline: 'none', transition: 'all 0.1s ease-in-out' },
                          hover: {
                            fill: users ? 'var(--chakra-colors-purple-500)' : 'var(--geo-hover-color)',
                            outline: 'none',
                            cursor: users ? 'pointer' : 'default',
                          },
                          pressed: { outline: 'none' },
                        }}
                        onClick={() => {
                          if (isTouch) return;

                          if (countryCode && users && onCountryClick) {
                            onCountryClick(countryCode);
                          }
                        }}
                        onMouseEnter={() => {
                          if (countryCode) {
                            setHoveredCountryCode(countryCode);
                          }
                        }}
                        onMouseLeave={() => {
                          setHoveredCountryCode(null);
                        }}
                      />
                    </Box>
                  );
                })
              }
            </Geographies>
          </ZoomableGroup>
        </ComposableMap>
        <Tooltip content={isMapLocked ? 'Unlock map interactions' : 'Lock map interactions'}>
          <Button
            size="2xs"
            variant="surface"
            colorScheme="gray"
            pos="absolute"
            minW="none"
            px="0"
            top="2"
            right="2"
            zIndex={1}
            onClick={() => {
              const nextState = !isMapLocked;
              if (nextState) {
                setHoveredCountryCode(null);
              }
              setIsMapLocked(nextState);
              countriesMapLocked.set(nextState);
            }}
            aria-label={isMapLocked ? 'Unlock map interactions' : 'Lock map interactions'}
          >
            <Icon as={isMapLocked ? TbLock : TbLockOpen} />
          </Button>
        </Tooltip>
        {hoveredCountryCode ? (
          <Center pos="absolute" bottom="2" w="100%" pointerEvents="none">
            <ChartTooltip
              label={
                <Flex gap={2.5} align="center">
                  <CountryFlag countryCode={hoveredCountryCode} />
                  {COUNTRIES[hoveredCountryCode as keyof typeof COUNTRIES]}
                </Flex>
              }
            >
              <Flex align="center" px={3} py={2} gap={5} justify="space-between">
                <Flex align="center" gap={2}>
                  <Icon as={TbUserSquareRounded} color={'blue.500'} />
                  <Text textTransform="capitalize" fontWeight="semibold">
                    {hoveredCountryUsers === 1 ? 'User' : 'Users'}
                  </Text>
                </Flex>
                {formatNumber(hoveredCountryUsers)}
              </Flex>
            </ChartTooltip>
          </Center>
        ) : null}
      </Box>
    </AspectRatio>
  );
});

CountriesWorldMap.displayName = 'CountriesWorldMap';
