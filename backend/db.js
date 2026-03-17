// ========================================
// Layer 2: Backend Database Client
// เชื่อมต่อไปยัง Database Service (port 3301)
// ========================================

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

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

// Create gRPC Client (connects to server-db.js on port 3301)
const dbClient = new dbaseproject.DbaseProject(
  'localhost:3301',
  grpc.credentials.createInsecure()
);

/**
 * Initialize gRPC Client connection
 * This is called from app.js during server startup
 */
async function grpcInit() {
  return new Promise((resolve, reject) => {
    // Test connection by calling dbIsReady
    dbClient.dbIsReady({}, (err, response) => {
      if (err) {
        console.error('❌ Database Service connection failed:', err.message);
        reject(err);
      } else if (response && response.status) {
        console.log('✅ Database Service connected on port 3301');
        resolve(true);
      } else {
        console.error('❌ Database Service not ready');
        reject(new Error('Database Service not ready'));
      }
    });
  });
}

/**
 * Call Database Service to Create Document
 */
async function createDocument(request) {
  return new Promise((resolve, reject) => {
    dbClient.createDocument(request, (err, response) => {
      if (err) {
        reject(new Error(`Create Error: ${err.message}`));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Call Database Service to Read Document
 */
async function readDocument(request) {
  return new Promise((resolve, reject) => {
    dbClient.readDocument(request, (err, response) => {
      if (err) {
        reject(new Error(`Read Error: ${err.message}`));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Call Database Service to Update Document
 */
async function updateDocument(request) {
  return new Promise((resolve, reject) => {
    dbClient.updateDocument(request, (err, response) => {
      if (err) {
        reject(new Error(`Update Error: ${err.message}`));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Call Database Service to Delete Document
 */
async function deleteDocument(request) {
  return new Promise((resolve, reject) => {
    dbClient.deleteDocument(request, (err, response) => {
      if (err) {
        reject(new Error(`Delete Error: ${err.message}`));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Call Database Service to Drop Database
 */
async function dropDatabase(request) {
  return new Promise((resolve, reject) => {
    dbClient.dropDatabase(request, (err, response) => {
      if (err) {
        reject(new Error(`Drop DB Error: ${err.message}`));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Call Database Service to Drop Collection
 */
async function dropCollection(request) {
  return new Promise((resolve, reject) => {
    dbClient.dropCollection(request, (err, response) => {
      if (err) {
        reject(new Error(`Drop Collection Error: ${err.message}`));
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Check if Database Service is ready
 */
async function isDbReady() {
  return new Promise((resolve) => {
    dbClient.dbIsReady({}, (err, response) => {
      if (err) {
        console.error('DB Ready Check Error:', err.message);
        resolve(false);
      } else {
        resolve(response && response.status ? true : false);
      }
    });
  });
}

/**
 * Export all client functions
 */
module.exports = {
  grpcInit,
  createDocument,
  readDocument,
  updateDocument,
  deleteDocument,
  dropDatabase,
  dropCollection,
  isDbReady
};
