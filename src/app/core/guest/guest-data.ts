import {
    CodexSection,
    CombatantKind,
    EntryVisibility,
    ICampaignMember,
    ICampaignSummary,
    ICodexEntry,
    ICodexEntrySummary,
    IEncounter,
    IInventoryItem,
    IPurse,
    IPublicConfig,
    IUser,
    ItemRarity,
    ItemStatus
} from '../models';

export const GUEST_STORAGE_KEY = 'naxxar.guest-session';
export const GUEST_CAMPAIGN_SLUG = 'demo';
export const GUEST_READ_ONLY_MESSAGE = 'The demo is read-only. Create an account to make changes.';

export const GUEST_CONFIG: IPublicConfig = { googleClientId: null };

export const GUEST_USER: IUser = {
    id: 'guest-user',
    email: 'guest@example.invalid',
    displayName: 'Demo guest'
};

export const GUEST_CAMPAIGN: ICampaignSummary = {
    id: 'guest-campaign',
    slug: GUEST_CAMPAIGN_SLUG,
    name: 'Naxxar (demo)',
    role: 'player'
};

export const GUEST_MEMBERS: readonly ICampaignMember[] = [
    {
        userId: 'guest-dm',
        displayName: 'Alex',
        role: 'dm',
        joinedAt: '2026-01-12T18:00:00.000Z'
    },
    {
        userId: GUEST_USER.id,
        displayName: 'Demo guest',
        role: 'player',
        joinedAt: '2026-11-25T12:00:00.000Z'
    },
    {
        userId: 'guest-ben',
        displayName: 'Ben',
        role: 'player',
        joinedAt: '2026-02-03T19:30:00.000Z'
    },
    {
        userId: 'guest-marta',
        displayName: 'Marta',
        role: 'player',
        joinedAt: '2026-02-03T19:32:00.000Z'
    }
];

export const GUEST_INVENTORY: readonly IInventoryItem[] = [
    {
        id: 'guest-item-potion',
        name: 'Potion of healing',
        description: 'Restores 2d4+2 hit points.',
        quantity: 4,
        owner: 'party',
        rarity: ItemRarity.Common,
        status: ItemStatus.Magic,
        forSale: false,
        imp: false,
        impTag: '',
        updatedAt: '2026-08-25T00:00:00.000Z'
    },
    {
        id: 'guest-item-rope',
        name: 'Rope of climbing',
        description: 'The rope can be commanded to climb or anchor itself.',
        quantity: 1,
        owner: 'party',
        rarity: ItemRarity.Uncommon,
        status: ItemStatus.NonAttuned,
        forSale: false,
        imp: false,
        impTag: '',
        updatedAt: '2026-08-20T00:00:00.000Z'
    },
    {
        id: 'guest-item-tools',
        name: "Thieves' tools",
        description: 'Picks, files and a small mirror in a leather roll.',
        quantity: 1,
        owner: 'players:serrik-vane',
        rarity: ItemRarity.None,
        status: ItemStatus.Mundane,
        forSale: false,
        imp: false,
        impTag: '',
        updatedAt: '2026-08-18T00:00:00.000Z'
    },
    {
        id: 'guest-item-dagger',
        name: 'Dagger +1',
        description: 'A narrow blade with a ledger mark on the pommel.',
        quantity: 1,
        owner: 'players:serrik-vane',
        rarity: ItemRarity.Uncommon,
        status: ItemStatus.Attuned,
        forSale: false,
        imp: false,
        impTag: '',
        updatedAt: '2026-08-18T00:00:00.000Z'
    },
    {
        id: 'guest-item-symbol',
        name: 'Silver holy symbol',
        description: 'Worn smooth by years of use.',
        quantity: 1,
        owner: 'players:tessaly-oakhand',
        rarity: ItemRarity.Common,
        status: ItemStatus.NonAttuned,
        forSale: false,
        imp: false,
        impTag: '',
        updatedAt: '2026-08-24T00:00:00.000Z'
    },
    {
        id: 'guest-item-map',
        name: 'Scorched ledger page',
        description: 'Part of the third volume, recovered from the fire on Emberfall road.',
        quantity: 1,
        owner: 'party',
        rarity: ItemRarity.Rare,
        status: ItemStatus.Magic,
        forSale: false,
        imp: true,
        impTag: 'Story item - do not sell',
        updatedAt: '2026-08-18T22:30:00.000Z'
    }
];

