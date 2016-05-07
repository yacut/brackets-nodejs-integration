/*global define, $, brackets */
define(function (require, exports) {
    "use strict";

    var PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        DocumentManager = brackets.getModule("document/DocumentManager"),
        CommandManager = brackets.getModule("command/CommandManager"),
        Commands = brackets.getModule("command/Commands"),
        Editor = brackets.getModule("editor/EditorManager"),
        prefs = PreferencesManager.getExtensionPrefs("brackets-nodejs-integration");

    var debug = function () {
        this._nodeDebuggerDomain = null;
        this._activeLine = 0;
        this._activeDocPath = '';
        this._highlightCm = null;
    };
    exports.create_new = function () {
        return new debug();
    };

    var nextClickHandler = function (nodeDebuggerDomain) {
        nodeDebuggerDomain.exec('stepNext');
    };

    var inClickHandler = function (nodeDebuggerDomain) {
        nodeDebuggerDomain.exec('stepIn');
    };

    var outClickHandler = function (nodeDebuggerDomain) {
        nodeDebuggerDomain.exec('stepOut');
    };

    var continueClickHandler = function (nodeDebuggerDomain) {
        nodeDebuggerDomain.exec('continue');
    };

    var openActiveDoc = function (that) {
        if (that._activeDocPath && that._activeLine) {
            //NOTE: For some reason the execute promisie doesn't resolve to fail but this workaround will do for now
            try {
                CommandManager.execute(Commands.CMD_OPEN, {
                        fullPath: that._activeDocPath
                    })
                    .then(function () {

                        var ae = Editor.getActiveEditor();
                        //_activeLine = body.sourceLine;
                        //_activeDocPath = docPath;
                        ae.setCursorPos(that._activeLine);
                        //Highlight the line
                        that._highlightCm = ae._codeMirror;
                        that._activeLine = that._highlightCm.addLineClass(that._activeLine, 'node-debugger-highlight-background', 'node-debugger-highlight');
                    }, function () {
                        console.log('[Node Debugger] Failed to open Document: ' + that._activeDocPath);
                    });
            }
            catch (e) {
                console.log('[Node Debugger] Failed to open Document: ' + that._activeDocPath);
            }
        }
    };

    debug.prototype.init = function (nodeDebuggerDomain, nodeDebuggerPanel) {
        this._nodeDebuggerDomain = nodeDebuggerDomain;
        this.nodeDebuggerPanel = nodeDebuggerPanel;
        //and set the event listener
        debuggerDomainEvents(this);
        var that = this;
        //Add all the standard control elements
        var $activate = $('<a>').addClass('icon activate').attr('title', 'Connect status').html('<i class="fa fa-times-circle" aria-hidden="true"></i>');
        var $next = $('<a>').addClass('icon inactive').attr('href', '#').attr('title', 'Step over to next function (F10)').html('<i class="fa fa-share" aria-hidden="true"></i>');
        var $in = $('<a>').addClass('icon inactive').attr('href', '#').attr('title', 'Step in (F11)').html('<i class="fa fa-level-down" aria-hidden="true"></i>');
        var $out = $('<a>').addClass('icon inactive').attr('href', '#').attr('title', 'Step out (Shift-F11)').html('<i class="fa fa-level-up" aria-hidden="true"></i>');
        var $continue = $('<a>').addClass('icon inactive').attr('href', '#').attr('title', 'Continue (F8)').html('<i class="fa fa-forward" aria-hidden="true"></i>');

        var $jumpToBreak = $('<a>').addClass('icon inactive').attr('href', '#').attr('title', 'Jump to break').html('<i class="fa fa-eye" aria-hidden="true"></i>');

        nodeDebuggerPanel.addControlElement($continue, true, function () {
            continueClickHandler(nodeDebuggerDomain);
        });
        nodeDebuggerPanel.addControlElement($out, true, function () {
            outClickHandler(nodeDebuggerDomain);
        });
        nodeDebuggerPanel.addControlElement($in, true, function () {
            inClickHandler(nodeDebuggerDomain);
        });
        nodeDebuggerPanel.addControlElement($next, true, function () {
            nextClickHandler(nodeDebuggerDomain);
        });
        nodeDebuggerPanel.addControlElement($activate, true, function () {});
        nodeDebuggerPanel.addControlElement($jumpToBreak, false, function () {
            openActiveDoc(that);
        });
    };

    /**
     * Add all the event listener to the Debugger Domain
     **/
    var debuggerDomainEvents = function (that) {
        //If debugger is running again deactive buttons and remove line highlight
        $(that._nodeDebuggerDomain).on("running", function () {
            that.nodeDebuggerPanel.$logPanel.find('a.active').addClass('inactive').removeClass('active');
            if (that._highlightCm) {
                that._highlightCm.removeLineClass(that._activeLine, 'node-debugger-highlight-background', 'node-debugger-highlight');
                that._highlightCm = null;
                that._activeLine = null;
                that._activeDocPath = null;
            }
        });

        //If the debugger breaks, activate buttons and open the file we break/highlight line
        $(that._nodeDebuggerDomain).on("break", function (e, body) {
            //Fixme: Just to support windows, however this most likely won't work in every case
            var docPath = body.script.name.replace(/\\/g, '/');

            //Make sure the panel is open
            that.nodeDebuggerPanel.panel.show();
            that.nodeDebuggerPanel.$logPanel.find('a.inactive').addClass('active').removeClass('inactive');

            //Remove old highlight
            if (that._highlightCm) {
                that._highlightCm.removeLineClass(that._activeLine, 'node-debugger-highlight-background', 'node-debugger-highlight');
            }

            //Where is the break?
            that._activeLine = body.sourceLine;
            that._activeDocPath = docPath;
            //Open the document and jump to line
            openActiveDoc(that);

        });

        //If the Debugger connects highlight the UI parts that need to be highlighted
        $(that._nodeDebuggerDomain).on("connect", function (e, body) {
            that.nodeDebuggerPanel.$logPanel.find('.activate').html('<i class="fa fa-check-circle" aria-hidden="true"></i>');
            //$('#node-debugger-indicator').addClass('connected');

            if (body.running) {
                that.nodeDebuggerPanel.$logPanel.find('a.active').addClass('inactive').removeClass('active');
            }
            else {
                that.nodeDebuggerPanel.$logPanel.find('a.inactive').addClass('active').removeClass('inactive');
            }
        });

        //If the Debugger disconnect remove all the highlights
        $(that._nodeDebuggerDomain).on("close", function (e, err) {
            var msg = err;
            if (err === 'ECONNREFUSED') {
                msg = "Couldn't connect to " + prefs.get("debugger-host") + ":" + prefs.get("debugger-port");
            }

            that.nodeDebuggerPanel.log($('<span>').text(msg));

            //GUI update
            that.nodeDebuggerPanel.$logPanel.find('.activate').html('<i class="fa fa-times-circle" aria-hidden="true"></i>');
            that.nodeDebuggerPanel.$logPanel.find('a.active').addClass('inactive').removeClass('active');
            //$('#node-debugger-indicator').removeClass('connected');

            //remove highlight
            if (that._highlightCm) {
                that._highlightCm.removeLineClass(that._activeLine, 'node-debugger-highlight-background', 'node-debugger-highlight');
                that._highlightCm = null;
                that._activeLine = null;
            }
        });

        //On evaluate display the result
        $(that._nodeDebuggerDomain).on("eval", function (e, body) {
            var $wrapper = $('<span>').addClass('wrapper');
            var $output = that.nodeDebuggerPanel.createEvalHTML(body, 0, body.lookup);

            $output.appendTo($wrapper);
            that.nodeDebuggerPanel.log($wrapper);
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


    //exports.debug = debug;
});
