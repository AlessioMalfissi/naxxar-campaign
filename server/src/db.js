import { MongoClient } from 'mongodb';

export const connectToMongo = async ({ uri, dbName }) => {
    const client = new MongoClient(uri);
    await client.connect();

    const db = client.db(dbName);

    const collection = db.collection('entries');
    await collection.createIndex({ section: 1, status: 1 });
    await collection.createIndex({ tags: 1 });

    const inventoryCollection = db.collection('inventory');
    await inventoryCollection.createIndex({ owner: 1 });

    return { client, collection, inventoryCollection };
};
