/*global define, $, brackets */
define(function (require, exports) {
    "use strict";
    var PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        prefs = PreferencesManager.getExtensionPrefs("brackets-nodejs-integration");

    var bpGutter = require('./breakpointGutter'),
        nodeDebuggerPanel = require('../debuggerPanel').debuggerPanel;

    var breakpoints = {},
        _nodeDebuggerDomain;

    /**
     * Initialise the breakpoint module,
     *
     * @param {NodeDomain} nodeDebuggerDomain
     **/
    breakpoints.init = function (nodeDebuggerDomain) {
        _nodeDebuggerDomain = nodeDebuggerDomain;
        debuggerDomainEventListener();

        bpGutter.init(_nodeDebuggerDomain);

        //Add removeAllBreakpoints button
        var $bp = $('<a>').attr('href', '#').attr('title', 'Remove all Breakpoints').html('<i class="fa fa-minus-circle" aria-hidden="true"></i>');
        nodeDebuggerPanel.addControlElement($bp, false, function () {
            bpGutter.removeAllBreakpoints();
        });
    };

    /**
     * All event listener for the breakpoints
     **/
    function debuggerDomainEventListener() {
        //If we loose the connection remove all breakpoints if the user wants that
        $(_nodeDebuggerDomain).on('close', function () {
            if (prefs.get("removeBreakpointsOnDisconnect")) {
                bpGutter.removeAllBreakpoints();
            }
        });

        //Set all breakpoints again on connect
        $(_nodeDebuggerDomain).on("connect", function () {
            bpGutter.setAllBreakpoints();
        });

        //Set a new breakpoint
        $(_nodeDebuggerDomain).on("setBreakpoint", function (e, bp) {
            bpGutter.addBreakpoint(bp);
        });
    }

    exports.breakpoints = breakpoints;
});
