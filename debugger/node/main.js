/*global require*/
// https://github.com/v8/v8/wiki/Debugging-Protocol
'use strict';

var DebugConnector = require('./debug.js').DebugConnector;

var _domainManager;
var debug;
var _maxDepth;
var path = require('path');
var DOMAIN_NAME = path.basename(__filename);
var reconnecting = null;

var stepCallback = function (c, b, running) {
    if (running) {
        _domainManager.emitEvent(DOMAIN_NAME, 'running');
    }
};

function stepNext() {
    debug.sendCommand(debug, {
        'command': 'continue',
        'callback': stepCallback,
        'arguments': {
            'stepaction': 'next'
        }
    });
}

function stepIn() {
    debug.sendCommand(debug, {
        'command': 'continue',
        'callback': stepCallback,
        'arguments': {
            'stepaction': 'in'
        }
    });
}

function stepOut() {
    debug.sendCommand(debug, {
        'command': 'continue',
        'callback': stepCallback,
        'arguments': {
            'stepaction': 'out'
        }
    });
}

function stepContinue() {
    debug.sendCommand(debug, {
        'callback': stepCallback,
        'command': 'continue'
    });
}

function setBreakpoint(file, line) {
    var obj = {};
    var fullPath = file;
    //Windows work around
    if (file.search(':') !== -1) {
        file = file.split('/').join('\\');
    }

    obj.command = 'setbreakpoint';
    obj.arguments = {
        'type': 'script',
        'target': file,
        'line': line
    };

    obj.callback = function (c, body) {
        body.fullPath = fullPath;
        _domainManager.emitEvent(DOMAIN_NAME, 'setBreakpoint', body);
    };

    debug.sendCommand(debug, obj);
}

function removeBreakpoint(breakpoint) {
    var listbreakpoints_request = {};
    listbreakpoints_request.command = 'listbreakpoints';
    listbreakpoints_request.callback = function (cc, listbreakpoints_body) {
        if (listbreakpoints_body && listbreakpoints_body.breakpoints) {
            listbreakpoints_body.breakpoints.forEach(function (bt) {
                if (bt.line === breakpoint.line && bt.script_name === breakpoint.fullPath) {
                    var obj = {};
                    obj.command = 'clearbreakpoint';
                    obj.arguments = {
                        'breakpoint': bt.number
                    };
                    obj.callback = function (c, body) {
                        _domainManager.emitEvent(DOMAIN_NAME, 'clearBreakpoint', body);
                    };
                    debug.sendCommand(debug, obj);
                }
            });
        }
    };
    debug.sendCommand(debug, listbreakpoints_request);
}

function evaluate(com) {
    var obj = {};
    obj.command = 'evaluate';
    obj.arguments = {
        'expression': com
    };

    obj.callback = function (c, body) {
        //If this is from type object get the properties as well
        if (body.type === 'object' && body.properties) {
            //Get all handles and send lookup
            var handles = [];
            body.properties.forEach(function (h) {
                handles.push(h.ref);
            });
            _recursiveLookup(handles, 0, {}, function (cmd, b) {
                //Add the lookup stuff and emit the event
                body.lookup = b;
                _domainManager.emitEvent(DOMAIN_NAME, 'eval', body);
            });
        }
        else {
            _domainManager.emitEvent(DOMAIN_NAME, 'eval', body);
        }
    };

    debug.sendCommand(debug, obj);
}

//Get all the arguments and locals for the current frame
//TODO Get the scopes and then the locals from the scope to get more information
function getFrame() {
    debug.sendCommand(debug, {
        'command': 'frame',
        'callback': function (c, body) {
            var handles = [];
            if (body.arguments && body.arguments.length > 0) {
                body.arguments.forEach(function (b) {
                    handles.push(b.value.ref);
                });
            }

            if (body.locals && body.locals.length > 0) {
                body.locals.forEach(function (b) {
                    handles.push(b.value.ref);
                });
            }

            _recursiveLookup(handles, 0, {}, function (cmd, b) {
                //Add the lookup stuff and emit the event
                body.lookup = b;
                _domainManager.emitEvent(DOMAIN_NAME, 'frame', body);
            });
        }
    });
}

function _recursiveLookup(handles, depth, objects, callback) {
    debug.sendCommand(debug, {
        'command': 'lookup',
        'arguments': {
            'handles': handles
        },
        'callback': function (c, body) {
            var newHandles = [];
            //Go through every object, get the handles and send it again
            Object.keys(body).forEach(function (b) {
                b = body[b];
                if (b.type === 'object' && b.properties) {
                    b.properties.forEach(function (p) {
                        newHandles.push(p.ref);
                    });
                }
            });

            Object.keys(body).forEach(function (o) {
                o = body[o];
                objects[o.handle] = o;
            });

            depth++;
            if (depth <= _maxDepth) {
                _recursiveLookup(newHandles, depth, objects, callback);
            }
            else {
                callback(c, objects);
            }
        }
    });
}

function disconnect() {
    //Make sure that you don't connect again
    debug.sendCommand(debug, {
        'command': 'disconnect'
    });
    clearTimeout(reconnecting);
    reconnecting = null;
}

function getBreakpoints() {
    debug.sendCommand(debug, {
        'command': 'listbreakpoints',
        'callback': function (c, body) {
            _domainManager.emitEvent(DOMAIN_NAME, 'allBreakpoints', body);
        }
    });
}

function start(port, host, maxDepth) {

    _maxDepth = maxDepth;
    if (!debug) {
        debug = new DebugConnector(port, host);
        debug.port = port;
        debug.host = host;
        setEventHandlers();
    }
    debug.connect();
}

