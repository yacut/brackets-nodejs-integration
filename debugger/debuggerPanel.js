/*global define, $, brackets */
define(function (require, exports) {
    "use strict";

    var PanelManager = brackets.getModule("view/PanelManager"),
        PreferencesManager = brackets.getModule("preferences/PreferencesManager"),
        prefs = PreferencesManager.getExtensionPrefs("brackets-nodejs-integration");

    var _nodeDebuggerDomain,
        _maxDepth = 3,
        history = [],
        historyCurrent = 0,
        logContainerHTML = require("text!./assets/debuggerLog.html");

    exports.create_new = function () {
        return new debuggerPanel();
    };

    var debuggerPanel = function () {
        this.panel = null;
        this.$logPanel = $(null);
        this.$debuggerContent = $(null);
        this.$debuggerSideBar = $(null);
        this.$debuggerInput = $(null);
    };

    /*
     * KeyHandler for the inputfield
     */
    function onKeyDown(e, that) {
        //On enter send command
        if (e.keyCode == 13) {
            //Remove all may existing suggestions
            that.$debuggerInput.find('.suggestion').remove();
            var com = that.$debuggerInput.val();

            if (com.length > 0) {
                history.push(com);
                historyCurrent = history.length;
                that.log($('<span>').text('>> ' + com));
                _nodeDebuggerDomain.exec('eval', com);
                //reset the input field
                that.$debuggerInput.val('');
            }
        }
        //On key up/down scroll through history
        if (e.keyCode == 40) {
            historyCurrent++;
            if (history[historyCurrent]) {
                that.$debuggerInput.val(history[historyCurrent]);
            }
            else {
                historyCurrent = history.length;
                that.$debuggerInput.val('');
            }
            //e.preventDefault();
        }
        if (e.keyCode == 38) {
            historyCurrent--;
            if (history[historyCurrent]) {
                that.$debuggerInput.val(history[historyCurrent]);
            }
            else {
                historyCurrent = 0;
            }
            e.preventDefault();
        }
    }

    /*
     * click event handler to give more Information about an object in the console
     */
    function evalHTMLonClick(e) {
        var $t = $(e.target);
        if ($t.hasClass('ion-arrow-right-b')) {
            $t.removeClass('ion-arrow-right-b').addClass('ion-arrow-down-b');
            $t.siblings().removeClass('hidden');
        }
        else {
            if ($t.hasClass('ion-arrow-down-b')) {
                $t.removeClass('ion-arrow-down-b').addClass('ion-arrow-right-b');
                $t.siblings().addClass('hidden');
            }
        }
    }

    /**
     * Initialize the panel
     *
     * @param {NodeDomain} nodeDebuggerDomain
     **/
    debuggerPanel.prototype.init = function (nodeDebuggerDomain, domain_id) {
        //Create the BottomPanel
        this.panel = $('#' + domain_id).find('.brackets-nodejs-integration-debugger').html($(logContainerHTML)).show(); //PanelManager.createBottomPanel("brackets-node-debugger.log", $(logContainerHTML));
        this.$logPanel = $('#' + domain_id).find('.brackets-nodejs-integration-debugger-log-panel'); //debuggerPanel.panel.$panel;
        _maxDepth = prefs.get("lookupDepth");
        _nodeDebuggerDomain = nodeDebuggerDomain;

        //Find HTML
        this.$debuggerContent = this.$logPanel.find('.brackets-nodejs-integration-debugger-content');
        this.$debuggerSideBar = this.$logPanel.find('.brackets-nodejs-integration-debugger-sidebar');
        this.$debuggerInput = this.$logPanel.find('.brackets-nodejs-integration-debugger-input');

        //Add keydown handler to input
        var that = this;
        this.$debuggerInput.on('keyup', function (e) {
            onKeyDown(e, that);
        });

        //add show console button
        var $show_console = $('<a>').attr('href', '#').attr('title', 'Console').html('<i class="fa fa-terminal"></i>');
        this.addControlElement($show_console, false, function () {
            $('#' + domain_id).find('.brackets-nodejs-integration-debugger-sidebar').toggle();
            $('#' + domain_id).find('.brackets-nodejs-integration-debugger-content').toggle();
            $('#' + domain_id).find('.brackets-nodejs-integration-debugger-input').select();
            $(that).toggleClass('brackets-nodejs-integration-debugger-selected-button').find('i').toggleClass('fa-bold');
        });

        //Add clear console button
        var $clear = $('<a>').attr('href', '#').attr('title', 'Clear console').html('<i class="fa fa-trash" aria-hidden="true"></i>');

        this.addControlElement($clear, false, function () {
            that.$debuggerContent.html($('.brackets-nodejs-integration-debugger-input-wrapper'));
            //set the keyHandler again
            that.$debuggerInput.on('keydown', function (e) {
                onKeyDown(e, that);
            });
        });


        //Add help button
        var $help = $('<a>').html('<i class="fa fa-question-circle" aria-hidden="true"></i>')
            .attr('href', 'https://github.com/yacut/brackets-nodejs-integration#how-to-use-debugger')
            .attr('title', 'Help!');
        this.addControlElement($help, false, function () {});

    };

    /**
     *Adds a new line to the log within brackets
     **/
    debuggerPanel.prototype.log = function ($msg) {
        var $h = $("<div>")
            .addClass('brackets-nodejs-integration-debugger-log');

        $h.append($msg);
        $h.insertBefore($('.brackets-nodejs-integration-debugger-input-wrapper'));
        this.$debuggerInput.focus();
        //Scroll to the bottom
        this.$debuggerContent.scrollTop(9999999999999);
    };

    /**
     * Adds a new element to the debugger panel
     *
     * @param {jQuery Element} The jQuery element that will be added to the panel
     * @param {boolean} If true element will be in the top row, false: bottom row
     * @param {function} clickHandler
     **/
    debuggerPanel.prototype.addControlElement = function ($el, top, clickHandler) {
        var $t = $(null);
        if (top) {
            $t = this.$logPanel.find('.toolbar.top');
        }
        else {
            $t = this.$logPanel.find('.toolbar.bottom');
        }

        $el.prependTo($t).on('click', clickHandler);
    };

    /**
     * Creates the HTML from the eval response
     * @param {object} body The object we get from the debugger
     * @param {number} depth How deep are we going? (Just in case we've got circle stuff)
     * @param {object} Initally the body.lookup propertie
     * @return {jquery object} A jquery HTML object you can inject into the console
     **/
    debuggerPanel.prototype.createEvalHTML = function (body, depth, lookup) {
        var $html = $('<span>');
        var $inside = $('<span>');

        var that = this;
        depth++;
        //Exception for Date Object
        if (body.type === 'object' && body.properties.length > 0 && (body.className !== 'Date')) {
            var o = {};
            body.properties.forEach(function (p) {
                if (lookup[p.ref]) {
                    o[p.name] = lookup[p.ref].text;
                    lookup[p.ref].varName = p.name;
                    that.createEvalHTML(lookup[p.ref], depth, lookup).addClass('var hidden').appendTo($html);
                    $inside.addClass('object ion-arrow-right-b');
                }
            });
            $inside.text('...').on('click', evalHTMLonClick); //JSON.stringify(o) to copy object
        }
        else if (body.type === 'function') {
            $inside.text('<native code>');
        }
        else {
            $inside.text(body.text);
        }

        if (body.varName) {
            $('<span>').addClass('var-name').text(body.varName + ': ').prependTo($inside);
        }

        $('<span>').addClass('type').text('[' + body.type + '] ').prependTo($inside);
        $inside.prependTo($html);
        return $html;
    };
});
