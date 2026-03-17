// ========================================
// Layer 3: Database Service (gRPC Server)
// Port: 3301
// ========================================

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const mongoose = require('mongoose');
const { readcfg } = require('./common');

const cfg = readcfg();

// Load Proto Definition
const packageDefinition = protoLoader.loadSync(
  './proto/db.proto',
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  }
);

const dbaseproject = grpc.loadPackageDefinition(packageDefinition).dbaseproject;

// Load Schemas
const { userSchema, deviceSchema, historySchema } = require('./libs/schema');

// ==================== DATABASE CONNECTION ====================
let MainBase = null;

async function baseConnect(name) {
  return new Promise((resolve, reject) => {
    let dbaseURL = 'mongodb://127.0.0.1:27017/';
    if (cfg.dbaseURL) dbaseURL = cfg.dbaseURL;

    const conn = mongoose.createConnection(dbaseURL + name);

    conn.on('connected', () => {
      console.log('\x1b[33m%s\x1b[0m', 'Connect to ->', dbaseURL + name);
      MainBase = conn;

      // Register Schemas
      MainBase.model('User', userSchema);
      MainBase.model('Device', deviceSchema);
      MainBase.model('HistoryData', historySchema);

      resolve(conn);
    });

    conn.on('error', (err) => {
      console.log('\x1b[31m%s\x1b[0m', 'MongoDB Error ->', err.message);
      reject(err);
    });

    conn.on('disconnected', () => {
      console.log('\x1b[31m%s\x1b[0m', 'Disconnect from MongoDB');
      MainBase = null;
      reject(new Error('MongoDB Disconnected'));
    });
  });
}

// ==================== gRPC SERVICE IMPLEMENTATION ====================

async function createDocument(call, callback) {
  try {
    if (!MainBase) {
      throw new Error('Database not connected');
    }

    const { collection, data } = call.request;
    const Model = MainBase.model(collection);

    const parsedData = JSON.parse(data);
    if (!parsedData._id) {
      parsedData._id = new mongoose.Types.ObjectId() + '';
    }

    const doc = await Model.create(parsedData);

    callback(null, {
      collection: collection,
      data: JSON.stringify([doc])
    });
  } catch (error) {
    console.error('❌ Create Error:', error.message);
    callback(null, {
      collection: call.request.collection,
      data: JSON.stringify([])
    });
  }
}

async function readDocument(call, callback) {
  try {
    if (!MainBase) {
      throw new Error('Database not connected');
    }

    const { collection, query } = call.request;
    const Model = MainBase.model(collection);

    const parsedQuery = JSON.parse(query);
    let result;

    if (Object.keys(parsedQuery).length) {
      result = await Model.findOne(parsedQuery);
      result = result ? [result] : [];
    } else {
      result = await Model.find(parsedQuery);
    }

    callback(null, {
      collection: collection,
      data: JSON.stringify(result)
    });
  } catch (error) {
    console.error('❌ Read Error:', error.message);
    callback(null, {
      collection: call.request.collection,
      data: JSON.stringify([])
    });
  }
}

async function updateDocument(call, callback) {
  try {
    if (!MainBase) {
      throw new Error('Database not connected');
    }

    const { collection, query, data } = call.request;
    const Model = MainBase.model(collection);

    const parsedQuery = JSON.parse(query);
    const parsedData = JSON.parse(data);

    delete parsedData._id;

    await Model.updateOne(parsedQuery, { $set: parsedData });

    callback(null, {
      collection: collection,
      data: JSON.stringify({ success: true })
    });
  } catch (error) {
    console.error('❌ Update Error:', error.message);
    callback(null, {
      collection: call.request.collection,
      data: JSON.stringify([])
    });
  }
}

async function deleteDocument(call, callback) {
  try {
    if (!MainBase) {
      throw new Error('Database not connected');
    }

    const { collection, query } = call.request;
    const Model = MainBase.model(collection);

    const parsedQuery = JSON.parse(query);
    await Model.deleteOne(parsedQuery);

    callback(null, {
      collection: collection,
      data: JSON.stringify({ success: true })
    });
  } catch (error) {
    console.error('❌ Delete Error:', error.message);
    callback(null, {
      collection: call.request.collection,
      data: JSON.stringify([])
    });
  }
}

async function dropDatabase(call, callback) {
  try {
    if (!MainBase) {
      throw new Error('Database not connected');
    }

    await MainBase.dropDatabase();
    await MainBase.close();

    callback(null, { status: true });
  } catch (error) {
    console.error('❌ Drop DB Error:', error.message);
    callback(null, { status: false });
  }
}

async function dropCollection(call, callback) {
  try {
    if (!MainBase) {
      throw new Error('Database not connected');
    }

    await MainBase.dropCollection(call.request.collection);
    callback(null, { status: true });
  } catch (error) {
    console.error('❌ Drop Collection Error:', error.message);
    callback(null, { status: false });
  }
}

async function dbIsReady(call, callback) {
  const state = MainBase ? true : false;
  callback(null, { status: state });
}

// ==================== START gRPC SERVER ====================
async function startServer() {
  try {
    // Connect to MongoDB first
    await baseConnect(cfg.baseName);
    console.log('✅ Connected to MongoDB');

    // Create gRPC Server
    const server = new grpc.Server({
      'grpc.max_send_message_length': 50 * 1024 * 1024,
      'grpc.max_receive_message_length': 50 * 1024 * 1024
    });

    // Add Service
    server.addService(dbaseproject.DbaseProject.service, {
      createDocument: createDocument,
      readDocument: readDocument,
      updateDocument: updateDocument,
      deleteDocument: deleteDocument,
      dropDatabase: dropDatabase,
      dropCollection: dropCollection,
      dbIsReady: dbIsReady
    });

    // Bind and Start
    server.bindAsync('0.0.0.0:' + cfg.dbasePort, grpc.credentials.createInsecure(), (err) => {
      if (err) {
        console.error('❌ Bind Error:', err);
        process.exit(1);
      }

      server.start();
      const dateTime = new Date();
      console.log('✅ Database Service (gRPC Server) listening on port', cfg.dbasePort);
      console.log('   Started at:', dateTime.toLocaleString());
    });

  } catch (error) {
    console.error('❌ Server Error:', error.message);
    process.exit(1);
  }
}

// Start
if (require.main === module) {
  startServer();
}

module.exports = { startServer };
