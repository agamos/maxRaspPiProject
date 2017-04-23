// Load in libraries for web server

var express = require('express'),
    http = require('http'),
    url = require('url'),
    fs = require('fs'),
    path = require('path');

// IFTTT configuration

var apiKey = 'bCLzK64j0V9sF0Y4pUCfCU';
var IFTTTMaker = require('iftttmaker')(apiKey);

// Flag to stop repeated triggers being sent to IFTTT

var triggered = false;

// Create web server running on port 80

var server = http.createServer(function(req,res) {
    var pathname = url.parse(req.url).pathname;
    if(pathname=='/'||pathname=='/index.html') {
      readFile(res,'index.html');
    } else {
      readFile(res, '.'+pathname);
    }
}).listen(80);

// Configure alarm sound

var Sound = require('node-aplay');
var alarm = new Sound('img/alarm.wav');
 
// Configure XBee

var util = require('util');
var SerialPort = require('serialport');
var xbee_api = require('xbee-api');
var C = xbee_api.constants;
var xbeeAPI = new xbee_api.XBeeAPI({
    api_mode: 1
});
// Open Xbee on serial port
var serialport = new SerialPort("/dev/ttyAMA0", {
    baudrate: 9600,
    parser: xbeeAPI.rawParser()
});
// Notify to console on open
serialport.on('open', function (data) {
    console.log('Opened serial port.');
});
// Log when data received - normally unused 
serialport.on('data', function (data) {
    console.log('data received: ' + data);
});
// All frames parsed by the XBee will be emitted here
xbeeAPI.on("frame_object", function (frame) {
    console.log(">>", frame);
});

// Handle web server requests by serving up pages or data

readFile = function(res, pathname) {
     fs.readFile(pathname, function(err, data) {
       if(err) {
         console.log(err.message);
         res.writeHead(404, {'content-type': 'text/html'});
         res.write('File not found: ' + pathname);
		 res.end(data, 'utf-8');
       } else {
         var extension = path.extname(pathname);
         res.setHeader('Access-Control-Allow-Origin', "*");
         res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE ');
         res.setHeader('Access-Control-Allow-Headers',  'X-Requested-With,content-type');
         res.setHeader('Access-Control-Allow-Credentials', true);
         if (extension == '.css') {
           res.writeHead(200, {'content-type': 'text/css'});
         } else if (extension == '.png') {
           res.writeHead(200, {'content-type': 'image/png'});
         } else if (extension == '.jpg') {
           res.writeHead(200, {'content-type': 'image/jpg'});
         } else if (extension == '.js') {
           res.writeHead(200, {'content-type': 'text/javascript'});
         } else {
           res.writeHead(200, {'content-type': 'text/html'});
         }
         res.write(data);
         res.end();
       }
     });
};

// Setup web sockets for browser to server communication
var io = require('socket.io').listen(server);

// Handle socket events
io.sockets.on('connection', function(socket){
   console.log('got a connection');
  
  // Process Xbee packets
  xbeeAPI.on("frame_object", function (frame) {
   
    // Temperature sensor readings
    if(frame.data[0]==84) { // Temperature
      var temp = (frame.data[1]+(frame.data[2]/10))/10;
      socket.emit('temperature', {number: temp});
      socket.broadcast.emit('temperature', {number: temp});
    }
   
    // Accelerometer sensor readings
    if(frame.data[0]==70 && !triggered) { // Fall
      triggered=true;
      socket.emit('fall', {number: frame.data[1]});
      socket.broadcast.emit('fall', {number: frame.data[1]});

      // Play sound

      alarm.play();
      
      // Alert IFTTT

      IFTTTMaker.send('Patient_fallen').then(function () {
         console.log('Request was sent');
      }).catch(function (error) {
         console.log('The request could not be sent:', error);
      });
    }

    // Button push readings
    if(frame.data[0]==66) { // Button
      socket.emit('button', {number: frame.data[1]});
      socket.broadcast.emit('button', {number: frame.data[1]});
      triggered=false;
    }
  });
  
  //  Stop alarm and notify clients when triggered by web page

  socket.on('cancelAlarm', function(data) {
      console.log('got cancelAlarm event');
      var dummy = 0;
      triggered=false;
      socket.emit('button', {number: dummy});
      socket.broadcast.emit('button', {number: dummy});
  });

  // Test service to invoke alarm when pendant not around

  socket.on('invokeAlarm', function(data) {
      console.log('got invokeAlarm event');
      var dummy = 0;
      triggered=true;
      socket.emit('fall', {number: dummy});
      socket.broadcast.emit('fall', {number: dummy});
  });
 
});

console.log('Server is running');
