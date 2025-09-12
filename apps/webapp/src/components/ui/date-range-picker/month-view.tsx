import { DatePicker, useDatePickerContext } from '@ark-ui/react/date-picker';
import { Button } from '@chakra-ui/react';
import { DatePickerTable, DatePickerTableCell, DatePickerTableRow } from '../date-picker';

export const MonthView = () => {
  const datePicker = useDatePickerContext();

  return (
    <DatePickerTable w="100%">
      <DatePicker.TableBody>
        {datePicker.getMonthsGrid({ columns: 4, format: 'short' }).map((months, id) => (
          <DatePickerTableRow key={id} _notLast={{ '& > td': { pb: '3px' } }}>
            {months.map((month, id) => (
              <DatePickerTableCell key={id} value={month.value}>
                <DatePicker.TableCellTrigger asChild>
                  <Button variant="ghost" w="100%" h="60px" fontSize="0.95rem" fontWeight="medium">
                    {month.label}
                  </Button>
                </DatePicker.TableCellTrigger>
              </DatePickerTableCell>
            ))}
          </DatePickerTableRow>
        ))}
      </DatePicker.TableBody>
    </DatePickerTable>
  );
};
