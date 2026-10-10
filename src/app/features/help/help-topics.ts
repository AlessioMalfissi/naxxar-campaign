import { HelpCategory, HelpPage, IHelpTopic } from '@core/models';

// Each topic's `id` must match a `data-help` attribute somewhere in the campaign shell. Topics
// whose element isn't rendered (e.g. DM-only controls in player view) are skipped by the overlay.

export const HELP_PAGE_LABELS: Readonly<Record<HelpPage, string>> = {
    [HelpPage.Section]: 'Section list',
    [HelpPage.Entry]: 'Entry',
    [HelpPage.Inventory]: 'Inventory',
    [HelpPage.Combat]: 'Combat'
};

const SECTION_TOPICS: readonly IHelpTopic[] = [
    {
        id: 'section-view',
        category: HelpCategory.Navigation,
        title: 'Table or cards',
        body: 'Switch between a compact table and a grid of cards with excerpts. The choice applies to every section.'
    },
    {
        id: 'section-status-filter',
        category: HelpCategory.Filtering,
        title: 'Filter by status',
        body: 'Pick a status to show only matching entries. Click the same chip again to clear it.'
    },
    {
        id: 'section-tag-filter',
        category: HelpCategory.Filtering,
        title: 'Filter by tag',
        body: 'Select one or more tags to narrow the list down. Tags come from the entries in this section.'
    },
    {
        id: 'section-entries',
        category: HelpCategory.Navigation,
        title: 'Open an entry',
        body: 'Click a row or card (or focus it and press Enter) to open the full entry.'
    }
];

const ENTRY_TOPICS: readonly IHelpTopic[] = [
    {
        id: 'entry-favourite',
        category: HelpCategory.Actions,
        title: 'Favourite',
        body: 'Star an entry to mark it as one to keep an eye on.'
    },
    {
        id: 'entry-status',
        category: HelpCategory.Editing,
        title: 'Change status',
        body: 'Set the entry status, e.g. mark an NPC as dead or a place as visited. It saves straight away.'
    },
    {
        id: 'entry-actions',
        category: HelpCategory.Actions,
        title: 'Entry actions',
        body: 'Edit the title, tags, visibility and fields, export the entry as a markdown file, or delete it.'
    },
    {
        id: 'entry-fields',
        category: HelpCategory.Navigation,
        title: 'Entry details',
        body: 'The structured fields for this section. Change them from the actions menu under "Edit details".'
    },
    {
        id: 'entry-toolbar',
        category: HelpCategory.Editing,
        title: 'Formatting toolbar',
        body: 'Apply bold, headings, lists, links and more. Hover a button to see its keyboard shortcut. The eye button switches between edit, split and preview.'
    },
    {
        id: 'entry-editor',
        category: HelpCategory.Editing,
        title: 'Write in markdown',
        body: 'The body is plain markdown. Link another entry with [[section:slug]], e.g. [[npcs:vaelith-corrun]].'
    },
    {
        id: 'entry-save',
        category: HelpCategory.Actions,
        title: 'Saving',
        body: 'Changes save automatically a couple of seconds after you stop typing. Save entry saves now; Cancel reverts unsaved changes.'
    },
    {
        id: 'entry-references',
        category: HelpCategory.Navigation,
        title: 'References',
        body: 'Entries this one mentions, and entries that mention it. Click one to jump there.'
    }
];

const INVENTORY_TOPICS: readonly IHelpTopic[] = [
    {
        id: 'inventory-filters',
        category: HelpCategory.Filtering,
        title: 'Find items',
        body: 'Search by name and filter by rarity, status, for sale or IMP. Clear filters resets them all.'
    },
    {
        id: 'inventory-add',
        category: HelpCategory.Editing,
        title: 'Add an item',
        body: 'Name the item, set its quantity, rarity and status, and assign it to the party or a player.'
    },
    {
        id: 'inventory-gold',
        category: HelpCategory.Editing,
        title: 'Gold',
        body: 'Each group has its own gold purse. Type a new amount to update it.'
    },
    {
        id: 'inventory-row',
        category: HelpCategory.Editing,
        title: 'Edit an item',
        body: 'Use - and + to change the quantity, and the dropdowns to change rarity, status or who carries it.'
    },
    {
        id: 'inventory-flags',
        category: HelpCategory.Editing,
        title: 'Party item flags',
        body: 'Party items can be flagged for sale or as IMP, with an optional tag to group them.'
    }
];

