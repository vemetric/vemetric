import { formatDistanceStrict } from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';

const formatDistanceShortLocale: Record<string, string> = {
  lessThanXSeconds: '{{count}}s',
  xSeconds: '{{count}}s',
  halfAMinute: '30s',
  lessThanXMinutes: '{{count}}m',
  xMinutes: '{{count}}m',
  aboutXHours: '{{count}}h',
  xHours: '{{count}}h',
  xDays: '{{count}}d',
  aboutXWeeks: '{{count}}w',
  xWeeks: '{{count}}w',
  aboutXMonths: '{{count}}mo',
  xMonths: '{{count}}mo',
  aboutXYears: '{{count}}y',
  xYears: '{{count}}y',
  overXYears: '{{count}}y',
  almostXYears: '{{count}}y',
};
function formatDistanceShort(token: string, count: number) {
  const result = formatDistanceShortLocale[token].replace('{{count}}', String(count));

  return result;
}

const LOCALE = 'de-DE';

class DateTimeFormatter {
  private _monthFormatter?: Intl.DateTimeFormat;
  private _monthYearFormatter?: Intl.DateTimeFormat;
  private _dateTimeFormatter?: Intl.DateTimeFormat;
  private _dateFormatter?: Intl.DateTimeFormat;
  private _timeFormatter?: Intl.DateTimeFormat;
  private _timeSecondsFormatter?: Intl.DateTimeFormat;

  constructor() {
    this.formatMonth = this.formatMonth.bind(this);
    this.formatMonthYear = this.formatMonthYear.bind(this);
    this.formatDateTime = this.formatDateTime.bind(this);
    this.formatDate = this.formatDate.bind(this);
    this.formatTime = this.formatTime.bind(this);
  }

  private prepareDate(dateTime: string | Date) {
    return typeof dateTime === 'string' ? new Date(dateTime.replace(' ', 'T') + 'Z') : dateTime;
  }

  private get monthFormatter() {
    if (!this._monthFormatter) {
      this._monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
    }
    return this._monthFormatter;
  }

  private get monthYearFormatter() {
    if (!this._monthYearFormatter) {
      this._monthYearFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit' });
    }
    return this._monthYearFormatter;
  }

  private get dateTimeFormatter() {
    if (!this._dateTimeFormatter) {
      this._dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }

    return this._dateTimeFormatter;
  }

  private get dateFormatter() {
    if (!this._dateFormatter) {
      this._dateFormatter = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return this._dateFormatter;
  }

  private get timeFormatter() {
    if (!this._timeFormatter) {
      this._timeFormatter = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });
    }
    return this._timeFormatter;
  }

  private get timeSecondsFormatter() {
    if (!this._timeSecondsFormatter) {
      this._timeSecondsFormatter = new Intl.DateTimeFormat(LOCALE, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    }
    return this._timeSecondsFormatter;
  }

  formatMonth(value: string | Date) {
    const date = this.prepareDate(value);

    return this.monthFormatter.format(date);
  }

  formatMonthYear(value: string | Date) {
    const date = this.prepareDate(value);

    return this.monthYearFormatter.format(date);
  }

  formatDateTime(value: string | Date) {
    const date = this.prepareDate(value);

    return this.dateTimeFormatter.format(date);
  }

  formatDate(value: string | Date) {
    const date = this.prepareDate(value);

    return this.dateFormatter.format(date);
  }

  formatTime(value: string | Date, seconds = false) {
    const date = this.prepareDate(value);

    return seconds ? this.timeSecondsFormatter.format(date) : this.timeFormatter.format(date);
  }

  formatDuration(value: number) {
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const seconds = Math.round(value % 60);

    let result = `${seconds}s`;
    if (minutes > 0) {
      result = `${minutes}m ${result}`;
    }
    if (hours > 0) {
      result = `${hours}h ${result}`;
    }

    return result;
  }

  formatDistance(startedAt: string | Date, endedAt: string | Date, short = false) {
    const start = this.prepareDate(startedAt);
    const end = this.prepareDate(endedAt);

    return formatDistanceStrict(start, end, {
      locale: { ...enUS, formatDistance: short ? formatDistanceShort : enUS.formatDistance },
    });
  }

  formatDistanceNow(value: string | Date, short = false) {
    return this.formatDistance(value, new Date(), short);
  }
}

export const dateTimeFormatter = new DateTimeFormatter();
