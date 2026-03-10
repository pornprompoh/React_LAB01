// Scan all databases on the local MongoDB server and report databases
// that contain HistoryData documents matching device/date.
// Usage: node scripts/find_history_dbs.js --device Device01 --date 2026-02-24

const { MongoClient } = require('mongodb');
const argv = require('minimist')(process.argv.slice(2));

const mongoUrl = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const deviceId = argv.device || argv.d;
const dateFilter = argv.date || argv.date;

if (!deviceId || !dateFilter) {
  console.error('Usage: node scripts/find_history_dbs.js --device <deviceId> --date <YYYY-MM-DD>');
  process.exit(1);
}

async function main() {
  const client = new MongoClient(mongoUrl);
  try {
    await client.connect();
    console.log('Connected to', mongoUrl);

    const adminDb = client.db().admin();
    const { databases } = await adminDb.listDatabases();

    for (const dbInfo of databases) {
      const dbName = dbInfo.name;
      try {
        const db = client.db(dbName);
        const collections = await db.listCollections({ name: 'HistoryData' }).toArray();
        if (collections.length === 0) continue;

        const col = db.collection('HistoryData');
        const count = await col.countDocuments({ deviceId: deviceId, date: dateFilter });
        if (count > 0) {
          console.log(`${dbName}: ${count} matching HistoryData documents`);
        }
      } catch (e) {
        // ignore db access errors
      }
    }

    await client.close();
  } catch (err) {
    console.error('Error scanning databases:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();
