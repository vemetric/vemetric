import { DatePicker, useDatePickerContext } from '@chakra-ui/react';
import { getDatePickerDisabledTooltip } from '@/utils/timespans';
import { Tooltip } from '../tooltip';

interface Props {
  monthOffset: number;
  minDate: Date;
  maxDate: Date;
  minRangeDisabledTooltip?: string;
  maxRangeDisabledTooltip?: string;
}

export const DayView = (props: Props) => {
  const { monthOffset, minDate, maxDate, minRangeDisabledTooltip, maxRangeDisabledTooltip } = props;
  const datePicker = useDatePickerContext();
  const offset = datePicker.getOffset({ months: monthOffset });

  return (
    <DatePicker.Table w="100%">
      <DatePicker.TableHead>
        <DatePicker.TableRow>
          {datePicker.weekDays.map((weekDay, id) => (
            <DatePicker.TableHeader key={id} fontWeight="semibold" opacity="0.8" textAlign="center" pb={2}>
              {weekDay.short}
            </DatePicker.TableHeader>
          ))}
        </DatePicker.TableRow>
      </DatePicker.TableHead>
      <DatePicker.TableBody>
        {offset.weeks.map((week, id) => (
          <DatePicker.TableRow key={id} _notLast={{ '& > td': { pb: '3px' } }}>
            {week.map((day, id) => {
              const date = new Date(day.year, day.month - 1, day.day);
              const disabledTooltip = getDatePickerDisabledTooltip({
                date,
                minDate,
                maxDate,
                minRangeDisabledTooltip,
                maxRangeDisabledTooltip,
              });

              return (
                <Tooltip key={id} disabled={!disabledTooltip} content={disabledTooltip}>
                  <DatePicker.TableCell value={day} visibleRange={offset.visibleRange} boxSize="45px">
                    <DatePicker.TableCellTrigger
                      cursor="pointer"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      boxSize="100%"
                      rounded="md"
                      _hover={{
                        bg: 'gray.emphasized/70',
                      }}
                      css={{
                        '&[data-today]': {
                          border: '1px solid',
                          borderColor: 'gray.muted',
                        },
                        '&[data-in-hover-range], &[data-in-range]': {
                          bg: 'gray.muted/40',
                          rounded: 'none',
                          _dark: {
                            bg: 'gray.muted/70',
                          },
                        },
                        '&[data-selected]': {
                          bg: 'gray.emphasized/70',
                          _dark: {
                            bg: 'gray.emphasized/70',
                          },
                        },
                        '&[data-hover-range-start], &[data-range-start]': {
                          roundedLeft: 'md',
                        },
                        '&[data-hover-range-end], &[data-range-end]': {
                          roundedRight: 'md',
                        },
                        '&[data-disabled]': {
                          opacity: 0.3,
                          cursor: 'not-allowed',
                        },
                      }}
                    >
                      {day.day}
                    </DatePicker.TableCellTrigger>
                  </DatePicker.TableCell>
                </Tooltip>
              );
            })}
          </DatePicker.TableRow>
        ))}
      </DatePicker.TableBody>
    </DatePicker.Table>
  );
};
