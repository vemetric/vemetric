import { DatePicker } from '@ark-ui/react/date-picker';
import { Button, Flex, IconButton } from '@chakra-ui/react';
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb';

interface Props {
  onRangeClick?: () => void;
}

export const DateRangePickerControls = ({ onRangeClick }: Props) => {
  return (
    <Flex
      bg="gray.subtle/40"
      _dark={{
        bg: 'gray.subtle/80',
      }}
      justify="space-between"
      align="center"
      borderBottom="1px solid"
      borderColor="gray.muted/90"
      p="2.5"
      mb="2"
    >
      <DatePicker.PrevTrigger asChild>
        <IconButton size="xs">
          <TbChevronLeft />
        </IconButton>
      </DatePicker.PrevTrigger>
      {onRangeClick ? (
        <Button variant="ghost" onClick={onRangeClick}>
          <DatePicker.RangeText />
        </Button>
      ) : (
        <DatePicker.ViewTrigger asChild>
          <Button variant="ghost">
            <DatePicker.RangeText />
          </Button>
        </DatePicker.ViewTrigger>
      )}

      <DatePicker.NextTrigger asChild>
        <IconButton size="xs">
          <TbChevronRight />
        </IconButton>
      </DatePicker.NextTrigger>
    </Flex>
  );
};
