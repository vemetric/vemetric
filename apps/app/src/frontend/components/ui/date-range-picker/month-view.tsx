import { Box, Button, DatePicker, useDatePickerContext } from '@chakra-ui/react';
import { isAfter, isBefore } from 'date-fns';
import { Tooltip } from '../tooltip';

interface Props {
  minDate: Date;
  maxDate: Date;
  minRangeDisabledTooltip?: string;
  maxRangeDisabledTooltip?: string;
}

export const MonthView = ({ minDate, maxDate, minRangeDisabledTooltip, maxRangeDisabledTooltip }: Props) => {
  const datePicker = useDatePickerContext();

  return (
    <DatePicker.Table w="100%">
      <DatePicker.TableBody>
        {datePicker.getMonthsGrid({ columns: 4, format: 'short' }).map((months, id) => (
          <DatePicker.TableRow key={id} _notLast={{ '& > td': { pb: '3px' } }}>
            {months.map((month) => {
              const monthStart = new Date(datePicker.focusedValue.year, month.value - 1, 1);
              const disabledTooltip =
                Boolean(month.disabled) && isBefore(monthStart, minDate)
                  ? minRangeDisabledTooltip
                  : Boolean(month.disabled) && isAfter(monthStart, maxDate)
                    ? maxRangeDisabledTooltip
                    : undefined;

              return (
                <DatePicker.TableCell key={month.value} value={month.value}>
                  <Tooltip disabled={!disabledTooltip} content={disabledTooltip}>
                    <Box as="span" display="block" w="100%">
                      <DatePicker.TableCellTrigger asChild>
                        <Button
                          variant="ghost"
                          w="100%"
                          h="60px"
                          fontSize="0.95rem"
                          fontWeight="medium"
                          cursor="pointer"
                          css={{
                            '&[data-disabled]': {
                              opacity: 0.3,
                              cursor: 'not-allowed',
                            },
                          }}
                        >
                          {month.label}
                        </Button>
                      </DatePicker.TableCellTrigger>
                    </Box>
                  </Tooltip>
                </DatePicker.TableCell>
              );
            })}
          </DatePicker.TableRow>
        ))}
      </DatePicker.TableBody>
    </DatePicker.Table>
  );
};
