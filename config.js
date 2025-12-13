const port = 3300;
module.exports = {
    server: true,  // true or false
    protocal: 'http',  // http or https

    productName: 'BeaRiOT',
    sitePrefix: 'BR',
    groupPrefix: 'BG',
    baseName: 'bear_config',
    logName: 'bear_log',
    alarmName: 'bear_alarm',

    // productName: 'KMITL',
    // sitePrefix: 'KM',
    // groupPrefix: 'KG',
    // baseName: 'kmitl_config',
    // logName: 'kmitl_log',
    // alarmName: 'kmitl_alarm',

    updateRate: 4096,  // 1024 = 1mbits/sec
    lowStorageAlert: 51,  // %
    node: 0,
    desktop: true,

    /* Service Port */
    serverPort: port,
    gatewayPort: port+1,
    dbasePort: port+2,
    dbtsPort: port+3,
    queuePort: port+4,
    wsPort: port+5,
    redisPort: port+6,
    interfacePort: port+7,
    // gpsPort: '/dev/ttyUSB2',
    // atcmdPort: '/dev/ttyUSB2'
    
    /* Service IP */
    dbaseIP: 'localhost',
    dbtsIP: 'localhost',
    gatewayIP: 'localhost',
    queueIP: 'localhost',
    redisIP: 'localhost',
    dbaseURL: 'mongodb://127.0.0.1:27017/',    
    // dbaseURLV2: 'mongodb://172.26.15.77:27017/',  // reserve db  

    // transfer: [
    //     {
    //     sourceID: 'KMdca632bc1f42',
    //     targetID: 'KMdca632bc1f42',
    //     serverURL: 'iotdesign.kmitl.ac.th',
    //     gatewayPort: 3302,  // kmitl
    //     updateInterval: 3,
    //     },
    // ],
    
    // mqInfo: { 
    //     host: 'http://www.somha-iot.com', 
    //     username: 'fuyutech', 
    //     password: 'ajbear1969', 
    //     subscribe: 'fuyutech/bar',
    //     publish: 'fuyutech/bar',
    // }

    corsOrigin: [
        "http://localhost:3000", // dev mode
        "http://localhost:3300", // dev mode
        "http://localhost:8000", // dev mode
    ],

    serverURL: '192.168.2.56',
    
}
