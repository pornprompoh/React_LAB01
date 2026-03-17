// ========================================
// Layer 3: JsExe Service (gRPC Server)
// Port: 3302
// Isolated Script Execution Environment
// ========================================

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const vm = require('vm');

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

// ==================== gRPC SERVICE IMPLEMENTATION ====================

async function execute(call, callback) {
  try {
    const { code } = call.request;

    if (!code || typeof code !== 'string') {
      throw new Error('Code must be a non-empty string');
    }

    // Create isolated execution context
    const sandbox = {
      Math: Math,
      Date: Date,
      JSON: JSON,
      Number: Number,
      String: String,
      Array: Array,
      Object: Object,
      isNaN: isNaN,
      parseFloat: parseFloat,
      parseInt: parseInt
    };

    const context = vm.createContext(sandbox);

    // Execute code in isolated environment
    const result = vm.runInContext(`(${code})`, context, {
      timeout: 5000,
      displayErrors: true
    });

    callback(null, {
      success: true,
      result: String(result),
      error: ''
    });
  } catch (error) {
    console.warn('⚠️  Script Error:', error.message);
    callback(null, {
      success: false,
      result: '',
      error: error.message
    });
  }
}

// ==================== START gRPC SERVER ====================
function startServer() {
  const server = new grpc.Server();

  // Add Service
  server.addService(jsexeProject.JsexeService.service, {
    Execute: execute
  });

  // Bind and Start
  server.bindAsync('0.0.0.0:3302', grpc.credentials.createInsecure(), (err) => {
    if (err) {
      console.error('❌ Bind Error:', err);
      process.exit(1);
    }

    server.start();
    const dateTime = new Date();
    console.log('✅ JsExe Service (gRPC Server) listening on port 3302');
    console.log('   Started at:', dateTime.toLocaleString());
  });
}

// Start
if (require.main === module) {
  startServer();
}

module.exports = { startServer };
