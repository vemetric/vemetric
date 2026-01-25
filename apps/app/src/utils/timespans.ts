import {
  parseTimeSpanDateValue,
  TIME_SPANS,
  getTimeSpanRangeMax,
  timeSpanRangeMin,
} from '@vemetric/common/charts/timespans';
import { format, isAfter, isBefore, isSameDay } from 'date-fns';
import { z } from 'zod';

const currentYear = new Date().getFullYear();

export const formatTimeSpanDateRange = (startDateStr: string, endDateStr?: string) => {
  const startDate = parseTimeSpanDateValue(startDateStr);
  const startDateObj = new Date(startDate.year, startDate.month - 1, startDate.day);

  if (!endDateStr) {
    if (startDate.year === currentYear) {
      return format(startDateObj, 'MMM d');
    }
    return format(startDateObj, 'MMM d, yyyy');
  }

  const endDate = parseTimeSpanDateValue(endDateStr);
  const endDateObj = new Date(endDate.year, endDate.month - 1, endDate.day);

  // Check if it's a full month range
  const daysInEndMonth = new Date(endDate.year, endDate.month, 0).getDate();
  const isFullMonth = startDate.day === 1 && endDate.day === daysInEndMonth;

  if (isFullMonth) {
    // Full month range
    if (startDate.year === endDate.year && startDate.month === endDate.month) {
      // Same month
      if (startDate.year === currentYear) {
        return format(startDateObj, 'MMMM');
      }
      return format(startDateObj, 'MMMM yyyy');
    } else {
      // Different months
      if (startDate.year === currentYear && endDate.year === currentYear) {
        return `${format(startDateObj, 'MMMM')} - ${format(endDateObj, 'MMMM')}`;
      } else if (startDate.year === endDate.year) {
        return `${format(startDateObj, 'MMMM')} - ${format(endDateObj, 'MMMM yyyy')}`;
      } else {
        return `${format(startDateObj, 'MMMM yyyy')} - ${format(endDateObj, 'MMMM yyyy')}`;
      }
    }
  }

  // Regular date range (not full months)
  if (startDate.year === endDate.year) {
    if (startDate.month === endDate.month) {
      if (startDate.year === currentYear) {
        return `${format(startDateObj, 'MMM d')} - ${format(endDateObj, 'd')}`;
      }
      return `${format(startDateObj, 'MMM d')} - ${format(endDateObj, 'd, yyyy')}`;
    } else {
      if (startDate.year === currentYear) {
        return `${format(startDateObj, 'MMM d')} - ${format(endDateObj, 'MMM d')}`;
      }
      return `${format(startDateObj, 'MMM d')} - ${format(endDateObj, 'MMM d, yyyy')}`;
    }
  } else {
    return `${format(startDateObj, 'MMM d, yyyy')} - ${format(endDateObj, 'MMM d, yyyy')}`;
  }
};

export const timespanSearchSchema = z.object({
  t: z.enum(TIME_SPANS).optional(),
  sd: z.string().optional(), // start date for custom range
  ed: z.string().optional(), // end date for custom range
});
type TimeSpanSearchSchema = z.infer<typeof timespanSearchSchema>;

export const timeSpanSearchMiddleware = ({
  search,
  next,
}: {
  search: TimeSpanSearchSchema;
  next: (search: TimeSpanSearchSchema) => TimeSpanSearchSchema;
}) => {
  const newSearch = next(search);

  if (newSearch.t !== 'custom') {
    delete newSearch.sd;
    delete newSearch.ed;
    return newSearch;
  } else {
    const { sd, ed } = newSearch;

    if (!sd) {
      delete newSearch.ed;
      newSearch.t = '24hrs';
      return newSearch;
    }

    const timeSpanRangeMax = getTimeSpanRangeMax();
    const startDate = parseTimeSpanDateValue(sd);
    const startDateObj = new Date(startDate.year, startDate.month - 1, startDate.day);
    if (
      isNaN(startDateObj.getTime()) ||
      isBefore(startDateObj, timeSpanRangeMin) ||
      isAfter(startDateObj, timeSpanRangeMax)
    ) {
      delete newSearch.sd;
      delete newSearch.ed;
      newSearch.t = '24hrs';
      return newSearch;
    }

    if (ed) {
      const endDate = parseTimeSpanDateValue(ed);
      const endDateObj = new Date(endDate.year, endDate.month - 1, endDate.day);
      if (isNaN(endDateObj.getTime()) || isBefore(endDateObj, startDateObj)) {
        delete newSearch.ed;
        return newSearch;
      }

      if (isSameDay(endDateObj, startDateObj) || isAfter(endDateObj, timeSpanRangeMax)) {
        delete newSearch.ed;
        return newSearch;
      }
    }

    return newSearch;
  }
};
