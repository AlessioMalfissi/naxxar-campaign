import { CodexSection } from './codex-section.enum';

export type SectionFieldKind = 'text' | 'reference' | 'date';

export interface ISectionField {
    key: string;
    label: string;
    kind: SectionFieldKind;
}

export interface ISectionDefinition {
    section: CodexSection;
    label: string;
    icon: string;
    statuses: string[];
    fields: ISectionField[];
    listColumns: string[];
}

export const SECTION_DEFINITIONS: readonly ISectionDefinition[] = [
    {
        section: CodexSection.Npcs,
        label: 'NPCs',
        icon: 'group',
        statuses: ['Alive', 'Dead', 'Missing', 'Unknown'],
        fields: [
            { key: 'race', label: 'Race', kind: 'text' },
            { key: 'role', label: 'Role', kind: 'text' },
            { key: 'affiliation', label: 'Affiliation', kind: 'reference' },
            { key: 'location', label: 'Location', kind: 'reference' },
            { key: 'disposition', label: 'Disposition', kind: 'text' },
            { key: 'firstAppearance', label: 'First appearance', kind: 'reference' }
        ],
        listColumns: ['race', 'role']
    },
    {
        section: CodexSection.Players,
        label: 'Players',
        icon: 'person',
        statuses: ['Active', 'Retired', 'Deceased'],
        fields: [
            { key: 'player', label: 'Player', kind: 'text' },
            { key: 'character', label: 'Character', kind: 'text' },
            { key: 'class', label: 'Class and level', kind: 'text' },
            { key: 'race', label: 'Race', kind: 'text' },
            { key: 'background', label: 'Background', kind: 'text' },
            { key: 'ties', label: 'Ties', kind: 'reference' }
        ],
        listColumns: ['player', 'class']
    },
    {
        section: CodexSection.Places,
        label: 'Places',
        icon: 'place',
        statuses: ['Visited', 'Unvisited', 'Destroyed'],
        fields: [
            { key: 'type', label: 'Type', kind: 'text' },
            { key: 'parent', label: 'Parent place', kind: 'reference' },
            { key: 'ruledBy', label: 'Ruled by', kind: 'reference' },
            { key: 'notableNpcs', label: 'Notable NPCs', kind: 'reference' }
        ],
        listColumns: ['type', 'ruledBy']
    },
    {
        section: CodexSection.Organizations,
        label: 'Organizations',
        icon: 'shield',
        statuses: ['Active', 'Disbanded', 'Hostile'],
        fields: [
            { key: 'type', label: 'Type', kind: 'text' },
            { key: 'headquarters', label: 'Headquarters', kind: 'reference' },
            { key: 'leader', label: 'Leader', kind: 'reference' },
            { key: 'members', label: 'Members', kind: 'text' },
            { key: 'standing', label: 'Party standing', kind: 'text' }
        ],
        listColumns: ['type', 'leader']
    },
    {
        section: CodexSection.Story,
        label: 'Story so far',
        icon: 'book',
        statuses: ['Draft', 'Published'],
        fields: [
            { key: 'session', label: 'Session', kind: 'text' },
            { key: 'inWorldDate', label: 'In-world date', kind: 'text' },
            { key: 'realDate', label: 'Real date', kind: 'date' },
            { key: 'attending', label: 'Attending', kind: 'text' }
        ],
        listColumns: ['session', 'realDate']
    }
];

export const findSectionDefinition = (section: CodexSection): ISectionDefinition => {
    const definition = SECTION_DEFINITIONS.find((item) => item.section === section);
    if (definition === undefined) {
        throw new Error(`Unknown codex section: ${section}`);
    }
    return definition;
};
