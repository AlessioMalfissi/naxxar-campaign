export const MALTA_TIME_ZONE = 'Europe/Malta';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T/;
const EUROPEAN_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
    timeZone: MALTA_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
    timeZone: MALTA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
});

const parseTimestamp = (value: string): Date | null => {
    if (!ISO_DATE_TIME_PATTERN.test(value)) {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const isValidCalendarDate = (year: number, month: number, day: number): boolean => {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

/** Formats an ISO date (YYYY-MM-DD) or timestamp as DD/MM/YYYY in Malta time; other text is returned as is. */
export const formatEuropeanDate = (value: string): string => {
    const isoDate = ISO_DATE_PATTERN.exec(value);
    if (isoDate !== null) {
        const [, year, month, day] = isoDate;
        return `${day}/${month}/${year}`;
    }

    const timestamp = parseTimestamp(value);
    return timestamp === null ? value : DATE_FORMATTER.format(timestamp);
};

/** Formats an ISO timestamp as DD/MM/YYYY HH:mm (24-hour) in Malta time; other text is returned as is. */
export const formatEuropeanDateTime = (value: string): string => {
    const timestamp = parseTimestamp(value);
    if (timestamp === null) {
        return formatEuropeanDate(value);
    }

    return `${DATE_FORMATTER.format(timestamp)} ${TIME_FORMATTER.format(timestamp)}`;
};

export const isEuropeanDate = (value: string): boolean => {
    const match = EUROPEAN_DATE_PATTERN.exec(value.trim());
    if (match === null) {
        return false;
    }
    const [, day, month, year] = match;
    return isValidCalendarDate(Number(year), Number(month), Number(day));
};

/** Converts DD/MM/YYYY into an ISO date (YYYY-MM-DD); other text is returned trimmed. */
export const toIsoDate = (value: string): string => {
    const trimmed = value.trim();
    if (!isEuropeanDate(trimmed)) {
        return trimmed;
    }
    const [day, month, year] = trimmed.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};
