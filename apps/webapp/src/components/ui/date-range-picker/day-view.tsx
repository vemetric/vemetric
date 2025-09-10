import { DatePicker, useDatePickerContext } from '@ark-ui/react/date-picker';
import {
  DatePickerTable,
  DatePickerTableCell,
  DatePickerTableCellTrigger,
  DatePickerTableHeader,
  DatePickerTableRow,
} from '../date-picker';

interface Props {
  monthOffset: number;
}

export const DayView = (props: Props) => {
  const { monthOffset } = props;
  const datePicker = useDatePickerContext();
  const offset = datePicker.getOffset({ months: monthOffset });

  return (
    <DatePickerTable w="100%">
      <DatePicker.TableHead>
        <DatePicker.TableRow>
          {datePicker.weekDays.map((weekDay, id) => (
            <DatePickerTableHeader key={id} fontWeight="semibold" opacity="0.8" textAlign="center" pb={2}>
              {weekDay.short}
            </DatePickerTableHeader>
          ))}
        </DatePicker.TableRow>
      </DatePicker.TableHead>
      <DatePicker.TableBody>
        {offset.weeks.map((week, id) => (
          <DatePickerTableRow key={id} _notLast={{ '& > td': { pb: '3px' } }}>
            {week.map((day, id) => (
              <DatePickerTableCell key={id} value={day} visibleRange={offset.visibleRange} boxSize="45px">
                <DatePickerTableCellTrigger
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
                </DatePickerTableCellTrigger>
              </DatePickerTableCell>
            ))}
          </DatePickerTableRow>
        ))}
      </DatePicker.TableBody>
    </DatePickerTable>
  );
};
