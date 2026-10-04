import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import { HelpPage } from '@core/models';
import { HELP_PAGE_LABELS, helpTopicsFor } from './help-topics';

const APP_ROOT = join(__dirname, '..', '..');

const readTemplates = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((item) => {
        const path = join(directory, item.name);
        if (item.isDirectory()) {
            return readTemplates(path);
        }
        return item.name.endsWith('.html') ? [readFileSync(path, 'utf8')] : [];
    });

describe('helpTopics', () => {
    const pages = Object.values(HelpPage);

    it('should list the page topics ahead of the shell topics', () => {
        // Arrange
        const shellTopics = helpTopicsFor(null);

        // Act
        const combatTopics = helpTopicsFor(HelpPage.Combat);

        // Assert
        expect(combatTopics[0].id).toBe('combat-refresh');
        expect(combatTopics.slice(-shellTopics.length).every((topic, index) => topic === shellTopics[index])).toBe(
            true
        );
    });

    it('should keep topic ids unique within a page', () => {
        // Arrange
        const topicLists = pages.map((page) => helpTopicsFor(page));

        // Act
        const unique = topicLists.every((topics) => new Set(topics.map((topic) => topic.id)).size === topics.length);

        // Assert
        expect(unique).toBe(true);
    });

    it('should label every page', () => {
        // Arrange
        const labels = pages.map((page) => HELP_PAGE_LABELS[page]);

        // Act
        const allLabelled = labels.every((label) => label !== undefined && label !== '');

        // Assert
        expect(allLabelled).toBe(true);
    });

    it('should point every topic at a data-help anchor in a template', () => {
        // Arrange
        const templates = readTemplates(APP_ROOT).join('\n');
        const ids = new Set(pages.flatMap((page) => helpTopicsFor(page).map((topic) => topic.id)));

        // Act
        const missing = [...ids].filter((id) => !templates.includes(`data-help="${id}"`));

        // Assert
        expect(missing).toEqual([]);
    });
});
