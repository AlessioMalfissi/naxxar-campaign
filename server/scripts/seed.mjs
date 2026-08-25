import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import 'dotenv/config';

import { loadConfig } from '../src/config.js';
import { connectToMongo } from '../src/db.js';
import { SECTIONS } from '../src/sections.js';

const CODEX_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'seed-data', 'codex');

const parseScalar = (raw) => {
    const value = raw.trim().replace(/^["']|["']$/g, '');
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    return value;
};

const parseFrontMatter = (source) => {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
    if (match === null) {
        return { data: {}, body: source };
    }

    const data = {};
    let nested = null;

    for (const line of match[1].split(/\r?\n/)) {
        if (line.trim() === '') {
            continue;
        }

        const indented = /^\s{2,}/.test(line);
        const separator = line.indexOf(':');
        if (separator === -1) {
            continue;
        }

        const key = line.slice(0, separator).trim();
        const raw = line.slice(separator + 1).trim();

        if (indented && nested !== null) {
            data[nested][key] = String(parseScalar(raw));
            continue;
        }

        if (raw === '') {
            nested = key;
            data[key] = {};
            continue;
        }

        nested = null;
        data[key] = raw.startsWith('[')
            ? raw
                  .slice(1, -1)
                  .split(',')
                  .map((item) => String(parseScalar(item)))
                  .filter((item) => item !== '')
            : parseScalar(raw);
    }

    return { data, body: source.slice(match[0].length) };
};

const buildEntries = async () => {
    const entries = [];

    for (const section of SECTIONS) {
        const files = (await readdir(join(CODEX_ROOT, section))).filter((file) => file.endsWith('.md'));

        for (const file of files) {
            const slug = file.replace(/\.md$/, '');
            const source = await readFile(join(CODEX_ROOT, section, file), 'utf8');
            const { data, body } = parseFrontMatter(source);
            const trimmedBody = body.trim();

            entries.push({
                _id: `${section}:${slug}`,
                section,
                slug,
                path: `assets/codex/${section}/${file}`,
                title: data.title ?? slug,
                status: data.status ?? '',
                tags: Array.isArray(data.tags) ? data.tags : [],
                favourite: data.favourite === true,
                visibility: data.visibility === 'dm' ? 'dm' : 'revealed',
                author: data.author ?? 'DM',
                updatedAt: data.updatedAt ?? new Date().toISOString(),
                fields: data.fields ?? {},
                excerpt: trimmedBody
                    .replace(/^#.*$/gm, '')
                    .replace(/[*_>`[\]]/g, '')
                    .trim()
                    .slice(0, 160),
                body: trimmedBody
            });
        }
    }

    return entries;
};

const seed = async () => {
    const config = loadConfig();
    const { client, collection } = await connectToMongo({ uri: config.mongoUri, dbName: config.mongoDb });

    try {
        const entries = await buildEntries();
        for (const entry of entries) {
            await collection.replaceOne({ _id: entry._id }, entry, { upsert: true });
        }

        console.log(`Seeded ${entries.length} entries into ${config.mongoDb}.entries`);
    } finally {
        await client.close();
    }
};

await seed();
