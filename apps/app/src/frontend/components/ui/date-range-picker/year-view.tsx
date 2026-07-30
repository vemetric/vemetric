import { Box, Button, DatePicker, useDatePickerContext } from '@chakra-ui/react';
import { getDatePickerDisabledTooltip } from '@/utils/timespans';
import { Tooltip } from '../tooltip';

interface Props {
  minDate: Date;
  maxDate: Date;
  minRangeDisabledTooltip?: string;
  maxRangeDisabledTooltip?: string;
}

export const YearView = ({ minDate, maxDate, minRangeDisabledTooltip, maxRangeDisabledTooltip }: Props) => {
  const datePicker = useDatePickerContext();
  const currentYear = new Date().getFullYear();

  return (
    <DatePicker.Table w="100%">
      <DatePicker.TableBody>
        {datePicker.getYearsGrid({ columns: 4 }).map((years, id) => (
          <DatePicker.TableRow key={id} _notLast={{ '& > td': { pb: '3px' } }}>
            {years.map((year) => {
              const yearStart = new Date(year.value, 0, 1);
              const isCurrentYear = year.value === currentYear;
              const disabledTooltip = getDatePickerDisabledTooltip({
                date: yearStart,
                minDate,
                maxDate,
                minRangeDisabledTooltip,
                maxRangeDisabledTooltip,
                disabled: Boolean(year.disabled),
              });

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
                          data-current={isCurrentYear ? '' : undefined}
                          css={{
                            '&[data-current]': {
                              border: '1px solid',
                              borderColor: 'gray.muted',
                            },
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
