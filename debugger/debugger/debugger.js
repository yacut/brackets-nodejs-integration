/*global define, $, brackets */
define(function (require, exports) {
    "use strict";

    var PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        CommandManager = brackets.getModule("command/CommandManager"),
        Commands = brackets.getModule("command/Commands"),
        Editor = brackets.getModule("editor/EditorManager"),
        prefs = PreferencesManager.getExtensionPrefs("brackets-nodejs-integration");

    var nodeDebuggerPanel = require('./../debuggerPanel').debuggerPanel;

    var debug = {},
        _nodeDebuggerDomain,
        _activeLine,
        _activeDocPath,
        _highlightCm;

    //All the Click Handler for the Buttons
    var activateClickHandler = function () {
        //_nodeDebuggerDomain.exec("debugger_start", prefs.get("debugger-port"), prefs.get("debugger-host"), false, prefs.get("lookupDepth"));
    };

    var nextClickHandler = function () {
        _nodeDebuggerDomain.exec('stepNext');
    };

    var inClickHandler = function () {
        _nodeDebuggerDomain.exec('stepIn');
    };

    var outClickHandler = function () {
        _nodeDebuggerDomain.exec('stepOut');
    };

    var continueClickHandler = function () {
        _nodeDebuggerDomain.exec('continue');
    };

    var openActiveDoc = function () {
        if (_activeDocPath && _activeLine) {
            //NOTE: For some reason the execute promisie doesn't resolve to fail but this workaround will do for now
            try {
                CommandManager.execute(Commands.CMD_OPEN, {
                        fullPath: _activeDocPath
                    })
                    .then(function () {

                        var ae = Editor.getActiveEditor();
                        //_activeLine = body.sourceLine;
                        //_activeDocPath = docPath;
                        ae.setCursorPos(_activeLine);
                        //Highlight the line
                        _highlightCm = ae._codeMirror;
                        _activeLine = _highlightCm.addLineClass(_activeLine, 'node-debugger-highlight-background', 'node-debugger-highlight');
                    }, function () {
                        console.log('[Node Debugger] Failed to open Document: ' + _activeDocPath);
                    });
            }
            catch (e) {
                console.log('[Node Debugger] Failed to open Document: ' + _activeDocPath);
            }
        }
    };

    debug.init = function (nodeDebuggerDomain) {
        _nodeDebuggerDomain = nodeDebuggerDomain;
        //and set the event listener
        debuggerDomainEvents();

        //Add all the standard control elements
        var $activate = $('<a>').addClass('icon activate inactive').attr('href', '#').attr('title', 'Connect status').html('<i class="fa fa-times-circle" aria-hidden="true"></i>');
        var $next = $('<a>').addClass('icon inactive').attr('href', '#').attr('title', 'Step over to next function (F10)').html('<i class="fa fa-share" aria-hidden="true"></i>');
        var $in = $('<a>').addClass('icon inactive').attr('href', '#').attr('title', 'Step in (F11)').html('<i class="fa fa-level-down" aria-hidden="true"></i>');
        var $out = $('<a>').addClass('icon inactive').attr('href', '#').attr('title', 'Step out (Shift-F11)').html('<i class="fa fa-level-up" aria-hidden="true"></i>');
        var $continue = $('<a>').addClass('icon inactive').attr('href', '#').attr('title', 'Continue (F8)').html('<i class="fa fa-forward" aria-hidden="true"></i>');

        var $jumpToBreak = $('<a>').addClass('icon inactive').attr('href', '#').attr('title', 'Jump to break').html('<i class="fa fa-eye" aria-hidden="true"></i>');

        nodeDebuggerPanel.addControlElement($continue, true, continueClickHandler);
        nodeDebuggerPanel.addControlElement($out, true, outClickHandler);
        nodeDebuggerPanel.addControlElement($in, true, inClickHandler);
        nodeDebuggerPanel.addControlElement($next, true, nextClickHandler);
        nodeDebuggerPanel.addControlElement($activate, true, activateClickHandler);
        nodeDebuggerPanel.addControlElement($jumpToBreak, false, openActiveDoc);
    };

    /**
     * Add all the event listener to the Debugger Domain
     **/
    var debuggerDomainEvents = function () {
        //If debugger is running again deactive buttons and remove line highlight
        $(_nodeDebuggerDomain).on("running", function () {
            nodeDebuggerPanel.$logPanel.find('a.active').addClass('inactive').removeClass('active');
            if (_highlightCm) {
                _highlightCm.removeLineClass(_activeLine, 'node-debugger-highlight-background', 'node-debugger-highlight');
                _highlightCm = null;
                _activeLine = null;
                _activeDocPath = null;
            }
        });

        //If the debugger breaks, activate buttons and open the file we break/highlight line
        $(_nodeDebuggerDomain).on("break", function (e, body) {
            //Fixme: Just to support windows, however this most likely won't work in every case
            var docPath = body.script.name.replace(/\\/g, '/');

            //Make sure the panel is open
            nodeDebuggerPanel.panel.show();
            nodeDebuggerPanel.$logPanel.find('a.inactive').addClass('active').removeClass('inactive');

            //Remove old highlight
            if (_highlightCm) {
                _highlightCm.removeLineClass(_activeLine, 'node-debugger-highlight-background', 'node-debugger-highlight');
            }

            //Where is the break?
            _activeLine = body.sourceLine;
            _activeDocPath = docPath;
            //Open the document and jump to line
            openActiveDoc();

        });

        //If the Debugger connects highlight the UI parts that need to be highlighted
        $(_nodeDebuggerDomain).on("connect", function (e, body) {
            nodeDebuggerPanel.log($('<span>').text('Debugger connected'));
            nodeDebuggerPanel.$logPanel.find('.activate').html('<i class="fa fa-check-circle" aria-hidden="true"></i>')
            $('#node-debugger-indicator').addClass('connected');

            //console.log(body);

            if (body.running) {
                nodeDebuggerPanel.$logPanel.find('a.active').addClass('inactive').removeClass('active');
            }
            else {
                nodeDebuggerPanel.$logPanel.find('a.inactive').addClass('active').removeClass('inactive');
            }
        });

        //If the Debugger disconnect remove all the highlights
        $(_nodeDebuggerDomain).on("close", function (e, err) {
            var msg = "Debugger disconnected";
            if (err) {
                msg += ": " + err;
            }

            if (err === 'ECONNREFUSED') {
                msg = "Couldn't connect to " + prefs.get("debugger-host") + ":" + prefs.get("debugger-port");
            }

            nodeDebuggerPanel.log($('<span>').text(msg));

            //GUI update
            nodeDebuggerPanel.$logPanel.find('.activate').html('<i class="fa fa-times-circle" aria-hidden="true"></i>')
            nodeDebuggerPanel.$logPanel.find('a.active').addClass('inactive').removeClass('active');
            $('#node-debugger-indicator').removeClass('connected');

            //remove highlight
            if (_highlightCm) {
                _highlightCm.removeLineClass(_activeLine, 'node-debugger-highlight-background', 'node-debugger-highlight');
                _highlightCm = null;
                _activeLine = null;
            }
        });

        //On evaluate display the result
        $(_nodeDebuggerDomain).on("eval", function (e, body) {
            var $wrapper = $('<span>').addClass('wrapper');
            var $output = nodeDebuggerPanel.createEvalHTML(body, 0, body.lookup);

            $output.appendTo($wrapper);
            nodeDebuggerPanel.log($wrapper);
        });

        //control debugger with keyboard
        $(document).on('keydown', function (e) {
            //console.log('keydown: ' + e.keyCode);
            if (e.keyCode === 119) {
                continueClickHandler();
            }

            if (e.keyCode === 121) {
                nextClickHandler();
            }

            if (e.keyCode === 122 && e.shiftKey) {
                outClickHandler();
            }
            else if (e.keyCode === 122) {
                inClickHandler();
            }
        });
    };


    exports.debug = debug;
});
