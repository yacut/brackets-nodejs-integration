/*!
 * Brackets Node Debugger
 *
 * @author Benjamin August
 * @license http://opensource.org/licenses/MIT
 */

/*global define, brackets, $ */
define(function (require, exports) {
    "use strict";

    var _ = brackets.getModule("thirdparty/lodash"),
        EditorManager = brackets.getModule("editor/EditorManager"),
        DocumentManager = brackets.getModule("document/DocumentManager");
    var PreferencesManager = brackets.getModule("preferences/PreferencesManager");
    var prefs = PreferencesManager.getExtensionPrefs("brackets-nodejs-integration");
    var gutterName = 'node-debugger-bp-gutter';

    exports.create_new = function () {
        return new breakpointGutter();
    };
    var breakpointGutter = function () {
        this.cm = null;
        this.cd = null;
        this.breakpoints = prefs.get('breakpoints') || [];
        this._nodeDebuggerDomain = null;

    };

    /*
     * Sets the CodeMirror instance for the active editor
     */
    function _updateCm(that) {
        var editor = EditorManager.getActiveEditor();

        if (!editor || !editor._codeMirror) {
            return;
        }

        that.cm = editor._codeMirror;

        //Get the path to the current file as well
        var _cd = DocumentManager.getCurrentDocument();
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

        var gutters = that.cm.getOption("gutters").slice(0);
        if (gutters.indexOf(gutterName) === -1) {
            gutters.unshift(gutterName);
            that.cm.setOption("gutters", gutters);
            that.cm.on("gutterClick", function (cm, n, gutterId) {
                gutterClick(cm, n, gutterId, that);
            });
        }

        //Set all the gutters now
        _.each(prefs.get('breakpoints'), function (bp) {
            var editor = EditorManager.getActiveEditor();
            if (!editor || !editor._codeMirror) {
                return;
            }
            if (bp.fullPath === that.cd) {
                var $marker = $("<div>")
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
        var gutters = that.cm.getOption("gutters").slice(0),
            io = gutters.indexOf(gutterName);
        if (io !== -1) {
            gutters.splice(io, 1);
            that.cm.clearGutter(gutterName);
            that.cm.setOption("gutters", gutters);
            that.cm.off("gutterClick", function (cm, n, gutterId) {
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
        if (gutter_id !== gutterName && gutter_id !== "CodeMirror-linenumbers") {
            return;
        }

        var line_info = code_mirror.lineInfo(line_number);

        if (line_info.gutterMarkers && line_info.gutterMarkers[gutterName]) {
            if (that._nodeDebuggerDomain) {
                that._nodeDebuggerDomain.exec("removeBreakpoint", {
                    line: line_number,
                    fullPath: that.cd
                });
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
                if (_.indexOf(prefs.get('breakpoints'), {fullPath: that.cd, line: line_number}) !== -1) {
                    that._nodeDebuggerDomain.exec("setBreakpoint", that.cd, line_number);
                }
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
    breakpointGutter.prototype.addBreakpoint = function addBreakpoint(bp, self) {
        //if debug mocha test:
        //bp.actual_line = bp.line;
        var that = this ? this : self;
        bp.actual_line = bp.line ? bp.line : bp.actual_locations[0].line;
        if (!that.cm) {
            var editor = EditorManager.getActiveEditor();
            that.cm = editor._codeMirror;
        }
        var _cd = DocumentManager.getCurrentDocument();
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
            var $marker = $("<div>")
                .addClass('breakpoint-gutter')
                .html('<i class="fa fa-circle" aria-hidden="true"></i>');
            bp.cm.setGutterMarker(bp.actual_line, gutterName, $marker[0]);
        }
    };

    /*
     * Removes all Breakpoints
     */
    breakpointGutter.prototype.removeAllBreakpoints = function removeAllBreakpoints() {
        var that = this;
        _clearGutters(that);
        //And actually remove the breakpoints when the debugger is running
        _.each(prefs.get('breakpoints'), function (bp) {
            that._nodeDebuggerDomain.exec("removeBreakpoint", bp);
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
    breakpointGutter.prototype.setAllBreakpoints = function setAllBreakpoints() {
        var that = this;
        _.each(prefs.get('breakpoints'), function (bp) {
            that._nodeDebuggerDomain.exec("setBreakpoint", bp.fullPath, bp.line);
        });
        //NOTE: Reload all Breakpoints?
        //Request list of actual set breakpoints
        //_nodeDebuggerDomain.exec("getBreakpoints");
    };

    breakpointGutter.prototype.init = function init(nodeDebuggerDomain) {
        this._nodeDebuggerDomain = nodeDebuggerDomain;
        var that = this;
        _updateCm(this);
        _updateGutters(this);
        EditorManager.on("activeEditorChange", function () {
            _clearGutters(that);
            _updateCm(that);
            _updateGutters(that);
        });
    };
});
