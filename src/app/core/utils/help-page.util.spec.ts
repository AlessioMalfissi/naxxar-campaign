import { HelpPage } from '@core/models';
import { resolveHelpPage } from './help-page.util';

describe('helpPageUtil', () => {
    it('should resolve a section list', () => {
        // Arrange
        const url = '/campaigns/naxxar/npcs';

        // Act
        const page = resolveHelpPage(url);

        // Assert
        expect(page).toBe(HelpPage.Section);
    });

    it('should resolve an entry page', () => {
        // Arrange
        const url = '/campaigns/naxxar/npcs/vaelith-corrun';

        // Act
        const page = resolveHelpPage(url);

        // Assert
        expect(page).toBe(HelpPage.Entry);
    });

    it('should resolve the fixed campaign pages ahead of the section pattern', () => {
        // Arrange
        const urls = [
            '/campaigns/naxxar/inventory',
            '/campaigns/naxxar/combat',
            '/campaigns/naxxar/members'
        ];

        // Act
        const pages = urls.map((url) => resolveHelpPage(url));

        // Assert
        expect(pages).toEqual([HelpPage.Inventory, HelpPage.Combat, HelpPage.Members]);
    });

    it('should ignore the query string and fragment', () => {
        // Arrange
        const url = '/campaigns/naxxar/places?view=cards#top';

        // Act
        const page = resolveHelpPage(url);

        // Assert
        expect(page).toBe(HelpPage.Section);
    });

    it('should return null outside a campaign page', () => {
        // Arrange
        const urls = ['/login', '/campaigns', '/campaigns/naxxar', '/'];

        // Act
        const pages = urls.map((url) => resolveHelpPage(url));

        // Assert
        expect(pages.every((page) => page === null)).toBe(true);
    });
});
