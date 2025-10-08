import { Box, Text } from '@chakra-ui/react';
import { COUNTRIES } from '@vemetric/common/countries';
import { memo } from 'react';
import { ComposableMap, Geographies, Geography, ZoomableGroup } from 'react-simple-maps';
import { Tooltip } from '@/components/ui/tooltip';

// Local TopoJSON file served from public directory
const geoUrl = '/topo.json';

interface CountryData {
  countryCode: string;
  users: number;
}

interface Props {
  data: CountryData[];
  onCountryClick?: (countryCode: string) => void;
}

const countryCodeToId: Record<string, number> = {
  AF: 4,
  AX: 248,
  AL: 8,
  DZ: 12,
  AS: 16,
  AD: 20,
  AO: 24,
  AI: 660,
  AQ: 10,
  AG: 28,
  AR: 32,
  AM: 51,
  AW: 533,
  AU: 36,
  AT: 40,
  AZ: 31,
  BS: 44,
  BH: 48,
  BD: 50,
  BB: 52,
  BY: 112,
  BE: 56,
  BZ: 84,
  BJ: 204,
  BM: 60,
  BT: 64,
  BO: 68,
  BA: 70,
  BW: 72,
  BV: 74,
  BR: 76,
  IO: 86,
  BN: 96,
  BG: 100,
  BF: 854,
  BI: 108,
  KH: 116,
  CM: 120,
  CA: 124,
  CV: 132,
  KY: 136,
  CF: 140,
  TD: 148,
  CL: 152,
  CN: 156,
  CX: 162,
  CC: 166,
  CO: 170,
  KM: 174,
  CG: 178,
  CD: 180,
  CK: 184,
  CR: 188,
  CI: 384,
  HR: 191,
  CU: 192,
  CY: 196,
  CZ: 203,
  DK: 208,
  DJ: 262,
  DM: 212,
  DO: 214,
  EC: 218,
  EG: 818,
  SV: 222,
  GQ: 226,
  ER: 232,
  EE: 233,
  ET: 231,
  FK: 238,
  FO: 234,
  FJ: 242,
  FI: 246,
  FR: 250,
  GF: 254,
  PF: 258,
  TF: 260,
  GA: 266,
  GM: 270,
  GE: 268,
  DE: 276,
  GH: 288,
  GI: 292,
  GR: 300,
  GL: 304,
  GD: 308,
  GP: 312,
  GU: 316,
  GT: 320,
  GG: 831,
  GN: 324,
  GW: 624,
  GY: 328,
  HT: 332,
  HM: 334,
  VA: 336,
  HN: 340,
  HK: 344,
  HU: 348,
  IS: 352,
  IN: 356,
  ID: 360,
  IR: 364,
  IQ: 368,
  IE: 372,
  IM: 833,
  IL: 376,
  IT: 380,
  JM: 388,
  JP: 392,
  JE: 832,
  JO: 400,
  KZ: 398,
  KE: 404,
  KI: 296,
  KP: 408,
  KR: 410,
  KW: 414,
  KG: 417,
  LA: 418,
  LV: 428,
  LB: 422,
  LS: 426,
  LR: 430,
  LY: 434,
  LI: 438,
  LT: 440,
  LU: 442,
  MO: 446,
  MK: 807,
  MG: 450,
  MW: 454,
  MY: 458,
  MV: 462,
  ML: 466,
  MT: 470,
  MH: 584,
  MQ: 474,
  MR: 478,
  MU: 480,
  YT: 175,
  MX: 484,
  FM: 583,
  MD: 498,
  MC: 492,
  MN: 496,
  ME: 499,
  MS: 500,
  MA: 504,
  MZ: 508,
  MM: 104,
  NA: 516,
  NR: 520,
  NP: 524,
  NL: 528,
  AN: 530,
  NC: 540,
  NZ: 554,
  NI: 558,
  NE: 562,
  NG: 566,
  NU: 570,
  NF: 574,
  MP: 580,
  NO: 578,
  OM: 512,
  PK: 586,
  PW: 585,
  PS: 275,
  PA: 591,
  PG: 598,
  PY: 600,
  PE: 604,
  PH: 608,
  PN: 612,
  PL: 616,
  PT: 620,
  PR: 630,
  QA: 634,
  RE: 638,
  RO: 642,
  RU: 643,
  RW: 646,
  BL: 652,
  SH: 654,
  KN: 659,
  LC: 662,
  MF: 663,
  PM: 666,
  VC: 670,
  WS: 882,
  SM: 674,
  ST: 678,
  SA: 682,
  SN: 686,
  RS: 688,
  SC: 690,
  SL: 694,
  SG: 702,
  SK: 703,
  SI: 705,
  SB: 90,
  SO: 706,
  ZA: 710,
  GS: 239,
  SS: 728,
  ES: 724,
  LK: 144,
  SD: 729,
  SR: 740,
  SJ: 744,
  SZ: 748,
  SE: 752,
  CH: 756,
  SY: 760,
  TW: 158,
  TJ: 762,
  TZ: 834,
  TH: 764,
  TL: 626,
  TG: 768,
  TK: 772,
  TO: 776,
  TT: 780,
  TN: 788,
  TR: 792,
  TM: 795,
  TC: 796,
  TV: 798,
  UG: 800,
  UA: 804,
  AE: 784,
  GB: 826,
  US: 840,
  UM: 581,
  UY: 858,
  UZ: 860,
  VU: 548,
  VE: 862,
  VN: 704,
  VG: 92,
  VI: 850,
  WF: 876,
  EH: 732,
  YE: 887,
  ZM: 894,
  ZW: 716,
};