export const GUEST_PURSES: readonly IPurse[] = [
    { owner: 'party', gold: 120 },
    { owner: 'players:serrik-vane', gold: 40 },
    { owner: 'players:tessaly-oakhand', gold: 25 }
];

export const GUEST_ENCOUNTER: IEncounter = {
    revision: 4,
    round: 2,
    turnId: 'players:serrik-vane',
    combatants: [
        {
            id: 'players:tessaly-oakhand',
            name: 'Tessaly Oakhand',
            kind: CombatantKind.Player,
            entryId: 'players:tessaly-oakhand',
            initiative: 18,
            initiativeNudge: 0,
            color: null,
            hp: 21,
            maxHp: 24,
            ac: 16,
            legendaryActions: { max: 0, remaining: 0 },
            legendaryResistances: { max: 0, remaining: 0 },
            conditions: [
                {
                    name: 'Blessed',
                    rounds: 3,
                    description: 'Add 1d4 to attack rolls and saving throws.'
                }
            ],
            dead: false
        },
        {
            id: 'players:serrik-vane',
            name: 'Serrik Vane',
            kind: CombatantKind.Player,
            entryId: 'players:serrik-vane',
            initiative: 16,
            initiativeNudge: 0,
            color: null,
            hp: 30,
            maxHp: 30,
            ac: 15,
            legendaryActions: { max: 0, remaining: 0 },
            legendaryResistances: { max: 0, remaining: 0 },
            conditions: [],
            dead: false
        },
        {
            id: 'guest-enemy-initiate',
            name: 'Ashen choir initiate',
            kind: CombatantKind.Enemy,
            entryId: null,
            initiative: 12,
            initiativeNudge: 0,
            color: null,
            hp: null,
            maxHp: null,
            ac: null,
            legendaryActions: { max: 0, remaining: 0 },
            legendaryResistances: { max: 0, remaining: 0 },
            conditions: [],
            dead: false
        },
        {
            id: 'guest-enemy-choir-singer',
            name: 'Ashen choir singer',
            kind: CombatantKind.Enemy,
            entryId: null,
            initiative: 9,
            initiativeNudge: 0,
            color: null,
            hp: null,
            maxHp: null,
            ac: null,
            legendaryActions: { max: 0, remaining: 0 },
            legendaryResistances: { max: 0, remaining: 0 },
            conditions: [],
            dead: false
        }
    ]
};