const COMBAT_TOPICS: readonly IHelpTopic[] = [
    {
        id: 'combat-refresh',
        category: HelpCategory.Actions,
        title: 'Refresh',
        body: 'Reload the encounter by hand. Live sync normally does this for you.'
    },
    {
        id: 'combat-live',
        category: HelpCategory.Navigation,
        title: 'Live sync',
        body: 'Every change made on any device shows up here straight away. Offline means the connection dropped; it reconnects on its own.'
    },
    {
        id: 'combat-controls',
        category: HelpCategory.Actions,
        title: 'Run the encounter',
        body: 'Start combat once the turn order is ready, then step through turns. Previous goes back a turn; End combat removes the enemies and resets the round.'
    },
    {
        id: 'combat-add-player',
        category: HelpCategory.Editing,
        title: 'Add a player',
        body: 'Pull a character from the Players section into the turn order.'
    },
    {
        id: 'combat-add-enemy',
        category: HelpCategory.Editing,
        title: 'Add enemies',
        body: 'Add one or several enemies at once; copies are numbered. Leave initiative blank to roll a separate d20 for each.'
    },
    {
        id: 'combat-initiative',
        category: HelpCategory.Editing,
        title: 'Initiative',
        body: 'Edit a combatant\'s initiative to reorder them. The smaller box is a tie-break: among equal initiatives, the higher one acts first.'
    },
    {
        id: 'combat-identity',
        category: HelpCategory.Editing,
        title: 'Name and colour',
        body: 'Rename a combatant or pick a row colour to tell similar enemies apart.'
    },
    {
        id: 'combat-conditions',
        category: HelpCategory.Editing,
        title: 'Conditions',
        body: 'Add conditions with an optional description and duration in rounds. Click a condition to edit it.'
    }
];

const SHELL_TOPICS: readonly IHelpTopic[] = [
    {
        id: 'search',
        category: HelpCategory.Navigation,
        title: 'Search the codex',
        body: 'Type at least two letters to search titles, excerpts and tags across every section, then pick a result to open it.'
    },
    {
        id: 'account-menu',
        category: HelpCategory.Actions,
        title: 'Account',
        body: 'Switch to player view to see the codex as the players do (DM-only entries and controls hidden), or sign out.'
    },
    {
        id: 'sidebar-toggle',
        category: HelpCategory.Navigation,
        title: 'Sidebar',
        body: 'Collapse the sidebar to an icon rail to make room for content, or expand it again.'
    },
    {
        id: 'new-entry',
        category: HelpCategory.Editing,
        title: 'New entry',
        body: 'Create an entry in any section. You can fill in the body once it opens.'
    },
    {
        id: 'sections-nav',
        category: HelpCategory.Navigation,
        title: 'Sections',
        body: 'Jump between the codex sections. The number shows how many entries each one holds.'
    },
    {
        id: 'party-nav',
        category: HelpCategory.Navigation,
        title: 'Party',
        body: 'The shared inventory and the combat tracker. The tracker shows the current round while a fight is on.'
    },
    {
        id: 'recent-entries',
        category: HelpCategory.Navigation,
        title: 'Recent entries',
        body: 'Entries you opened recently in the current section, for quick back-and-forth.'
    }
];

const PAGE_TOPICS: Readonly<Record<HelpPage, readonly IHelpTopic[]>> = {
    [HelpPage.Section]: SECTION_TOPICS,
    [HelpPage.Entry]: ENTRY_TOPICS,
    [HelpPage.Inventory]: INVENTORY_TOPICS,
    [HelpPage.Combat]: COMBAT_TOPICS
};

// Page topics come first so the tour starts with what's specific to the current page.
export const helpTopicsFor = (page: HelpPage | null): readonly IHelpTopic[] =>
    page === null ? SHELL_TOPICS : [...PAGE_TOPICS[page], ...SHELL_TOPICS];
