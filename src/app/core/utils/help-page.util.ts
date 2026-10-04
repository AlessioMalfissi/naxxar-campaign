import { HelpPage } from '../models';

const CAMPAIGN_SEGMENT = 'campaign';

// Maps a router URL inside the campaign shell onto the page whose help topics apply to it.
// Mirrors the child routes in app.routes.ts: the fixed `inventory` and `combat` paths win over
// the `:section` and `:section/:slug` patterns.
export const resolveHelpPage = (url: string): HelpPage | null => {
    const path = url.split(/[?#]/)[0];
    const segments = path.split('/').filter((segment) => segment !== '');

    if (segments[0] !== CAMPAIGN_SEGMENT || segments.length < 2) {
        return null;
    }

    if (segments[1] === 'inventory') {
        return HelpPage.Inventory;
    }

    if (segments[1] === 'combat') {
        return HelpPage.Combat;
    }

    return segments.length === 2 ? HelpPage.Section : HelpPage.Entry;
};
