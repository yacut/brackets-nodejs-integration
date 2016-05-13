'use strict';

var http = require('http');

console.log('Start http server...');
http.createServer(function (req, res) {
    res.end('Hello world');
}).listen(7070);
