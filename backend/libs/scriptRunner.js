// ========================================
// Script Runner (Backend Task)
// ทำหน้าที่รัน Script ผ่าน gRPC JsExe Service
// ========================================

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

// Load Proto Definition
const packageDefinition = protoLoader.loadSync(
  './proto/jsexe.proto',
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
  }
);

const jsexeProject = grpc.loadPackageDefinition(packageDefinition).jsexe;

// Create gRPC Client
const jsexeClient = new jsexeProject.JsexeService(
  'localhost:3302',
  grpc.credentials.createInsecure()
);

/**
 * Execute script via gRPC JsExe Service
 * @param {string} code - JavaScript code to execute
 * @returns {Promise<{success: boolean, result?: any, error?: string}>}
 */
async function executeScript(code) {
  return new Promise((resolve, reject) => {
    if (!code || typeof code !== 'string') {
      reject(new Error('Code must be a non-empty string'));
      return;
    }

    jsexeClient.Execute({ code }, (err, response) => {
      if (err) {
        reject(new Error(`gRPC Error: ${err.message}`));
      } else {
        resolve({
          success: response.success,
          result: response.success ? response.result : null,
          error: response.error || null
        });
      }
    });
  });
}

module.exports = {
  executeScript
};
