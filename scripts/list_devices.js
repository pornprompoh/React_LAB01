const mongoose = require('mongoose');
const argv = require('minimist')(process.argv.slice(2));

const dbName = argv.db || process.env.DB || 'CRUD';
const mongoUrl = process.env.MONGO_URL || `mongodb://127.0.0.1:27017/${dbName}`;

async function main() {
  try {
    await mongoose.connect(mongoUrl);
    console.log('Connected to', mongoUrl);

    const Schema = mongoose.Schema;
    const tagSchema = new Schema({ label: String });
    const deviceSchema = new Schema({ _id: String, code: String, name: String, tags: [tagSchema] });

    const Device = mongoose.model('Device', deviceSchema, 'Device');
    const devices = await Device.find({}).lean();

    if (!devices || devices.length === 0) {
      console.log('No devices found in', dbName);
      await mongoose.disconnect();
      return;
    }

    devices.forEach(d => {
      console.log('---');
      console.log('id:', d._id);
      if (d.code) console.log('code:', d.code);
      if (d.name) console.log('name:', d.name);
      console.log('tags:', (d.tags || []).map(t => t.label || '(no label)'));
    });

    await mongoose.disconnect();
  } catch (err) {
    console.error('Error listing devices:', err && err.message ? err.message : err);
    process.exit(1);
  }
}

main();
