import { HelpPage } from '../models';

// Maps a router URL inside the campaign shell onto the page whose help topics apply to it.
// URLs look like `/campaigns/:slug/...`, so the campaign slug comes first and the page segment is
// at index 2. The fixed `inventory`, `combat` and `members` paths win over `:section`/`:section/:slug`.
export const resolveHelpPage = (url: string): HelpPage | null => {
    const path = url.split(/[?#]/)[0];
    const segments = path.split('/').filter((segment) => segment !== '');

    if (segments[0] !== 'campaigns' || segments.length < 3) {
        return null;
    }

    if (segments[2] === 'inventory') {
        return HelpPage.Inventory;
    }

    if (segments[2] === 'combat') {
        return HelpPage.Combat;
    }

    if (segments[2] === 'members') {
        return HelpPage.Members;
    }

    return segments.length === 3 ? HelpPage.Section : HelpPage.Entry;
};
