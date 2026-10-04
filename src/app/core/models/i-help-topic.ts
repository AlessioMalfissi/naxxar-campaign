import { HelpCategory } from './help-category.enum';

export interface IHelpTopic {
    // Matches the `data-help` attribute of the element the topic points at.
    id: string;
    category: HelpCategory;
    title: string;
    body: string;
}

export interface IHelpCategoryDefinition {
    category: HelpCategory;
    label: string;
    color: string;
}

export const HELP_CATEGORY_DEFINITIONS: readonly IHelpCategoryDefinition[] = [
    { category: HelpCategory.Navigation, label: 'Navigation', color: 'var(--cdx-info)' },
    { category: HelpCategory.Editing, label: 'Editing', color: 'var(--cdx-primary)' },
    { category: HelpCategory.Filtering, label: 'Filtering', color: 'var(--cdx-warning)' },
    { category: HelpCategory.Actions, label: 'Actions', color: 'var(--cdx-accent)' }
];

export const findHelpCategoryDefinition = (category: HelpCategory): IHelpCategoryDefinition => {
    const definition = HELP_CATEGORY_DEFINITIONS.find((item) => item.category === category);
    if (definition === undefined) {
        throw new Error(`Unknown help category: ${category}`);
    }
    return definition;
};
