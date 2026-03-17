const { createRequire } = require('node:module');
require = createRequire(__filename); 

const fs = require('fs')
const https = require('https'); 
const http = require("http");  
const path = require('path');
const passport = require('passport');
const express = require('express');
const { ThrottleGroup } = require("stream-throttle");

const {
  sleep,
  readcfg,
  createPassword,
} = require('./common')

const db = require('./db')
const scriptScheduler = require('./libs/scriptScheduler')
const { startServer: startJsExeServer } = require('./server-jsexe')

let cfg = readcfg(true);

async function main () {

  // Initialize database gRPC client
  try {
    await db.grpcInit()
    console.log('✅ Database client initialized')
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message)
    await sleep(1e3*10)
    main()
    return
  }

  // Check if database is ready
  const isReady = await db.isDbReady()
  if (isReady) {
    console.log('✅ Database service is ready')
  } else {
    console.error('❌ Database service not ready')
    await sleep(1e3*10)
    main()
    return
  }

  // Initialize script scheduler
  try {
    await scriptScheduler.initialize()
    console.log('✅ Script scheduler initialized')
  } catch (error) {
    console.warn('⚠️  Script scheduler initialization error:', error.message)
    // Don't fail the whole app if scheduler fails
  }

  // Start JsExe Service (Script Execution Service)
  try {
    startJsExeServer()
    console.log('✅ JsExe Service started on port 3302')
  } catch (error) {
    console.warn('⚠️  JsExe Service error:', error.message)
    // Don't fail the whole app if JsExe Service fails
  }

  const app = express();
     
  const preferences = require('./routes/preferences').router
  require('./routes/preferences').restInit(
    readcfg, 
    createPassword,
  )

  const privateKey = 'secret'
  
  app.use(passport.initialize());
  require('./libs/passport')(passport, privateKey)

  const users = require('./routes/users').router;
  require('./routes/users').userInit(privateKey); 

  /* Since express 4.16.0, you can also do: */
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));  

  app.use('/api/preferences', preferences);
  app.use('/api/users', users);
 
  /*  */  
  const process = require('process');
  const cdir = process.cwd();
  console.log('cdir / _dir ->', cdir, __dirname)
  
  app.use(express.static(path.join(cdir, 'build')));
  // app.use(express.static(path.join(__dirname, 'build')));

  app.get('*splat', function(req, res) {  // browserroute -> '/*' for express 4 , '*splat' for express 5
    // res.sendFile(path.join(__dirname, 'build', 'index.html'));
    res.sendFile(path.join(cdir, 'build', 'index.html'));
  });  
  
  const PORT = process.env.PORT || cfg.serverPort;
  let dateTime = new Date();
  
  let options = null
  
  if (fs.existsSync('../secret/beariot.key') && fs.existsSync('../secret/beariot.crt'))  {
    console.log('cert key -> ../secret/')
    options = {
      key: fs.readFileSync('../secret/beariot.key'),
      cert: fs.readFileSync('../secret/beariot.crt'),
    }
  }
  
  // console.log('https options ->', options)
  
  if ((cfg.protocal === 'https'  || cfg.protocal === 'HTTPS') && options)  {
    
    const server = https.createServer(options, app);
    server.listen(PORT, () => {
      console.log('Program is running as HTTPS on PORT', PORT, 'Start at ->', dateTime.getDate()+'/'+(dateTime.getMonth()+1)+'/'+dateTime.getFullYear(), 
                   dateTime.getHours()+':'+dateTime.getMinutes()+':'+dateTime.getSeconds());
    });

  }
  else  {

    if (cfg.protocal === 'http'  || cfg.protocal === 'HTTP')  {

      const server = http.createServer(app);
      server.listen(PORT, () => {
        console.log('Program is running as HTTP on PORT', PORT, 'Start at ->', dateTime.getDate()+'/'+(dateTime.getMonth()+1)+'/'+dateTime.getFullYear(), 
                     dateTime.getHours()+':'+dateTime.getMinutes()+':'+dateTime.getSeconds());
      });    

    }  

  } 
    
}

if (require.main === module) {
  main()
}
