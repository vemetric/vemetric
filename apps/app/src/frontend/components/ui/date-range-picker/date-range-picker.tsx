import { Box, DatePicker, parseDate } from '@chakra-ui/react';
import { getTimeSpanRangeMax, timeSpanRangeMin } from '@vemetric/common/charts/timespans';
import { DateRangePickerControls } from './date-range-picker-controls';
import { DayView } from './day-view';
import { MonthView } from './month-view';
import { YearView } from './year-view';

interface DatePickerValue {
  day: number;
  month: number;
  year: number;
}

interface Props {
  minDate?: Date;
  value: { start: DatePickerValue; end: DatePickerValue } | null;
  onRangeSelect: (range: { start: DatePickerValue; end: DatePickerValue }) => void;
  minRangeDisabledTooltip?: string;
  maxRangeDisabledTooltip?: string;
}

export const DateRangePicker = ({
  minDate: _minDate,
  value,
  onRangeSelect,
  minRangeDisabledTooltip,
  maxRangeDisabledTooltip,
}: Props) => {
  const minDate = _minDate ? _minDate : timeSpanRangeMin;
  const maxDate = getTimeSpanRangeMax();

  return (
    <DatePicker.Root
      unstyled
      inline
      skipAnimationOnMount
      startOfWeek={1}
      selectionMode="range"
      numOfMonths={1}
      outsideDaySelectable
      min={parseDate(minDate)}
      max={parseDate(maxDate)}
      defaultValue={
        value
          ? [
              parseDate(new Date(value.start.year, value.start.month - 1, value.start.day)),
              parseDate(new Date(value.end.year, value.end.month - 1, value.end.day)),
            ]
          : undefined
      }
      onValueChange={({ value }) => {
        if (value.length !== 2) {
          return;
        }

        onRangeSelect({
          start: { day: value[0].day, month: value[0].month, year: value[0].year },
          end: { day: value[1].day, month: value[1].month, year: value[1].year },
        });
      }}
    >
      <DatePicker.Content p="0" minW="0" gap="0" bg="transparent" boxShadow="none">
        <div>
          <DatePicker.View view="day">
            <DateRangePickerControls view="day" minDate={minDate} maxDate={maxDate} />
            <Box p="1.5">
              <Box overflow="hidden" rounded="md">
                <DayView
                  monthOffset={0}
                  minDate={minDate}
                  maxDate={maxDate}
                  minRangeDisabledTooltip={minRangeDisabledTooltip}
                  maxRangeDisabledTooltip={maxRangeDisabledTooltip}
                />
              </Box>
            </Box>
          </DatePicker.View>
          <DatePicker.View view="month">
            <DateRangePickerControls view="month" minDate={minDate} maxDate={maxDate} />
            <Box p="1.5">
              <Box overflow="hidden" rounded="md">
                <MonthView
                  minDate={minDate}
                  maxDate={maxDate}
                  minRangeDisabledTooltip={minRangeDisabledTooltip}
                  maxRangeDisabledTooltip={maxRangeDisabledTooltip}
                />
              </Box>
            </Box>
          </DatePicker.View>
          <DatePicker.View view="year">
            <DateRangePickerControls view="year" minDate={minDate} maxDate={maxDate} />
            <Box p="1.5">
              <Box overflow="hidden" rounded="md">
                <YearView
                  minDate={minDate}
                  maxDate={maxDate}
                  minRangeDisabledTooltip={minRangeDisabledTooltip}
                  maxRangeDisabledTooltip={maxRangeDisabledTooltip}
                />
              </Box>
            </Box>
          </DatePicker.View>
        </div>
      </DatePicker.Content>
    </DatePicker.Root>
  );
};
