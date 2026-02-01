import { DatePicker, useDatePickerContext } from '@ark-ui/react/date-picker';
import { Button } from '@chakra-ui/react';
import { DatePickerTable, DatePickerTableCell, DatePickerTableRow } from '../date-picker';

export const YearView = () => {
  const datePicker = useDatePickerContext();

  return (
    <DatePickerTable w="100%">
      <DatePicker.TableBody>
        {datePicker.getYearsGrid({ columns: 4 }).map((years, id) => (
          <DatePickerTableRow key={id} _notLast={{ '& > td': { pb: '3px' } }}>
            {years.map((year, id) => (
              <DatePickerTableCell key={id} value={year.value}>
                <DatePicker.TableCellTrigger asChild>
                  <Button variant="ghost" w="100%" h="60px" fontSize="0.95rem" fontWeight="medium">
                    {year.label}
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
