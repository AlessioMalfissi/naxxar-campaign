import { CodexSection, EntryVisibility, ICodexEntry, ICodexEntrySummary } from '@core/models';

export const buildSummary = (overrides: Partial<ICodexEntrySummary> = {}): ICodexEntrySummary => ({
    id: 'npcs:vaelith-corrun',
    section: CodexSection.Npcs,
    slug: 'vaelith-corrun',
    path: 'assets/codex/npcs/vaelith-corrun.md',
    title: 'Vaelith Corrun',
    status: 'Alive',
    tags: ['ally', 'silver-ledger'],
    favourite: false,
    visibility: EntryVisibility.Revealed,
    author: 'DM',
    updatedAt: '2026-08-25T09:00:00.000Z',
    fields: { race: 'Half-elf', role: 'Broker' },
    excerpt: 'Broker of debts in the Silver ledger.',
    ...overrides
});

export const buildEntry = (overrides: Partial<ICodexEntry> = {}): ICodexEntry => ({
    ...buildSummary(overrides),
    body: '# Who he is\n\nBroker of debts.',
    ...overrides
});
