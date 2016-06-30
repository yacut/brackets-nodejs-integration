/*global define, $, brackets */

'use strict';
define(function (require, exports) {

    var preferences_manager = brackets.getModule('preferences/PreferencesManager');
    var prefs = preferences_manager.getExtensionPrefs('brackets-nodejs-integration');
    var global_prefs = preferences_manager.getExtensionPrefs('fonts');

    exports.create_new = function () {
        return new Locals();
    };
    var Locals = function () {
        this.locals = {};
        this.lookup = null;
        this.$locals = $(null);
        this._allLocals = [];
        this._nodeDebuggerDomain = null;
    };

    var displayLocals = function (that) {
        that.$locals.find('.locals-wrapper').remove();
        var $wrapper = $('<div>').addClass('locals-wrapper');
        that._allLocals.forEach(function (l) {
            //$('<div>').text(l + ': ' + locals[l]).appendTo($wrapper);
            //Check if we actually got all Information
            if (that.locals[l]) {
                var $a = $('<div>').addClass('brackets-nodejs-integration-debugger-log')
                    .css('font-size', global_prefs.get('fontSize'));
                //Add the varName again
                that.locals[l].varName = l;
                that.nodeDebuggerPanel.createEvalHTML(that.locals[l], 0, that.lookup, prefs.get('lookupDepth')).appendTo($a);
                $a.appendTo($wrapper);
            }
        });

        //append
        $wrapper.appendTo(that.$locals);
    };


    /**
     * Initialise the locals module
     **/
    Locals.prototype.init = function (nodeDebuggerDomain, nodeDebuggerPanel, domain_id) {
        this._nodeDebuggerDomain = nodeDebuggerDomain;
        this.nodeDebuggerPanel = nodeDebuggerPanel;

        var that = this;
        this._nodeDebuggerDomain.on('frame', function (e, body) {

            //reset stuff
            that.locals = {};
            that._allLocals = [];

            that.lookup = body.lookup;
            //Get all arguments
            if (body.arguments && body.arguments.length > 0) {
                body.arguments.forEach(function (a) {
                    if (that._allLocals.indexOf(a.name) === -1) {
                        that._allLocals.push(a.name);
                        //and get the value
                        that.locals[a.name] = that.lookup[a.value.ref];
                    }
                });
            }
            //Get all locals
            if (body.locals && body.locals.length > 0) {
                body.locals.forEach(function (l) {
                    if (that._allLocals.indexOf(l.name) === -1) {
                        that._allLocals.push(l.name);
                        that.locals[l.name] = that.lookup[l.value.ref];
                    }
                });
            }

            //And display the stuff in the panel
            displayLocals(that);
        });

        //Get the frame on break
        that._nodeDebuggerDomain.on('break', function () {
            that._nodeDebuggerDomain.exec('getFrame');
        });

        //Add suggestions
        that.nodeDebuggerPanel.$debuggerInput.on('keyup', function (e) {
            if (e.keyCode === 39) {
                var $s = that.nodeDebuggerPanel.$debuggerInput.find('.suggestion');
                var s = $s.text();
                $s.remove();

                var h = that.nodeDebuggerPanel.$debuggerInput.text();
                that.nodeDebuggerPanel.$debuggerInput.html(h + s);
                return;
            }
            //Remove old suggestion
            that.nodeDebuggerPanel.$debuggerInput.find('.suggestion').remove();
            var a = that.nodeDebuggerPanel.$debuggerInput.html();
            if (a.length > 0) {
                //See if we have something that begins with that
                that._allLocals.some(function (l) {
                    if (l.indexOf(a) === '0' && l.length > a.length) {
                        var $sug = $('<span>').addClass('suggestion').text(l.substr(a.length));
                        that.nodeDebuggerPanel.$debuggerInput.append($sug);
                        return true;
                    }
                    return false;
                });
            }
        });

        //Add a tab into the sidebox
        that.$locals = $('<div>').addClass('locals');
        that.$locals.prependTo($('#' + domain_id).find('.brackets-nodejs-integration-debugger-sidebar'));
    };
});