export const GUEST_ENTRIES: readonly ICodexEntry[] = [
    {
        id: 'npcs:vaelith-corrun',
        section: CodexSection.Npcs,
        slug: 'vaelith-corrun',
        path: 'assets/codex/npcs/vaelith-corrun.md',
        title: 'Vaelith Corrun',
        status: 'Alive',
        tags: ['Half-elf', 'Silver ledger'],
        favourite: true,
        visibility: EntryVisibility.Revealed,
        author: 'DM',
        updatedAt: '2026-08-25T09:12:00.000Z',
        fields: {
            race: 'Half-elf',
            role: 'Broker of debts',
            affiliation: 'organizations:silver-ledger',
            location: 'places:ashfall-city',
            disposition: 'Cautiously friendly',
            firstAppearance: 'story:session-09'
        },
        excerpt: 'Broker of debts in the Silver ledger, and the only man in Ashfall who will lend against a memory.',
        body: `# Who he is

Broker of debts in the **Silver ledger**, and the only man in Ashfall who will lend against a memory. Speaks softly, counts twice.

- Owes the party a favour after the vault job
- Terrified of [[npcs:mother-ilsabeth]]
- Keeps a second set of books beneath the floor

> "Every name in this book is a rope. Some of them are nooses."

## Leverage

He wants the ledger's third volume back before the Ashen choir finds it. The party is the only crew he trusts to be too stubborn to sell it on.

:::dm
Vaelith already sold the party's names to [[organizations:ashen-choir]] in session 11. He regrets it. If pressed with the vault ledger he folds immediately and offers the safehouse on Emberfall road.
:::`
    },
    {
        id: 'npcs:mother-ilsabeth',
        section: CodexSection.Npcs,
        slug: 'mother-ilsabeth',
        path: 'assets/codex/npcs/mother-ilsabeth.md',
        title: 'Mother Ilsabeth',
        status: 'Alive',
        tags: ['Human', 'Ashen choir', 'Antagonist'],
        favourite: false,
        visibility: EntryVisibility.Revealed,
        author: 'DM',
        updatedAt: '2026-08-21T20:40:00.000Z',
        fields: {
            race: 'Human',
            role: 'Voice of the Ashen choir',
            affiliation: 'organizations:ashen-choir',
            location: 'places:ashfall-city',
            disposition: 'Hostile',
            firstAppearance: 'story:session-13'
        },
        excerpt: 'She does not raise her voice. She has never needed to.',
        body: `# Who she is

She does not raise her voice. She has never needed to. The choir sings and the city listens, and somewhere under the singing a name is being erased.

- Collects debts in memory rather than coin
- Believes Ashfall must burn once more to be clean
- Wears no insignia; the ash on her hands is the insignia

> "You will not remember refusing me. That is the mercy in it."`
    },
    {
        id: 'npcs:grum-the-broker',
        section: CodexSection.Npcs,
        slug: 'grum-the-broker',
        path: 'assets/codex/npcs/grum-the-broker.md',
        title: 'Grum the Broker',
        status: 'Missing',
        tags: ['Half-orc', 'Silver ledger'],
        favourite: false,
        visibility: EntryVisibility.Revealed,
        author: 'DM',
        updatedAt: '2026-08-18T11:05:00.000Z',
        fields: {
            race: 'Half-orc',
            role: 'Fence and fixer',
            affiliation: 'organizations:silver-ledger',
            location: 'places:emberfall-road',
            disposition: 'Transactional',
            firstAppearance: 'story:session-04'
        },
        excerpt: 'Ran the pawn stall at the low end of Emberfall road until session 13.',
        body: `# Who he is

Ran the pawn stall at the low end of Emberfall road until session 13. Has not been seen since the fire.

- Last known contact: sold the party a forged writ of passage
- His stall was found untouched, coin box full`
    },
    {
        id: 'players:tessaly-oakhand',
        section: CodexSection.Players,
        slug: 'tessaly-oakhand',
        path: 'assets/codex/players/tessaly-oakhand.md',
        title: 'Tessaly Oakhand',
        status: 'Active',
        tags: ['Cleric', 'Party'],
        favourite: false,
        visibility: EntryVisibility.Revealed,
        author: 'Ben',
        updatedAt: '2026-08-24T19:44:00.000Z',
        fields: {
            player: 'Ben',
            character: 'Tessaly Oakhand',
            class: 'Cleric (light) 6',
            race: 'Half-elf',
            gender: 'Female',
            background: 'Acolyte',
            ties: 'organizations:ashen-choir'
        },
        excerpt:
            'Trained by the choir before it turned. She still sings their hymns when she thinks nobody is listening.',
        body: `# Tessaly Oakhand

Trained by the choir before it turned. She still sings their hymns when she thinks nobody is listening.

- Goal: prove the choir can be reformed rather than broken
- Bond: the last honest priest in Ashfall
- Flaw: gives second chances she cannot afford`
    },
    {
        id: 'players:serrik-vane',
        section: CodexSection.Players,
        slug: 'serrik-vane',
        path: 'assets/codex/players/serrik-vane.md',
        title: 'Serrik Vane',
        status: 'Active',
        tags: ['Rogue', 'Party'],
        favourite: false,
        visibility: EntryVisibility.Revealed,
        author: 'Marta',
        updatedAt: '2026-08-25T08:02:00.000Z',
        fields: {
            player: 'Marta',
            character: 'Serrik Vane',
            class: 'Rogue (soulknife) 6',
            race: 'Human',
            gender: 'Male',
            background: 'Criminal',
            ties: 'npcs:vaelith-corrun'
        },
        excerpt: 'Grew up running writs for the ledger. Left owing more than money.',
        body: `# Serrik Vane

Grew up running writs for the ledger. Left owing more than money.

- Goal: find out who signed his mother's name into the third volume
- Bond: [[npcs:vaelith-corrun]], who taught him to read a ledger
- Flaw: cannot walk past an unlocked door`
    },
    {
        id: 'places:ashfall-city',
        section: CodexSection.Places,
        slug: 'ashfall-city',
        path: 'assets/codex/places/ashfall-city.md',
        title: 'Ashfall city',
        status: 'Visited',
        tags: ['Settlement', 'Capital'],
        favourite: true,
        visibility: EntryVisibility.Revealed,
        author: 'DM',
        updatedAt: '2026-08-22T15:30:00.000Z',
        fields: {
            type: 'Settlement',
            parent: 'places:emberfall-road',
            ruledBy: 'organizations:silver-ledger',
            notableNpcs: 'npcs:vaelith-corrun'
        },
        excerpt: 'Built on the cooled crust of the first burning. Nine districts, one debt.',
        body: `# Ashfall city

Built on the cooled crust of the first burning. Nine districts, one debt, and a curfew nobody enforces because nobody needs to.

## Districts worth naming

| District | Known for | Party standing |
| --- | --- | --- |
| The Weighhouse | Ledger business | Welcome |
| Cinderrow | Fences and forgery | Watched |
| The Choirstep | Ashen choir ground | Hostile |

> "Everything here is built on something that burned. Including the people."`
    },
    {
        id: 'places:emberfall-road',
        section: CodexSection.Places,
        slug: 'emberfall-road',
        path: 'assets/codex/places/emberfall-road.md',
        title: 'Emberfall road',
        status: 'Visited',
        tags: ['Region', 'Trade route'],
        favourite: false,
        visibility: EntryVisibility.Revealed,
        author: 'DM',
        updatedAt: '2026-08-17T13:10:00.000Z',
        fields: {
            type: 'Region',
            parent: '',
            ruledBy: '',
            notableNpcs: 'npcs:grum-the-broker'
        },
        excerpt: 'The only paved approach to Ashfall, with a toll post every nine miles.',
        body: `# Emberfall road

The only paved approach to Ashfall. Toll posts every nine miles, each one owned by somebody who insists they are not owned by the ledger.`
    },
    {
        id: 'organizations:silver-ledger',
        section: CodexSection.Organizations,
        slug: 'silver-ledger',
        path: 'assets/codex/organizations/silver-ledger.md',
        title: 'Silver ledger',
        status: 'Active',
        tags: ['Faction', 'Finance'],
        favourite: false,
        visibility: EntryVisibility.Revealed,
        author: 'DM',
        updatedAt: '2026-08-23T10:55:00.000Z',
        fields: {
            type: 'Merchant house',
            headquarters: 'places:ashfall-city',
            leader: 'npcs:vaelith-corrun',
            members: 'About 200 sworn, several thousand indebted',
            standing: 'Allied'
        },
        excerpt: 'Lends against property, reputation, and - in three recorded cases - memory.',
        body: `# Silver ledger

Lends against property, reputation, and - in three recorded cases - memory. Holds more of Ashfall than the council does, and says so only in writing.

- Three volumes of the ledger exist; the third is missing
- Repayment is never demanded in coin if it can be demanded in favours`
    },
    {
        id: 'organizations:ashen-choir',
        section: CodexSection.Organizations,
        slug: 'ashen-choir',
        path: 'assets/codex/organizations/ashen-choir.md',
        title: 'Ashen choir',
        status: 'Hostile',
        tags: ['Faction', 'Cult'],
        favourite: false,
        visibility: EntryVisibility.Revealed,
        author: 'DM',
        updatedAt: '2026-08-24T21:15:00.000Z',
        fields: {
            type: 'Cult',
            headquarters: 'places:ashfall-city',
            leader: 'npcs:mother-ilsabeth',
            members: 'Unknown, at least forty voices',
            standing: 'Hostile'
        },
        excerpt: "They sing the city's debts into forgetting.",
        body: `# Ashen choir

They sing the city's debts into forgetting. What they take is not paid back and not remembered as owed.

- Recruits from the indebted, never from the wealthy
- Holds the Choirstep and, quietly, two of the nine district watches`
    },
    {
        id: 'story:session-13',
        section: CodexSection.Story,
        slug: 'session-13',
        path: 'assets/codex/story/session-13.md',
        title: 'Session 13 - The fire on Emberfall',
        status: 'Published',
        tags: ['Session'],
        favourite: false,
        visibility: EntryVisibility.Revealed,
        author: 'DM',
        updatedAt: '2026-08-18T22:30:00.000Z',
        fields: {
            session: '13',
            inWorldDate: '14th of Cinderfall',
            realDate: '2026-08-18',
            attending: 'Marta, Ben, Ola, Piotr'
        },
        excerpt: 'The pawn stall burned at second bell. Grum did not come out, and the coin box did not go in.',
        body: `# Session 13 - The fire on Emberfall

The pawn stall burned at second bell. [[npcs:grum-the-broker]] did not come out, and the coin box did not go in.

- The party pulled a scorched page of the third volume from the ash
- [[npcs:mother-ilsabeth]] was seen at the Choirstep an hour later, unhurried
- Ended on: the page names Serrik's mother`
    },
    {
        id: 'story:session-14',
        section: CodexSection.Story,
        slug: 'session-14',
        path: 'assets/codex/story/session-14.md',
        title: 'Session 14 - What the ledger owes',
        status: 'Draft',
        tags: ['Session'],
        favourite: false,
        visibility: EntryVisibility.Dm,
        author: 'DM',
        updatedAt: '2026-08-25T09:40:00.000Z',
        fields: {
            session: '14',
            inWorldDate: '15th of Cinderfall',
            realDate: '2026-08-25',
            attending: 'Marta, Ben, Ola, Piotr'
        },
        excerpt: 'Planned beats. Nothing here is fixed if the party goes sideways.',
        body: `# Session 14 - What the ledger owes

Planned beats. Nothing here is fixed if the party goes sideways.

1. [[npcs:vaelith-corrun]] calls in the favour: retrieve the third volume before the choir sings it
2. The Weighhouse break-in - three ways in, all of them observed
3. Confrontation at the Choirstep if the party moves fast, or a forced bargain if they do not

:::dm
If they hand the volume to Vaelith he burns his own name out of it first. That is the reveal for session 15.
:::`
    },
    {
        id: 'rules:short-rests-take-one-hour',
        section: CodexSection.HouseRules,
        slug: 'short-rests-take-one-hour',
        path: 'assets/codex/rules/short-rests-take-one-hour.md',
        title: 'Short rests take one hour',
        status: 'In force',
        tags: ['Rest'],
        favourite: false,
        visibility: EntryVisibility.Revealed,
        author: 'DM',
        updatedAt: '2026-10-19T00:00:00.000Z',
        fields: {},
        excerpt: 'A short rest lasts one hour.',
        body: `# Short rests take one hour

A short rest lasts one hour. The party can spend hit dice, but the world keeps moving while they do.`
    }
];

