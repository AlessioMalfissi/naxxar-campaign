import { MongoClient } from 'mongodb';

export const connectToMongo = async ({ uri, dbName }) => {
    const client = new MongoClient(uri);
    await client.connect();

    const collection = client.db(dbName).collection('entries');
    await collection.createIndex({ section: 1, status: 1 });
    await collection.createIndex({ tags: 1 });

    return { client, collection };
};
