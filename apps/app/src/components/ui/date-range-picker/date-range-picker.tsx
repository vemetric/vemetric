import { DatePicker, parseDate } from '@ark-ui/react/date-picker';
import { Box } from '@chakra-ui/react';
import { getTimeSpanRangeMax, timeSpanRangeMin } from '@vemetric/common/charts/timespans';
import { getDaysInMonth } from 'date-fns';
import { DayView } from './day-view';
import { DatePickerContent } from '../date-picker';
import { DateRangePickerControls } from './date-range-picker-controls';
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
  enableMonthRangeSelection?: boolean;
  minRangeDisabledTooltip?: string;
}

export const DateRangePicker = ({
  minDate: _minDate,
  value,
  onRangeSelect,
  enableMonthRangeSelection,
  minRangeDisabledTooltip,
}: Props) => {
  const minDate = _minDate ? _minDate : timeSpanRangeMin;

  return (
    <DatePicker.Root
      inline
      skipAnimationOnMount
      startOfWeek={1}
      selectionMode="range"
      numOfMonths={1}
      min={parseDate(minDate)}
      max={parseDate(getTimeSpanRangeMax())}
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
      <DatePickerContent>
        <DatePicker.Context>
          {({ focusedValueAsDate }) => (
            <div>
              <DatePicker.View view="day">
                <DateRangePickerControls
                  onRangeClick={
                    enableMonthRangeSelection
                      ? () => {
                          const month = focusedValueAsDate.getMonth() + 1;
                          const year = focusedValueAsDate.getFullYear();
                          onRangeSelect({
                            start: {
                              day: 1,
                              month,
                              year,
                            },
                            end: {
                              day: getDaysInMonth(focusedValueAsDate),
                              month,
                              year,
                            },
                          });
                        }
                      : undefined
                  }
                />
                <Box p="1.5">
                  <Box overflow="hidden" rounded="md">
                    <DayView monthOffset={0} minDate={minDate} minRangeDisabledTooltip={minRangeDisabledTooltip} />
                  </Box>
                </Box>
              </DatePicker.View>
              <DatePicker.View view="month">
                <DateRangePickerControls />
                <Box p="1.5">
                  <Box overflow="hidden" rounded="md">
                    <MonthView />
                  </Box>
                </Box>
              </DatePicker.View>
              <DatePicker.View view="year">
                <DateRangePickerControls />
                <Box p="1.5">
                  <Box overflow="hidden" rounded="md">
                    <YearView />
                  </Box>
                </Box>
              </DatePicker.View>
            </div>
          )}
        </DatePicker.Context>
      </DatePickerContent>
    </DatePicker.Root>
  );
};