const toSummary = (entry: ICodexEntry): ICodexEntrySummary => ({
    id: entry.id,
    section: entry.section,
    slug: entry.slug,
    path: entry.path,
    title: entry.title,
    status: entry.status,
    tags: entry.tags,
    favourite: entry.favourite,
    visibility: entry.visibility,
    author: entry.author,
    updatedAt: entry.updatedAt,
    fields: entry.fields,
    excerpt: entry.excerpt
});

// Guests are players, so DM-only entries never leave the mocked API.
export const guestEntrySummaries = (params: URLSearchParams): ICodexEntrySummary[] => {
    const section = params.get('section');
    const status = params.get('status');
    const visibility = params.get('visibility');
    const tags = (params.get('tags') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag !== '');
    const query = (params.get('query') ?? '').trim().toLowerCase();

    if (visibility !== null && visibility !== EntryVisibility.Revealed) {
        return [];
    }

    return GUEST_ENTRIES.filter((entry) => entry.visibility === EntryVisibility.Revealed)
        .filter((entry) => section === null || entry.section === section)
        .filter((entry) => status === null || entry.status === status)
        .filter((entry) => tags.every((tag) => entry.tags.includes(tag)))
        .filter(
            (entry) =>
                query === '' || entry.title.toLowerCase().includes(query) || entry.excerpt.toLowerCase().includes(query)
        )
        .map(toSummary)
        .toSorted((left, right) => left.title.localeCompare(right.title));
};

export const stripGuestDmBlocks = (body: string): string => {
    const output: string[] = [];
    let insideDmBlock = false;

    for (const line of body.split('\n')) {
        const trimmed = line.trim();
        if (!insideDmBlock && /^:::dm\b/i.test(trimmed)) {
            insideDmBlock = true;
            continue;
        }
        if (insideDmBlock) {
            if (/^:::\s*$/.test(trimmed)) {
                insideDmBlock = false;
            }
            continue;
        }

        output.push(line);
    }

    return output.join('\n');
};

export const findGuestEntry = (section: string, slug: string): ICodexEntry | null => {
    const entry = GUEST_ENTRIES.find((candidate) => candidate.section === section && candidate.slug === slug);
    if (entry === undefined || entry.visibility !== EntryVisibility.Revealed) {
        return null;
    }

    return { ...entry, body: stripGuestDmBlocks(entry.body) };
};