export const CountriesWorldMap = memo(({ data, onCountryClick }: Props) => {
  const maxUsers = Math.max(...data.map((d) => d.users), 1);
  const countryDataMap = new Map(data.map((d) => [d.countryCode, d.users]));

  const getCountryColor = (countryCode: string) => {
    const users = countryDataMap.get(countryCode);
    if (!users) return 'var(--chakra-colors-gray-subtle)';

    const intensity = users / maxUsers;
    // Purple gradient: from light (#9333EA) to darker (#7851D7)
    const r = Math.round(147 + (120 - 147) * intensity);
    const g = Math.round(51 + (81 - 51) * intensity);
    const b = Math.round(234 + (219 - 234) * intensity);
    const opacity = 0.3 + intensity * 0.7;

    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  return (
    <Box position="relative" overflow="hidden" rounded="md">
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{
          scale: 200,
        }}
      >
        <ZoomableGroup center={[0, 20]} zoom={1}>
          <Geographies geography={geoUrl}>
            {({ geographies }: { geographies: any[] }) =>
              geographies.map((geo: any) => {
                const countryId = geo.id;
                const countryCode = Object.keys(countryCodeToId).find(
                  (code) => countryCodeToId[code] === Number(countryId),
                );
                const users = countryCode ? countryDataMap.get(countryCode) : undefined;
                const countryName = countryCode ? COUNTRIES[countryCode as keyof typeof COUNTRIES] : undefined;

                return (
                  <Tooltip
                    key={geo.rsmKey}
                    content={
                      users && countryName ? (
                        <Box>
                          <Text fontWeight="semibold">{countryName}</Text>
                          <Text fontSize="sm">
                            {users.toLocaleString()} {users === 1 ? 'user' : 'users'}
                          </Text>
                        </Box>
                      ) : null
                    }
                    disabled={!users}
                  >
                    <Geography
                      geography={geo}
                      fill={countryCode ? getCountryColor(countryCode) : 'var(--chakra-colors-gray-subtle)'}
                      stroke="var(--chakra-colors-border-muted)"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none' },
                        hover: {
                          fill: users ? 'var(--chakra-colors-purple-500)' : 'var(--chakra-colors-gray-muted)',
                          outline: 'none',
                          cursor: users ? 'pointer' : 'default',
                        },
                        pressed: { outline: 'none' },
                      }}
                      onClick={() => {
                        if (countryCode && users && onCountryClick) {
                          onCountryClick(countryCode);
                        }
                      }}
                    />
                  </Tooltip>
                );
              })
            }
          </Geographies>
        </ZoomableGroup>
      </ComposableMap>
    </Box>
  );
});

CountriesWorldMap.displayName = 'CountriesWorldMap';
