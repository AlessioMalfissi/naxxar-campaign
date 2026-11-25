// In-memory stand-in for the subset of the MongoDB collection API the routes use. It backs the
// dev server when there is no MONGODB_URI, and the route tests.
const hasField = (doc, key) => Object.prototype.hasOwnProperty.call(doc, key);

const matches = (doc, filter) =>
    Object.entries(filter).every(([key, condition]) => {
        if (key === '$or') {
            return condition.some((clause) => matches(doc, clause));
        }

        const value = doc[key];
        if (condition instanceof RegExp) {
            return condition.test(String(value ?? ''));
        }
        if (condition !== null && typeof condition === 'object') {
            if ('$all' in condition) {
                return Array.isArray(value) && condition.$all.every((item) => value.includes(item));
            }
            if ('$in' in condition) {
                return condition.$in.includes(value);
            }
            if ('$ne' in condition) {
                if (condition.$ne === null) {
                    return hasField(doc, key) && value !== null;
                }
                return value !== condition.$ne;
            }
            if ('$exists' in condition) {
                return condition.$exists ? hasField(doc, key) : !hasField(doc, key);
            }
        }

        return value === condition;
    });

export const createInMemoryCollection = (initialDocs = []) => {
    const docs = new Map(initialDocs.map((doc) => [doc._id, { ...doc }]));

    return {
        find(filter = {}) {
            let results = [...docs.values()].filter((doc) => matches(doc, filter));

            return {
                sort(spec = {}) {
                    const [key, direction] = Object.entries(spec)[0] ?? [];
                    if (key !== undefined) {
                        results = [...results].sort(
                            (a, b) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0) * (direction ?? 1)
                        );
                    }
                    return this;
                },
                toArray: async () => results.map((doc) => ({ ...doc }))
            };
        },
        findOne: async (filter) => {
            const found = [...docs.values()].find((doc) => matches(doc, filter));
            return found === undefined ? null : { ...found };
        },
        insertOne: async (doc) => {
            docs.set(doc._id, { ...doc });
            return { insertedId: doc._id };
        },
        replaceOne: async (filter, doc, options = {}) => {
            const found = [...docs.values()].find((existing) => matches(existing, filter));
            if (found !== undefined || options.upsert === true) {
                docs.set(doc._id, { ...doc });
            }
            return { matchedCount: found === undefined ? 0 : 1 };
        },
        deleteOne: async (filter) => {
            const found = [...docs.values()].find((existing) => matches(existing, filter));
            if (found !== undefined) {
                docs.delete(found._id);
            }
            return { deletedCount: found === undefined ? 0 : 1 };
        },
        deleteMany: async (filter) => {
            const found = [...docs.values()].filter((existing) => matches(existing, filter));
            for (const doc of found) {
                docs.delete(doc._id);
            }
            return { deletedCount: found.length };
        },
        dump: () => [...docs.values()]
    };
};
