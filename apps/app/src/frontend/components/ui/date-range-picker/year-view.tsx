import { Box, Button, DatePicker, useDatePickerContext } from '@chakra-ui/react';
import { isAfter, isBefore } from 'date-fns';
import { Tooltip } from '../tooltip';

interface Props {
  minDate: Date;
  maxDate: Date;
  minRangeDisabledTooltip?: string;
  maxRangeDisabledTooltip?: string;
}

export const YearView = ({ minDate, maxDate, minRangeDisabledTooltip, maxRangeDisabledTooltip }: Props) => {
  const datePicker = useDatePickerContext();

  return (
    <DatePicker.Table w="100%">
      <DatePicker.TableBody>
        {datePicker.getYearsGrid({ columns: 4 }).map((years, id) => (
          <DatePicker.TableRow key={id} _notLast={{ '& > td': { pb: '3px' } }}>
            {years.map((year) => {
              const yearStart = new Date(year.value, 0, 1);
              const disabledTooltip =
                Boolean(year.disabled) && isBefore(yearStart, minDate)
                  ? minRangeDisabledTooltip
                  : Boolean(year.disabled) && isAfter(yearStart, maxDate)
                    ? maxRangeDisabledTooltip
                    : undefined;

              return (
                <DatePicker.TableCell key={year.value} value={year.value}>
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
                          {year.label}
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
