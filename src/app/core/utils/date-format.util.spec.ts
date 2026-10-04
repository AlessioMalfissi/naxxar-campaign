import { formatEuropeanDate, formatEuropeanDateTime, isEuropeanDate, toIsoDate } from './date-format.util';

describe('dateFormatUtil', () => {
    it('should format an iso date as day, month and year', () => {
        // Arrange
        const value = '2026-08-25';

        // Act
        const formatted = formatEuropeanDate(value);

        // Assert
        expect(formatted).toBe('25/08/2026');
    });

    it('should format a timestamp as a date in Malta time', () => {
        // Arrange
        const value = '2026-08-25T23:30:00.000Z';

        // Act
        const formatted = formatEuropeanDate(value);

        // Assert
        expect(formatted).toBe('26/08/2026');
    });

    it('should leave text that is not an iso date untouched', () => {
        // Arrange
        const values = ['', 'Late summer', '25 August'];

        // Act
        const formatted = values.map((value) => formatEuropeanDate(value));

        // Assert
        expect(formatted).toEqual(values);
    });

    it('should leave an invalid timestamp untouched', () => {
        // Arrange
        const value = '2026-13-45Tnope';

        // Act
        const formatted = formatEuropeanDate(value);

        // Assert
        expect(formatted).toBe(value);
    });

    it('should format a timestamp as a 24-hour date and time in Malta time', () => {
        // Arrange
        const summer = '2026-08-25T13:05:00.000Z';
        const winter = '2026-01-10T18:45:00.000Z';

        // Act
        const formatted = [formatEuropeanDateTime(summer), formatEuropeanDateTime(winter)];

        // Assert
        expect(formatted).toEqual(['25/08/2026 15:05', '10/01/2026 19:45']);
    });

    it('should fall back to the date format when there is no time', () => {
        // Arrange
        const value = '2026-08-25';

        // Act
        const formatted = formatEuropeanDateTime(value);

        // Assert
        expect(formatted).toBe('25/08/2026');
    });

    it('should accept only real calendar dates written as day, month and year', () => {
        // Arrange
        const values = ['25/08/2026', '5/8/2026', '29/02/2028', '31/04/2026', '2026-08-25', '25-08-2026'];

        // Act
        const results = values.map((value) => isEuropeanDate(value));

        // Assert
        expect(results).toEqual([true, true, true, false, false, false]);
    });

    it('should convert a european date into an iso date', () => {
        // Arrange
        const values = ['25/08/2026', ' 5/8/2026 '];

        // Act
        const converted = values.map((value) => toIsoDate(value));

        // Assert
        expect(converted).toEqual(['2026-08-25', '2026-08-05']);
    });

    it('should return other text trimmed when converting', () => {
        // Arrange
        const value = '  Late summer ';

        // Act
        const converted = toIsoDate(value);

        // Assert
        expect(converted).toBe('Late summer');
    });
});
