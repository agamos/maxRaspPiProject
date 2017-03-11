var express = require('express'),
    http = require('http'),
    url = require('url'),
    fs = require('fs'),
    path = require('path'),
    rpi433 = require('rpi-433');

var server = http.createServer(function(req,res) {
    var pathname = url.parse(req.url).pathname;
    if(pathname=='/'||pathname=='/index.html') {
      readFile(res,'index.html');
    } else {
      readFile(res, '.'+pathname);
    }
}).listen(80);

var counter = 0;

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

var io = require('socket.io').listen(server);

io.sockets.on('connection', function(socket){
   console.log('got a connection');
   var sniffer = rpi433.sniffer({
      pin: 2,
      debounceDelay: 200
    });
  sniffer.on('data', function(data) {
    console.log('got data');
    var count = Math.floor(data.code/1000);
    var value = data.code % 1000; 
    console.log(value);
    socket.emit('packet', {number: count});
    socket.broadcast.emit('packet', {number: count});
    socket.emit('value', {number: value});
    socket.broadcast.emit('value', {number: value});
  });
  var interval = setInterval(function() {
    counter++;
    socket.emit('counter', {number: counter});
    socket.broadcast.emit('counter', {number: counter});
  }, 2000); 
});

console.log('Server is running');
