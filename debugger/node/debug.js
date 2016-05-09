var net = require('net'),
    events = require('events'),
    util = require('util');

var debugConnector = function (port, host) {
    events.EventEmitter.call(this);

    this.connected = false;
    this.port = port;
    this.host = host;
    this._seq = 0;
    this._waitingForResponse = {};
    this._body = '';
    this._header = true;
    this._contentLength = -1;
    this._ignoreNext = 0;
};

util.inherits(debugConnector, events.EventEmitter);

debugConnector.prototype.connect = function () {

    var self = this;
    this.socket = net.createConnection(self.port, self.host);

    this.socket.on('connect', function () {
        self.connected = true;
        self._body = '';
        self._ignoreNext = 0;
        self._contentLength = -1;
        self.header = true;
        self._waitingForResponse = {};
        self.emit('connect');
        console.log('[Node Debugger] Connected to V8 debugger');
    });

    this.socket.on('error', function (err) {
        self.emit('error', err);
        console.error('[Node Debugger] Error on socket: ');
        console.error(err);
    });

    this.socket.on('close', function (err) {
        self.connected = false;
        self.emit('close', err);
        self.socket.end();
    });

    this.socket.on('data', function (data) {
        var l = data.toString().split('\r\n');
        var parseHeader = function (line) {
            var h = line.split(':');
            //Check if that is really the content-length
            if (h[0] === 'Content-Length') {
                self._contentLength = parseInt(h[1], 10);
                //If there is no body we need to ignore the next empty line
                if (self._contentLength === 0) {
                    self._ignoreNext = 2;
                }
            }
        };

        l.forEach(function (line) {
            //after the header there is just an empty line
            if (!line) {
                if (self._ignoreNext > 0) {
                    self._ignoreNext--;
                }
                else {
                    self._header = false;
                    self._body = '';
                }
                //return;
            }
            //If we are still in the header check the content length
            if (self._header) {
                parseHeader(line);
            }
            else {
                //If we're in the body save the content
                var oldBody = self._body;
                self._body += line;
                //Apperantly the header doesn't neccessariily starts in a new line
                //so we need to parse it a little hackey...or rewrite the parser completely at some point
                if (self._body.length > self._contentLength) {
                    self._body = oldBody;
                    var splitLine = line.split("Content-Length:");
                    self.body += splitLine[0];
                    parseHeader('Content-Length:' + splitLine[1]);
                }
            }
            //console.log('BodyLength: %d | ContentLength: %d', self._body.length, self._contentLength);
            if (self._body.length === self._contentLength && self._contentLength > 0) {
                var responseIgnored = true;
                try {
                    var body = JSON.parse(self._body);
                    if (body.event === 'break') {
                        self.emit('break', body.body);
                        responseIgnored = false;
                    }
                    if (body.type === 'response') {
                        if (self._waitingForResponse[body.request_seq].callback) {
                            responseIgnored = false;
                            self._waitingForResponse[body.request_seq].callback(body.command, body.body, body.running);
                        }
                        delete self._waitingForResponse[body.request_seq];
                        
                        if(body.command === 'version'){
                            var version = body.body.V8Version;
                            //TODO Print node/debugger version on connect
                        }
                    }
                    if (body.event === 'afterCompile'){
                        // Muffle for now
                        // Maybe use this add a feature to list the files the debugger has loaded
                        responseIgnored = false;
                    }
                    
                    if (responseIgnored) {
                        console.warn('[Node Debugger] V8 Response ignored: ');
                        console.warn(JSON.parse(self._body));
                    }
                }
                catch (e) {
                    //Just ignore it for now
                    console.error('Invalid response: ' + data.toString(), e);
                }
                //reset header && body
                self._header = true;
                self._body = '';
                self._contentLength = -1;
            }
        });
    });
};

debugConnector.prototype.sendCommand = function (self, obj) {
    //var self = this;
    // if (self.connected) {
    obj.seq = ++self._seq;
    obj.type = "request";

    var str = JSON.stringify(obj);

    self._waitingForResponse[obj.seq] = obj;
    self.socket.write("Content-Length:" + str.length + "\r\n\r\n" + str);
    /*}
    else {
        //Just ignore it, that is ok
        console.error('[Node-Debugger] Can\'t send command, not connected!');
    }*/
};

module.exports = {
    debugConnector: debugConnector
};
