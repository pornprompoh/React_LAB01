const {
  readcfg,
  createPassword,
} = require('./common')
const cfg = readcfg();

const mongoose = require('mongoose'); 
const os = require('os');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const packageDefinition = protoLoader.loadSync(
  "proto/db.proto",
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  }
);
const dbaseproject = grpc.loadPackageDefinition(packageDefinition).dbaseproject;

// --- [1. แก้ไขการ Import เพิ่ม historySchema ตรงนี้] ---
const {
  userSchema,
  deviceSchema, 
  historySchema // <-- เพิ่มตัวนี้
} = require('./libs/schema');
// -------------------------------

const db = {
  MainBase: null,
}

/* Connection setup function */
function baseConnect (name,) {
  return new Promise(resolve => {

    let dbaseURL = 'mongodb://127.0.0.1:27017/'
    if (cfg.dbaseURL) dbaseURL = cfg.dbaseURL

    const conn = mongoose.createConnection(dbaseURL+name, );

    conn.on('connected', () => {
        console.log('\x1b[33m%s\x1b[0m', 'Connect to ->', dbaseURL+name);
        db.MainBase = conn
        resolve(conn);
    });

    conn.on('disconnected', function() {
      console.log('\x1b[31m%s\x1b[0m', 'Disconnect from ->', dbaseURL+name);
      db.MainBase = null
      resolve(null)
    });

    conn.on('error', (err) => {
      console.log('- Mongodb error -', );
      db.MainBase = null
    });

  });  
}

async function createDocument (call, cb) {
  // console.log('createDocument ->', call.request.collection, );
  const obj = {
    collection: call.request.collection,
    query: call.request.query,
    data: JSON.stringify({})
  }

  const base = db.MainBase
  if (base)  {    
    const Model = base.models[call.request.collection]
    
    // --- [เพิ่มระบบป้องกัน (Safeguard) ป้องกันระบบเด้งหลุด] ---
    if (!Model) {
      console.error(`Create Error: Model '${call.request.collection}' not found. Please register it.`);
      return cb(null, obj);
    }

    const data = JSON.parse(call.request.data)
    
    if (!data._id)   data._id = new mongoose.Types.ObjectId()+''
    
    // --- [แก้ไขจาก insertOne เป็น create ซึ่งเป็นมาตรฐานของ Mongoose] ---
    Model.create(data).then(function (resp) { 
      if (resp)  obj.data = JSON.stringify([resp])
      cb(null, obj)
    }).catch(err => {
      console.error('Create Error:', err.message);
      cb(null, obj);
    });
  }
  else  {
    cb(null, obj);
  }
}

async function readDocument (call, cb) {
  // console.log('readDocument ->', call.request.collection);
  const obj = {
    collection: call.request.collection,
    query: call.request.query,
    data: JSON.stringify([])
  }
 
  const base = db.MainBase
  if (base)  {    
    const Model = base.models[call.request.collection]
    
    if (!Model) {
      console.error(`Read Error: Model '${call.request.collection}' not found.`);
      return cb(null, obj);
    }

    const query = JSON.parse(call.request.query)

    let populate = null
    if (call.request.populate && call.request.populate != '')  {
      populate = JSON.parse(call.request.populate)
      populate.model = base.models.Model
    }

    let select = null
    if (call.request.select && call.request.select != '')  select = JSON.parse(call.request.select)

    if (Object.keys(query).length)  {      
      Model.findOne(query).populate(populate).select(select).then(function (resp) { 
        if (resp)  obj.data = JSON.stringify([resp])
        cb(null, obj)
      }).catch(err => cb(null, obj));  
    }
    else  {
      Model.find(query).populate(populate).select(select).then(function (resp) { 
        if (resp)  obj.data = JSON.stringify(resp)
        cb(null, obj)
      }).catch(err => cb(null, obj));  
    }

  }
  else  {
    cb(null, obj)  
  }
}

async function updateDocument (call, cb) {
  console.log('updateDocument ->', call.request.collection);
  const obj = {
    collection: call.request.collection,
    query: call.request.query,
    data: JSON.stringify({})
  }

  const base = db.MainBase
  if (base)  {    
    const Model = base.models[call.request.collection]

    if (!Model) {
      console.error(`Update Error: Model '${call.request.collection}' not found.`);
      return cb(null, obj);
    }

    const query = JSON.parse(call.request.query)
    let data = JSON.parse(call.request.data)

    delete data._id; // ป้องกัน Error แก้ไข _id

    Model.updateOne(query, { $set: data } ).then(function (resp) { 
      if (resp)  {
        obj.data = JSON.stringify(resp)
        cb(null, obj)
      }
      else  {
        cb(null, obj);
      }
    }).catch(function(err) {
       console.error('Update Error:', err.message);
       cb(null, obj);
    });

  }
  else  {
    cb(null, obj);
  }
}

