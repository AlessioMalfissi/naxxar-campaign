const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const buildEntryQuery = ({ section, status, visibility, tags = [], query } = {}) => {
    const filter = {};

    if (section) {
        filter.section = section;
    }
    if (status) {
        filter.status = status;
    }
    if (visibility) {
        filter.visibility = visibility;
    }
    if (tags.length > 0) {
        filter.tags = { $all: tags };
    }
    if (query && query.trim() !== '') {
        const pattern = new RegExp(escapeRegExp(query.trim()), 'i');
        filter.$or = [{ title: pattern }, { excerpt: pattern }];
    }

    return filter;
};
