import { Box, SegmentGroup } from '@chakra-ui/react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { MenuContent, MenuRadioItem, MenuRadioItemGroup, MenuRoot, MenuTrigger } from '@/components/ui/menu';

interface Props {
  publicDashboard?: boolean;
}

export const UserCardSelect = ({ publicDashboard }: Props) => {
  const { u } = useSearch({ from: publicDashboard ? '/public/$domain' : '/_layout/p/$projectId/' });
  const navigate = useNavigate({ from: publicDashboard ? '/public/$domain' : '/p/$projectId' });

  const userType = u ? 'other' : 'countries';

  return (
    <SegmentGroup.Root
      size="xs"
      value={userType}
      onValueChange={({ value }) => {
        if (value === 'other') {
          return;
        }

        navigate({
          resetScroll: false,
          search: (prev) => {
            return { ...prev, u: undefined };
          },
        });
      }}
    >
      <SegmentGroup.Indicator />
      <SegmentGroup.Item value="countries">
        <SegmentGroup.ItemText>Browsers</SegmentGroup.ItemText>
        <SegmentGroup.ItemHiddenInput />
      </SegmentGroup.Item>
      <MenuRoot positioning={{ placement: 'bottom-end' }}>
        <SegmentGroup.Item value="other">
          <MenuTrigger asChild>
            <Box pos="absolute" inset="0" />
          </MenuTrigger>
          <SegmentGroup.ItemText>{u === 'os' ? 'Operating Systems' : 'Devices'}</SegmentGroup.ItemText>
          <SegmentGroup.ItemHiddenInput />
        </SegmentGroup.Item>
        <MenuContent>
          <MenuRadioItemGroup
            value={u}
            onValueChange={({ value }) => {
              navigate({
                resetScroll: false,
                search: (prev) => {
                  return { ...prev, u: value as 'devices' | 'os' };
                },
              });
            }}
          >
            <MenuRadioItem value="devices">Devices</MenuRadioItem>
            <MenuRadioItem value="os">Operating Systems</MenuRadioItem>
          </MenuRadioItemGroup>
        </MenuContent>
      </MenuRoot>
    </SegmentGroup.Root>
  );
};