function setEventHandlers() {

    debug.on('connect', function () {
        //Get information
        debug.sendCommand(debug, {
            'command': 'version',
            'callback': function (c, body, running) {
                body.running = running;
                _domainManager.emitEvent(DOMAIN_NAME, 'connect', body);
            }
        });
    });

    debug.on('error', function (err) {
        if (err.errno !== 'ECONNREFUSED') {
            _domainManager.emitEvent(DOMAIN_NAME, 'close', err.errno);
        }

    });

    debug.on('close', function (err) {
        //Try in a second again
        if (!reconnecting) {
            reconnecting = setTimeout(function () {
                start(debug.port, debug.host, _maxDepth);
            }, 2000);
        }
        else {
            reconnecting = null;
        }

        if (!err) {
            _domainManager.emitEvent(DOMAIN_NAME, 'close', false);
        }
    });

    debug.on('break', function (body) {
        _domainManager.emitEvent(DOMAIN_NAME, 'break', body);
    });

    debug.on('afterCompile', function (body) {
        _domainManager.emitEvent(DOMAIN_NAME, 'afterCompile', body);
    });
}

function init(domainManager) {
    _domainManager = domainManager;

    if (!domainManager.hasDomain(DOMAIN_NAME)) {
        domainManager.registerDomain(DOMAIN_NAME, {
            major: 0,
            minor: 1
        });
    }

    _domainManager.registerCommand(
        DOMAIN_NAME,
        'debugger_start',
        start,
        false,
        'Start the socket to listen to the debugger', [
            {
                name: 'port',
                type: 'number',
                description: 'The port the V8 debugger is running on'
            },
            {
                name: 'host',
                type: 'string',
                description: 'The host the V8 debugger is running on'
            },

            {
                name: 'maxDepth',
                type: 'number',
                description: 'The max depth the lookup goes down'
            }
        ]
    );

    _domainManager.registerCommand(
        DOMAIN_NAME,
        'stepNext',
        stepNext,
        false,
        'Continue with action next'
    );

    _domainManager.registerCommand(
        DOMAIN_NAME,
        'disconnect',
        disconnect,
        false,
        'Disconnect from the V8 debugger'
    );

    _domainManager.registerCommand(
        DOMAIN_NAME,
        'stepIn',
        stepIn,
        false,
        'Continue with action In'
    );

    _domainManager.registerCommand(
        DOMAIN_NAME,
        'stepOut',
        stepOut,
        false,
        'Continue with action out'
    );

    _domainManager.registerCommand(
        DOMAIN_NAME,
        'continue',
        stepContinue,
        false,
        'Continue running the script'
    );


    _domainManager.registerCommand(
        DOMAIN_NAME,
        'eval',
        evaluate,
        false,
        'Evaluate an expression', [{
            name: 'Com',
            type: 'string',
            description: 'The expression to evaluate'
        }]
    );

    _domainManager.registerCommand(
        DOMAIN_NAME,
        'getFrame',
        getFrame,
        false,
        'Get the current frame with all arguments/locals'
    );

    _domainManager.registerCommand(
        DOMAIN_NAME,
        'setBreakpoint',
        setBreakpoint,
        false,
        'Set a new Breakpoint', [
            {
                name: 'file',
                type: 'string',
                description: 'The path to the file where the breakpoint is to set'
            },
            {
                name: 'line',
                type: 'number',
                description: 'The line number where the breakpoint is to set'
            }]
    );

    _domainManager.registerCommand(
        DOMAIN_NAME,
        'removeBreakpoint',
        removeBreakpoint,
        false,
        'Remove a Breakpoint', [{
            name: 'breakpoint',
            type: 'number',
            description: 'The id from the breakpoint to remove'
        }]
    );

    _domainManager.registerCommand(
        DOMAIN_NAME,
        'getBreakpoints',
        getBreakpoints,
        false,
        'Get a list of all Breakpoints'
    );

    _domainManager.registerEvent(
        DOMAIN_NAME,
        'connect', [{
            name: 'body',
            type: 'Object',
            description: 'Response from the V8 debugger'
        }]
    );

    _domainManager.registerEvent(
        DOMAIN_NAME,
        'running'
    );

    _domainManager.registerEvent(
        DOMAIN_NAME,
        'close', [{
            name: 'error',
            type: 'string',
            description: 'Reason for close'
        }]
    );

    _domainManager.registerEvent(
        DOMAIN_NAME,
        'break', [{
            name: 'Body',
            type: '{ invocationText: string, sourceLine: number, sourceColumn: number, sourceLineText: string, script: object, breakpoints: array }',
            description: 'The body V8 sends us'
        }]
    );

    _domainManager.registerEvent(
        DOMAIN_NAME,
        'afterCompile', [{
            name: 'Body',
            type: 'object',
            description: 'The body V8 sends us as response'
        }]
    );

    _domainManager.registerEvent(
        DOMAIN_NAME,
        'eval', [{
            name: 'Body',
            type: 'object',
            description: 'The body V8 sends us as response'
        }]
    );

    _domainManager.registerEvent(
        DOMAIN_NAME,
        'setBreakpoint', [{
            name: 'args',
            type: 'object',
            description: 'The Arguments V8 sends us as response'
        }]
    );

    _domainManager.registerEvent(
        DOMAIN_NAME,
        'clearBreakpoint', [{
            name: 'args',
            type: 'object',
            description: 'The Arguments V8 sends us as response'
        }]
    );

    _domainManager.registerEvent(
        DOMAIN_NAME,
        'allBreakpoints', [{
            name: 'args',
            type: 'object',
            description: 'The Arguments V8 sends us as response'
        }]
    );

    _domainManager.registerEvent(
        DOMAIN_NAME,
        'frame', [{
            name: 'args',
            type: 'object',
            description: 'The Arguments V8 sends us as response'
        }]
    );
}

exports.init = init;
