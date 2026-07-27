import { Button, DatePicker, Flex, IconButton, useDatePickerContext, type DatePickerDateView } from '@chakra-ui/react';
import { TbChevronLeft, TbChevronRight } from 'react-icons/tb';

interface Props {
  view: DatePickerDateView;
  minDate: Date;
  maxDate: Date;
}

export const DateRangePickerControls = ({ view, minDate, maxDate }: Props) => {
  const datePicker = useDatePickerContext();
  const { year, month } = datePicker.focusedValue;

  const destinationHasSelectableDates = (direction: -1 | 1) => {
    let start: Date;
    let end: Date;

    if (view === 'day') {
      start = new Date(year, month - 1 + direction, 1);
      end = new Date(year, month + direction, 0);
    } else if (view === 'month') {
      start = new Date(year + direction, 0, 1);
      end = new Date(year + direction, 11, 31);
    } else {
      const decadeStart = Math.floor(year / 10) * 10 + direction * 10;
      start = new Date(decadeStart, 0, 1);
      end = new Date(decadeStart + 9, 11, 31);
    }

    return end >= minDate && start <= maxDate;
  };

  return (
    <Flex
      bg="gray.subtle/40"
      _dark={{
        bg: 'gray.subtle/80',
      }}
      justifyContent="space-between"
      alignItems="center"
      borderBottom="1px solid"
      borderColor="gray.muted/90"
      p="2.5"
      mb="2"
    >
      <DatePicker.PrevTrigger disabled={!destinationHasSelectableDates(-1)} asChild>
        <IconButton size="xs">
          <TbChevronLeft />
        </IconButton>
      </DatePicker.PrevTrigger>
      <DatePicker.ViewTrigger asChild>
        <Button variant="ghost">
          <DatePicker.RangeText />
        </Button>
      </DatePicker.ViewTrigger>
      <DatePicker.NextTrigger disabled={!destinationHasSelectableDates(1)} asChild>
        <IconButton size="xs">
          <TbChevronRight />
        </IconButton>
      </DatePicker.NextTrigger>
    </Flex>
  );
};
