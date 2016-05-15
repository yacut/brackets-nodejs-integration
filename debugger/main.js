/*global define, brackets, $ */
'use strict';

define(function (require, exports, module) {

    var NodeDomain = brackets.getModule('utils/NodeDomain');
    var PreferencesManager = brackets.getModule('preferences/PreferencesManager');
    var prefs = PreferencesManager.getExtensionPrefs('brackets-nodejs-integration');
    var ExtensionUtils = brackets.getModule('utils/ExtensionUtils');
    var file_system = brackets.getModule('filesystem/FileSystem');
    var file_utils = brackets.getModule('file/FileUtils');


    var domain_template_path = ExtensionUtils.getModulePath(module, 'node/main.js');
    var utils = require('../utils');
    exports.create_new_debugger = function (id, debug_port) {
        return new NodeDebugger(id, debug_port);
    };

    var NodeDebugger = function NodeDebugger(id, debug_port) {
        var that = this;
        this.id = id;
        prefs = prefs;
        this.$panel = $('#' + id);
        this.debug_port = debug_port;
        this.nodeDebuggerPanel = null;
        this.debug = null;
        this.breakpoints = null;
        this.locals = null;
        var file_path = ExtensionUtils.getModulePath(module, 'node/debugger_' + id); //+ '.js'
        this.file_path = file_path;
        var file = file_system.getFileForPath(domain_template_path);
        file.read(function (err, content) {
            if (err) {
                return console.error('Error NodeDebugger create file', err);
            }
            create_new_domain(that, id, file_path, content);
        });
    };

    function create_new_domain(that, id, file_path, content) {
        var file = file_system.getFileForPath(file_path);
        var dir = file_utils.getDirectoryPath(file.fullPath);
        utils.mkdirp(dir)
            .then(function () {
                return utils.create_file(file, content);
            }).then(function () {
                that.nodeDebuggerDomain = new NodeDomain('debugger_' + that.id, that.file_path);
            });
    }

    /**
     *Initalize the Debugger
     **/
    NodeDebugger.prototype.init = function () {
        if (!this.nodeDebuggerPanel) {
            var nodeDebuggerPanel = require('./debuggerPanel').create_new();
            nodeDebuggerPanel.init(this.nodeDebuggerDomain, this.id);
            var debug = require('./debugger/debugger').create_new();
            var breakpoints = require('./breakpoints/breakpoints').create_new();
            var locals = require('./locals/locals').create_new();

            this.nodeDebuggerPanel = nodeDebuggerPanel;
            this.debug = debug;
            this.breakpoints = breakpoints;
            this.locals = locals;

            this.debug.init(this.nodeDebuggerDomain, this.nodeDebuggerPanel);
            this.breakpoints.init(this.nodeDebuggerDomain, this.nodeDebuggerPanel);
            this.locals.init(this.nodeDebuggerDomain, this.nodeDebuggerPanel, this.id);
        }
        this.nodeDebuggerDomain.exec('debugger_start', this.debug_port, prefs.get('debugger-host'), prefs.get('lookupDepth'));
    };

    //exports.nodeDebugger = NodeDebugger;
    NodeDebugger.prototype.stop = function () {
        this.nodeDebuggerDomain.exec('disconnect');
    };

    //exports.nodeDebugger = NodeDebugger;
    NodeDebugger.prototype.exit = function () {
        this.nodeDebuggerDomain.exec('disconnect');
        var file = file_system.getFileForPath(this.file_path);
        file.unlink(function () {});
    };
});
