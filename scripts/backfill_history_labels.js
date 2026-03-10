// Backfill HistoryData documents by adding `tagsData` keys using provided labels.
// Usage: node scripts/backfill_history_labels.js --db <dbname> --device <deviceId> --date <YYYY-MM-DD> --labels tag1,tag2,tag3

const mongoose = require('mongoose');
const argv = require('minimist')(process.argv.slice(2));

const dbName = argv.db || process.env.DB || 'learncom1';
const deviceId = argv.device;
const dateFilter = argv.date; // required
const labelsArg = argv.labels || argv.l;

if (!deviceId || !dateFilter || !labelsArg) {
  console.error('Usage: node scripts/backfill_history_labels.js --db <dbname> --device <deviceId> --date <YYYY-MM-DD> --labels tag1,tag2');
  process.exit(1);
}

const labels = labelsArg.split(',').map(s => s.trim()).filter(Boolean);
if (labels.length === 0) {
  console.error('No labels provided');
  process.exit(1);
}

const mongoUrl = process.env.MONGO_URL || `mongodb://127.0.0.1:27017/${dbName}`;

async function main() {
  try {
    await mongoose.connect(mongoUrl);
    console.log('Connected to', mongoUrl);

    const Schema = mongoose.Schema;
    const historySchema = new Schema({ deviceId: String, date: String, time: String, tagsData: Object });
    const History = mongoose.model('HistoryData', historySchema, 'HistoryData');

    const query = { deviceId, date: dateFilter };
    const docs = await History.find(query).lean();
    if (!docs || docs.length === 0) {
      console.log('No history documents found for', deviceId, dateFilter);
      await mongoose.disconnect();
      return;
    }

    let updated = 0;
    for (const doc of docs) {
      const tagsData = {};
      labels.forEach(k => { tagsData[k] = (doc.tagsData && doc.tagsData[k] !== undefined) ? doc.tagsData[k] : null; });
      await History.updateOne({ _id: doc._id }, { $set: { tagsData } });
      updated++;
    }

    console.log(`Processed ${docs.length} docs; updated ${updated} documents.`);
    await mongoose.disconnect();
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();
