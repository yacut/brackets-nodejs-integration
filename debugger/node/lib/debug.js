var net = require('net'),
	events = require('events'),
	util = require('util');

var debugConnector = function() {
	events.EventEmitter.call(this);

	this.port = 5858;
	this.host = 'localhost';
	this.connected = false;

	this._seq = 0;
	this._waitingForResponse = {};
	this._body = '';
	this._header = true;
	this._contentLength = -1;
	this._ignoreNext = 0;

	this._debug = false;
};

util.inherits(debugConnector, events.EventEmitter);

debugConnector.prototype.connect = function() {
	var self = this;
	//Create connection to V8 Debugger
	this.socket = net.createConnection(self.port, self.host);

	this.socket.on('connect', function() {
		self.connected = true;

		//reset everything
		self._body = '';
		self._ignoreNext = 0;
		self._contentLength = -1;
		self.header = true;
		self._waitingForResponse = {};

		self.emit('connect');

		if(self._debug) {
			console.log('[Node Debugger] Connected to V8 debugger');
		}
	});

	this.socket.on('error', function(err) {
		self.emit('error', err);
		if(self._debug) {
			console.error('[Node Debugger] Error on socket: ');
			console.error(err);
		}
	});

	this.socket.on('close', function(err) {
		self.connected = false;
		self.emit('close', err);
	});

	this.socket.on('data', function(data) {
		var l = data.toString().split('\r\n');
		//console.log('----all data---');
		//console.log( data.toString() );
		//console.log('----end----')

		var parseHeader = function(line) {
			var h = line.split(':');
			//Check if that is really the content-length
			if( h[0] === 'Content-Length') {
				self._contentLength = parseInt(h[1], 10);

				//If there is no body we need to ignore the next empty line
				if(self._contentLength === 0) {
					self._ignoreNext = 2;
				}

				if(self._debug) {
					console.log('[Node Debugger] Found Header: ');
					console.log(line);
				}
			}
		};

		l.forEach(function( line ) {
			//console.log('---current line---');
			//console.log(line);
			//console.log('---line end---');

			//after the header there is just an empty line
			if (!line) {
				if(self._ignoreNext > 0) {
					self._ignoreNext--;
				} else {
					self._header = false;
					self._body = '';
				}
				//return;
			}

			//If we are still in the header check the content length
			if( self._header ) {
				parseHeader(line);
			} else {
				//If we're in the body save the content
				var oldBody = self._body;
				self._body += line;

				//Apperantly the header doesn't neccessariily starts in a new line
				//so we need to parse it a little hackey...or rewrite the parser completely at some point
				if(self._body.length > self._contentLength) {
					self._body = oldBody;
					var splitLine = line.split("Content-Length:");
					self.body += splitLine[0];
					parseHeader('Content-Length:'+splitLine[1]);
				}
			}

			if(self._debug) {
				console.log('BodyLength: %d | ContentLength: %d', self._body.length, self._contentLength);
			}
			if(self._body.length === self._contentLength && self._contentLength > -1) {
				var responseIgnored = true;

				try {
					var body = JSON.parse( self._body );
					//console.log(body);

					if(body.event === 'break') {
						self.emit('break', body.body);
						responseIgnored = false;
					}

					if(body.type === 'response') {

						if(self._waitingForResponse[body.request_seq].callback) {
							responseIgnored = false;
							self._waitingForResponse[body.request_seq].callback(body.command, body.body, body.running);
						}

						delete self._waitingForResponse[body.request_seq];
					}
				} catch(e) {
					//Just ignore it for now
					//TODO Print node/debugger version on connect
					//console.log('Unvalid response: ' + data.toString() );
				}

				if(responseIgnored && self._debug) {
					console.error('[Node Debugger] V8 Response ignored: ');
					console.error(self._body);
				}
				//reset header && body
				self._header = true;
				self._body = '';
				self._contentLength = -1;
			}
		});
	});
};

debugConnector.prototype.sendCommand = function(obj) {
	var self = this;

	if(self.connected) {
		obj.seq = ++self._seq;
		obj.type = "request";

		var str = JSON.stringify(obj);

		//console.log('Send: ');
		//console.log(str);

		self._waitingForResponse[obj.seq] = obj;
		self.socket.write( "Content-Length:" + str.length + "\r\n\r\n" + str);
	} else {
		//Just ignore it, that is ok
		//console.error('[Node-Debugger] Can\'t send command, not connected!');
	}
};

module.exports = {
	debugConnector: debugConnector
}
