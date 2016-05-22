'use strict';
/*global define, brackets, $ */
define(function (require, exports) {

    var _ = brackets.getModule('thirdparty/lodash');

    var command_manager = brackets.getModule('command/CommandManager');
    var document_manager = brackets.getModule('document/DocumentManager');
    var editor_manager = brackets.getModule('editor/EditorManager');
    var menus = brackets.getModule('command/Menus');
    var preferences_manager = brackets.getModule('preferences/PreferencesManager');

    var prefs = preferences_manager.getExtensionPrefs('brackets-nodejs-integration');
    var gutterName = 'node-debugger-bp-gutter';

    exports.create_new = function () {
        return new BreakpointGutter();
    };

    var BreakpointGutter = function () {
        this.cm = null;
        this.cd = null;
        this.breakpoints = prefs.get('breakpoints') || [];
        this._nodeDebuggerDomain = null;

    };

    /*
     * Sets the CodeMirror instance for the active editor
     */
    function _updateCm(that) {
        var editor = editor_manager.getActiveEditor();

        if (!editor || !editor._codeMirror) {
            return;
        }

        that.cm = editor._codeMirror;

        //Get the path to the current file as well
        var _cd = document_manager.getCurrentDocument();
        if (_cd) {
            that.cd = _cd.file.fullPath;
        }

    }

    /*
     * Set all gutters for the currentDocument
     */
    function _updateGutters(that) {
        _updateCm(that);
        if (!that.cm) {
            return;
        }

        var gutters = that.cm.getOption('gutters').slice(0);
        if (gutters.indexOf(gutterName) === -1) {
            gutters.unshift(gutterName);
            that.cm.setOption('gutters', gutters);
            that.cm.on('gutterClick', function (cm, n, gutterId) {
                gutterClick(cm, n, gutterId, that);
            });
        }

        //Set all the gutters now
        _.each(prefs.get('breakpoints'), function (bp) {
            var editor = editor_manager.getActiveEditor();
            if (!editor || !editor._codeMirror) {
                return;
            }
            if (bp.fullPath === that.cd) {
                var $marker = $('<div>')
                    .addClass('breakpoint-gutter')
                    .html('<i class="fa fa-circle" aria-hidden="true"></i>');
                editor._codeMirror.setGutterMarker(bp.line, gutterName, $marker[0]);
            }
        });
    }

    /*
     * remove all gutters from the current document
     */
    function _clearGutters(that) {
        _updateCm(that);
        if (!that.cm) {
            return;
        }
        var gutters = that.cm.getOption('gutters').slice(0),
            io = gutters.indexOf(gutterName);
        if (io !== -1) {
            gutters.splice(io, 1);
            that.cm.clearGutter(gutterName);
            that.cm.setOption('gutters', gutters);
            that.cm.off('gutterClick', function (cm, n, gutterId) {
                gutterClick(cm, n, gutterId, that);
            });
        }
    }

    /*
     * Sets or removes Breakpoint at cliked line
     *
     * @param {CodeMirror} cm
     * The CodeMirror instance
     *
     * @param {Number} n
     * LineNumber
     *
     * @param {String} gutterId
     */
    function gutterClick(code_mirror, line_number, gutter_id, that) {
        if (gutter_id !== gutterName && gutter_id !== 'CodeMirror-linenumbers') {
            return;
        }
        if (!that.cd) {
            var _cd = document_manager.getCurrentDocument();
            if (_cd) {
                that.cd = _cd.file.fullPath;
            }
        }
        if (!_.endsWith(that.cd, '.js')) {
            return;
        }

        var line_info = code_mirror.lineInfo(line_number);

        if (line_info.gutterMarkers && line_info.gutterMarkers[gutterName]) {
            if (that._nodeDebuggerDomain) {
                that._nodeDebuggerDomain.exec('setBreakpoint', that.cd, line_number);
            }
            else {
                var breakpoints_to_save = prefs.get('breakpoints');
                _.remove(breakpoints_to_save, function (breakpoint) {
                    return breakpoint.fullPath === that.cd && breakpoint.line === line_number;
                });
                prefs.set('breakpoints', _.uniq(breakpoints_to_save, function (elem) {
                    return [elem.fullPath, elem.line].join();
                }));
                prefs.save();
                code_mirror.setGutterMarker(line_number, gutterName, null);
            }
        }
        else {
            if (that._nodeDebuggerDomain) {
                that._nodeDebuggerDomain.exec('removeBreakpoint', {
                    line: line_number,
                    fullPath: that.cd
                });
            }
            else {
                that.addBreakpoint({
                    line: line_number,
                    fullPath: that.cd
                }, that);
            }
        }
    }

    /* Sets the breakpoint gutter
     *
     * @param {breakpoint} bp
     * bp as object like the V8 Debugger sends it
     *
     */
    BreakpointGutter.prototype.addBreakpoint = function addBreakpoint(bp, self) {
        //if debug mocha test:
        //bp.actual_line = bp.line;
        var that = this ? this : self;
        bp.actual_line = bp.line ? bp.line : bp.actual_locations[0].line;
        if (!that.cm) {
            var editor = editor_manager.getActiveEditor();
            that.cm = editor._codeMirror;
        }
        var _cd = document_manager.getCurrentDocument();
        if (bp.fullPath === _cd.file.fullPath) {
            bp.cm = that.cm;
            var breakpoints_to_save = prefs.get('breakpoints');
            var breakpoint = {
                fullPath: bp.fullPath,
                line: bp.line
            };

            breakpoints_to_save.push(breakpoint);
            prefs.set('breakpoints', _.uniq(breakpoints_to_save, function (elem) {
                return [elem.fullPath, elem.line].join();
            }));
            prefs.save();
            var $marker = $('<div>')
                .addClass('breakpoint-gutter')
                .html('<i class="fa fa-circle" aria-hidden="true"></i>');
            bp.cm.setGutterMarker(bp.actual_line, gutterName, $marker[0]);
        }
    };

    /*
     * Removes all Breakpoints
     */
    BreakpointGutter.prototype.removeAllBreakpoints = function removeAllBreakpoints() {
        var that = this;
        _clearGutters(that);
        //And actually remove the breakpoints when the debugger is running
        _.each(prefs.get('breakpoints'), function (bp) {
            that._nodeDebuggerDomain.exec('removeBreakpoint', bp);
        });
        //Delete all
        prefs.set('breakpoints', []);

        //Update gutters again
        _updateGutters(that);
    };

    /*
     * Call on connect
     * Set all breakpoints if there are any
     * Remove all gutters and request a list of breakpoints
     * to make sure we're consistent
     */
    BreakpointGutter.prototype.setAllBreakpoints = function setAllBreakpoints() {
        var that = this;
        _.each(prefs.get('breakpoints'), function (bp) {
            that._nodeDebuggerDomain.exec('setBreakpoint', bp.fullPath, bp.line);
        });
        //NOTE: Reload all Breakpoints?
        //Request list of actual set breakpoints
        //_nodeDebuggerDomain.exec('getBreakpoints');
    };

    BreakpointGutter.prototype.init = function init(nodeDebuggerDomain, main_menu) {
        this._nodeDebuggerDomain = nodeDebuggerDomain;
        var that = this;
        _updateCm(this);
        _updateGutters(this);
        editor_manager.on('activeEditorChange', function () {
            _clearGutters(that);
            _updateCm(that);
            _updateGutters(that);
        });
        if (main_menu) {
            // Register command and add it to the menu.
            var TOGGLE_BREAKPOINT_COMMAND_ID = 'brackets-nodejs-integration.toggle-breakpoint';
            command_manager.register('Toggle Breakpoint', TOGGLE_BREAKPOINT_COMMAND_ID, function () {
                var editor = editor_manager.getActiveEditor();
                var cursor_position = editor.getCursorPos();
                if (editor && cursor_position) {
                    var current_line_position = cursor_position.line;
                    gutterClick(editor._codeMirror, current_line_position, gutterName, that);
                }
            });
            main_menu.addMenuItem(TOGGLE_BREAKPOINT_COMMAND_ID, 'F9', menus.LAST);
        }
    };
});
