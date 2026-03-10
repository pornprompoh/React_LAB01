// Backfill HistoryData documents by adding `tagsData` keys taken from Device.tags labels.
// Usage: node scripts/backfill_history.js --db <dbname> --device <deviceId> [--date YYYY-MM-DD]
// If --date is omitted, all dates for the device are processed.

const mongoose = require('mongoose');
const argv = require('minimist')(process.argv.slice(2));

const dbName = argv.db || 'learncom1';
const deviceId = argv.device;
const dateFilter = argv.date; // optional

if (!deviceId) {
  console.error('Missing --device <deviceId>');
  process.exit(1);
}

const mongoUrl = process.env.MONGO_URL || `mongodb://127.0.0.1:27017/${dbName}`;

async function main() {
  try {
    await mongoose.connect(mongoUrl);
    console.log('Connected to', mongoUrl);
  } catch (err) {
    console.error('Mongo connect error:', err && err.message ? err.message : err);
    process.exit(1);
  }

  const Schema = mongoose.Schema;
  const tagSchema = new Schema({ label: String });
  const deviceSchema = new Schema({ _id: String, tags: [tagSchema] });
  const historySchema = new Schema({ deviceId: String, date: String, time: String, tagsData: Object });

  const Device = mongoose.model('Device', deviceSchema, 'Device');
  const History = mongoose.model('HistoryData', historySchema, 'HistoryData');

  const device = await Device.findOne({ _id: deviceId }).lean();
  if (!device) {
    console.error('Device not found:', deviceId);
    process.exit(1);
  }

  const labels = (device.tags || []).map((t, i) => t.label || `Tag ${i+1}`);
  if (labels.length === 0) {
    console.warn('Device has no tags; nothing to add.');
    process.exit(0);
  }

  const query = { deviceId };
  if (dateFilter) query.date = dateFilter;

  const cursor = History.find(query).cursor();
  let updated = 0, total = 0;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    total++;
    if (!doc.tagsData || Object.keys(doc.tagsData || {}).length === 0) {
      const tagsData = {};
      labels.forEach(k => { tagsData[k] = null; });
      await History.updateOne({ _id: doc._id }, { $set: { tagsData } });
      updated++;
    }
  }

  console.log(`Processed ${total} docs; updated ${updated} documents.`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
