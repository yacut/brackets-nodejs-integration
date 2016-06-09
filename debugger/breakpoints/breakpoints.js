/*global define, $, brackets */
'use strict';

define(function (require, exports) {

    var PreferencesManager = brackets.getModule('preferences/PreferencesManager'),
        prefs = PreferencesManager.getExtensionPrefs('brackets-nodejs-integration');

    var Breakpoints = function () {
        this._nodeDebuggerDomain = null;
        this.bpGutter = require('./breakpointGutter').create_new();
        this.nodeDebuggerPanel = null;
    };

    /**
     * Initialise the breakpoint module,
     *
     * @param {NodeDomain} nodeDebuggerDomain
     **/
    Breakpoints.prototype.init = function (nodeDebuggerDomain, nodeDebuggerPanel) {
        this._nodeDebuggerDomain = nodeDebuggerDomain;
        this.nodeDebuggerPanel = nodeDebuggerPanel;
        var that = this;
        //If we loose the connection remove all breakpoints if the user wants that
        this._nodeDebuggerDomain.on('close', function () {
            if (prefs.get('removeBreakpointsOnDisconnect')) {
                that.bpGutter.removeAllBreakpoints();
            }
        });

        //Set all breakpoints again on connect
        this._nodeDebuggerDomain.on('connect', function () {
            that.bpGutter.setAllBreakpoints();
            if (!prefs.get('debugger_break_on_start')) {
                setTimeout(function () {
                    that._nodeDebuggerDomain.exec('continue');
                }, 500);
            }
        });

        //Set a new breakpoint
        this._nodeDebuggerDomain.on('setBreakpoint', function (e, bp) {
            that.bpGutter.addBreakpoint(bp);
        });

        this.bpGutter.init(this._nodeDebuggerDomain);

        //Add removeAllBreakpoints button
        var $bp = $('<a>').attr('href', '#').attr('title', 'Remove all Breakpoints').html('<i class="fa fa-minus-circle" aria-hidden="true"></i>');
        nodeDebuggerPanel.addControlElement($bp, false, function () {
            that.bpGutter.removeAllBreakpoints();
        });
    };

    exports.create_new = function () {
        return new Breakpoints();
    };
});