async function deleteDocument (call, cb) {
  // console.log('deleteDocument ->', call.request.collection);
  const obj = {
    collection: call.request.collection,
    query: call.request.query,
    data: JSON.stringify({})
  }

  const base = db.MainBase
  if (base)  {    
    const Model = base.models[call.request.collection]

    if (!Model) {
      console.error(`Delete Error: Model '${call.request.collection}' not found.`);
      return cb(null, obj);
    }

    const query = JSON.parse(call.request.query)

    Model.deleteOne(query).then(function (resp) { 
      if (resp)  {
        obj.data = JSON.stringify(resp)
      }
      cb(null, obj)
    }).catch(err => cb(null, obj));  
  }
  else  {
    cb(null, obj);
  }
}

async function dropDatabase (call, cb) {
  if (db.MainBase)  {
    db.MainBase.dropDatabase(() => {
      db.MainBase.close(() => {
        cb(null, { status: true })
      });
    })
  } else { cb(null, { status: false }) }
}

async function dropCollection (call, cb) {
  if (db.MainBase)  {
    db.MainBase.dropCollection(call.request.collection, (err, result) => {
      cb(null, { status: true });
    });
  } else { cb(null, { status: false }); }
}

async function dbIsReady(call, cb) {
  let state = false
  if (db.MainBase)  state = true
  console.log('dbIsReady ->', state);
  cb (null, { status: state })
}

function getServer() {
  var server = new grpc.Server({'grpc.max_send_message_length': 50*1024*1024, 'grpc.max_receive_message_length': 50*1024*1024});
  server.addService(dbaseproject.DbaseProject.service, {
    createDocument: createDocument,
    readDocument: readDocument,
    updateDocument: updateDocument,
    deleteDocument: deleteDocument,
    dropDatabase: dropDatabase,
    dropCollection: dropCollection,
    dbIsReady: dbIsReady,
  });
  return server;
}

async function main ()  {

  if (!db.MainBase)  {
    await baseConnect(cfg.baseName, );
  }
  
  if (db.MainBase)  {
    // --- [2. ลงทะเบียน Model ให้ครบตรงนี้ครับ] ---
    db.MainBase.model('User', userSchema);
    db.MainBase.model('Device', deviceSchema); 
    db.MainBase.model('HistoryData', historySchema); // <-- เพิ่มบรรทัดนี้แล้ว!
    // ------------------------------------
  }
  else  {
    main()
    return
  }

  const routeServer = getServer();  
  routeServer.bindAsync('0.0.0.0:'+cfg.dbasePort, grpc.ServerCredentials.createInsecure(), () => {
    routeServer.start();
  });

  let dateTime = new Date();
  console.log("Dbase Server port ("+cfg.dbasePort+") start ->", dateTime.getDate()+'/'+(dateTime.getMonth()+1)+'/'+dateTime.getFullYear(), 
  dateTime.getHours()+':'+dateTime.getMinutes()+':'+dateTime.getSeconds());  

  // --- ส่วนสร้าง Admin เริ่มต้น (เหมือนเดิม) ---
  let pwd = await createPassword('Default@1234');
  let user = null

  readDocument({ request:{
    collection: 'User',
    query: JSON.stringify({}),
  }}, (err, resp) => {
    if (resp)  {
      let temp = JSON.parse(resp.data)
      if (temp.length)  user = temp[0]
    }

    if (!user)  {
      user = {
        _id: 'admin',
        userName: 'admin',
        fullName: 'admin',
        userLevel: 'admin',
        userState: 'enable',
        email: 'admin@gmail.com',
        password: pwd,
        dateCreate: new Date()+'',
        dateExpire: '',
      }
      createDocument({ request: {
        collection: 'User',
        data: JSON.stringify(user),
      }}, (err, resp) => {
        if (resp)  {
          const status = JSON.parse(resp.data)
          console.log('Create Default Admin ->', status)
        }
      })
    }
  });          
}

if (require.main === module) {
  main();
}