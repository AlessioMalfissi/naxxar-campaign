import { HelpPage } from '@core/models';
import { resolveHelpPage } from './help-page.util';

describe('helpPageUtil', () => {
    it('should resolve a section list', () => {
        // Arrange
        const url = '/campaign/npcs';

        // Act
        const page = resolveHelpPage(url);

        // Assert
        expect(page).toBe(HelpPage.Section);
    });

    it('should resolve an entry page', () => {
        // Arrange
        const url = '/campaign/npcs/vaelith-corrun';

        // Act
        const page = resolveHelpPage(url);

        // Assert
        expect(page).toBe(HelpPage.Entry);
    });

    it('should resolve the inventory and combat pages ahead of the section pattern', () => {
        // Arrange
        const inventoryUrl = '/campaign/inventory';
        const combatUrl = '/campaign/combat';

        // Act
        const pages = [resolveHelpPage(inventoryUrl), resolveHelpPage(combatUrl)];

        // Assert
        expect(pages[0]).toBe(HelpPage.Inventory);
        expect(pages[1]).toBe(HelpPage.Combat);
    });

    it('should ignore the query string and fragment', () => {
        // Arrange
        const url = '/campaign/places?view=cards#top';

        // Act
        const page = resolveHelpPage(url);

        // Assert
        expect(page).toBe(HelpPage.Section);
    });

    it('should return null outside a campaign page', () => {
        // Arrange
        const urls = ['/login', '/campaign', '/'];

        // Act
        const pages = urls.map((url) => resolveHelpPage(url));

        // Assert
        expect(pages.every((page) => page === null)).toBe(true);
    });
});
