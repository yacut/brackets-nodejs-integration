/*global define, $, brackets */
'use strict';

define(function (require, exports) {

    var command_manager = brackets.getModule('command/CommandManager');
    var commands = brackets.getModule('command/Commands');
    var file_utils = brackets.getModule('file/FileUtils');
    var preferences_manager = brackets.getModule('preferences/PreferencesManager');
    var prefs = preferences_manager.getExtensionPrefs('brackets-nodejs-integration');

    var global_prefs = preferences_manager.getExtensionPrefs('fonts');
    var _maxDepth = 3;
    var history = [];
    var historyCurrent = 0;
    var logContainerHTML = require('text!./assets/debuggerLog.html');
    var strings = require('strings');

    exports.create_new = function () {
        return new DebuggerPanel();
    };

    var DebuggerPanel = function () {
        this.panel = null;
        this.$logPanel = $(null);
        this.$debuggerContent = $(null);
        this.$debuggerSideBar = $(null);
        this.$debuggerInput = $(null);
        this._nodeDebuggerDomain = null;
    };

    /*
     * KeyHandler for the inputfield
     */
    function onKeyDown(e, that) {
        //On enter send command
        if (e.keyCode === 13) {
            //Remove all may existing suggestions
            that.$debuggerInput.find('.suggestion').remove();
            var com = that.$debuggerInput.val();

            if (com.length > 0) {
                history.push(com);
                historyCurrent = history.length;
                that.log($('<span>').text('>> ' + com));
                that._nodeDebuggerDomain.exec('eval', com);
                //reset the input field
                that.$debuggerInput.val('');
            }
        }
        //On key up/down scroll through history
        if (e.keyCode === 40) {
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
        if (e.keyCode === 38) {
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
        if ($t.hasClass('fa-caret-right')) {
            $t.removeClass('fa-caret-right').addClass('fa-caret-down');
            $t.siblings().removeClass('hidden');
        }
        else {
            if ($t.hasClass('fa-caret-down')) {
                $t.removeClass('fa-caret-down').addClass('fa-caret-right');
                $t.siblings().addClass('hidden');
            }
        }
    }

    /**
     * Initialize the panel
     *
     * @param {NodeDomain} nodeDebuggerDomain
     **/
    DebuggerPanel.prototype.init = function (nodeDebuggerDomain, domain_id) {
        //Create the BottomPanel
        this.panel = $('#' + domain_id).find('.brackets-nodejs-integration-debugger').html($(logContainerHTML)).show();
        this.$logPanel = $('#' + domain_id).find('.brackets-nodejs-integration-debugger-log-panel');
        _maxDepth = prefs.get('lookupDepth');
        this._nodeDebuggerDomain = nodeDebuggerDomain;

        //Find HTML
        this.$debuggerContent = this.$logPanel.find('.brackets-nodejs-integration-debugger-content');
        this.$debuggerCallbackStack = this.$logPanel.find('.brackets-nodejs-integration-debugger-callback-stack');
        this.$debuggerSideBar = this.$logPanel.find('.brackets-nodejs-integration-debugger-sidebar');
        this.$debuggerInput = this.$logPanel.find('.brackets-nodejs-integration-debugger-input');

        //Add keydown handler to input
        var that = this;
        this.$debuggerInput.on('keyup', function (e) {
            onKeyDown(e, that);
        });


        //Add help button
        var $help = $('<a>').html('<i class="fa fa-question-circle" aria-hidden="true"></i>')
            .attr('href', 'https://github.com/yacut/brackets-nodejs-integration#how-to-use-debugger')
            .attr('title', strings.DEBUGGER_HELP);
        this.addControlElement($help, false, function () {});

        //Add clear console button
        var $clear = $('<a>').attr('href', '#').attr('title', strings.DEBUGGER_CLEAR_CONSOLE).html('<i class="fa fa-trash" aria-hidden="true"></i>');

        this.addControlElement($clear, false, function () {
            that.$debuggerContent.html($('.brackets-nodejs-integration-debugger-input-wrapper'));
            //set the keyHandler again
            that.$debuggerInput.on('keydown', function (e) {
                onKeyDown(e, that);
            });
        });

        this._nodeDebuggerDomain.on('afterCompile', function (e, body) {
            if (body && body.script && body.script.name) {
                var $callback_file = $('<li>').text(body.script.name)
                    .attr('title', strings.CLICK_TO_OPEN)
                    .on('click', function () {
                        var path_to_file = $(this).text();
                        path_to_file = file_utils.convertWindowsPathToUnixPath(path_to_file);
                        command_manager.execute(commands.FILE_OPEN, {
                            fullPath: path_to_file
                        });
                    });
                $callback_file.prependTo(that.$debuggerCallbackStack);
            }
        });

        //add show console button
        var $show_console = $('<a>').attr('href', '#').attr('title', strings.DEBUGGER_CONSOLE).html('<i class="fa fa-terminal"></i>');
        this.addControlElement($show_console, false, function () {
            var $domain = $('#' + domain_id);
            var $callback_stack = $domain.find('.brackets-nodejs-integration-debugger-callback-stack');
            var $sidebar = $domain.find('.brackets-nodejs-integration-debugger-sidebar');
            var $content = $domain.find('.brackets-nodejs-integration-debugger-content');
            var $console_input = $domain.find('.brackets-nodejs-integration-debugger-input');
            if ($content.is(':visible')) {
                $sidebar.show();
                $callback_stack.hide();
                $console_input.hide();
                $content.hide();
            }
            else {
                $callback_stack.hide();
                $sidebar.hide();
                $content.show();
                $console_input.show().select();
                $(that).toggleClass('brackets-nodejs-integration-debugger-selected-button').find('i').toggleClass('fa-bold');
            }
        });

        //add show callback stack button
        var $callback_stack_link = $('<a>').attr('href', '#').attr('title', strings.DEBUGGER_SCRIPTS).html('<i class="fa fa-indent"></i>');
        this.addControlElement($callback_stack_link, false, function () {
            var $domain = $('#' + domain_id);
            var $callback_stack = $domain.find('.brackets-nodejs-integration-debugger-callback-stack');
            var $sidebar = $domain.find('.brackets-nodejs-integration-debugger-sidebar');
            var $content = $domain.find('.brackets-nodejs-integration-debugger-content');
            if ($callback_stack.is(':visible')) {
                $callback_stack.hide();
                $sidebar.show();
                $content.hide();
            }
            else {
                $callback_stack.show();
                $sidebar.hide();
                $content.hide();
            }
        });
    };

    /**
     *Adds a new line to the log within brackets
     **/
    DebuggerPanel.prototype.log = function ($msg) {
        var $h = $('<div>')
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
    DebuggerPanel.prototype.addControlElement = function ($el, top, clickHandler) {
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
    DebuggerPanel.prototype.createEvalHTML = function (body, depth, lookup, maxDepth) {
        var $html = $('<span>').css('display', 'block');
        var $inside = $('<span>');
        var object_name = '';
        var object_value = '';
        var that = this;
        depth++;
        var type_icon = '';
        var type_classes = 'type action_btn';
        var value_color = 'grey';
        //Exception for Date Object
        var $var_value = $(document.createElement('span'))
            .addClass('var-value')
            .css('font-size', global_prefs.get('fontSize'))
            .css('font-family', global_prefs.get('fontFamily'));

        if (body.type === 'object' && body.properties.length > 0 && (body.className !== 'Date')) {
            var eval_object = {};
            body.properties.forEach(function (p) {
                if (lookup[p.ref]) {
                    eval_object[p.name] = lookup[p.ref].text;
                    lookup[p.ref].varName = p.name;
                    if (depth <= maxDepth) { // Don't go too deep
                        that.createEvalHTML(lookup[p.ref], depth, lookup, maxDepth).addClass('var hidden').appendTo($html);
                    }
                    $inside.addClass('object fa fa-caret-right');
                }
            });
            if (body.className === 'Array') {
                type_icon = '<i class="fa fa-list-ol" aria-hidden="true"></i>';
            }
            else {
                type_icon = '<i class="fa fa-bars" aria-hidden="true"></i>';
            }
            $inside.append($var_value.text(body.text)).on('click', evalHTMLonClick);
            object_value = JSON.stringify(eval_object, null, 4);
        }
        else if (body.type === 'function') {
            var function_head = body.text.split('{')[0] || 'function()';
            $inside.append($var_value.text(function_head + '{'));
            object_value = body.text;
            type_classes += ' simple_var';
            type_icon = '<i class="fa fa-bars" aria-hidden="true"></i>';
        }
        else if (body.type === 'string') {
            $inside.append($var_value.text('"' + body.text + '"'));
            object_value = body.text;
            type_classes += ' simple_var';
            value_color = '#0083e8';
            type_icon = '<span class="fa-stack fa-1x" style="width: 1em;height: 1em;line-height: 1em;"><i class="fa fa-stop fa-stack-2x" style="font-size: 1em;"></i><strong class="fa-stack-1x text-primary" style="color: white;font-size: 70%;">ab</strong></span>';
        }
        else if (body.type === 'number') {
            $inside.append($var_value.text(body.text));
            object_value = body.text;
            type_classes += ' simple_var';
            value_color = 'green';
            type_icon = '<span class="fa-stack fa-1x" style="width: 1em;height: 1em;line-height: 1em;"><i class="fa fa-stop fa-stack-2x" style="font-size: 1em;"></i><strong class="fa-stack-1x text-primary" style="color: white;font-size: 60%;">01</strong></span>';
        }
        else {
            if (body.varName !== 'exports') {
                value_color = '#0083e8';
                $html.css('font-weight', 'bold');
            }
            $inside.append($var_value.text(body.text));
            object_value = body.text;
            type_classes += ' simple_var';
            type_icon = '<i class="fa fa-bars" aria-hidden="true"></i>';

        }

        $html.css('color', value_color);
        if (body.varName) {
            $('<span>')
                .addClass('var-name')
                .css('font-size', global_prefs.get('fontSize'))
                .css('font-family', global_prefs.get('fontFamily'))
                .text(body.varName + ' = ')
                .prependTo($inside);
            object_name = body.varName;
        }
        var $type = $('<span>').addClass(type_classes)
            .html(type_icon)
            .attr('href', '#').attr('title', strings.CLICK_TO_COPY_VALUE)
            .attr('object_value', object_value)
            .on('click', function () {
                copy_to_clipboard($(this).attr('object_value'));
            });

        $type.prependTo($inside);

        $inside.prependTo($html);
        return $html;
    };

    function copy_to_clipboard(text) {
        var textArea = document.createElement('textarea');
        textArea.style.position = 'fixed';
        textArea.style.top = 0;
        textArea.style.left = 0;
        textArea.style.width = '2em';
        textArea.style.height = '2em';
        textArea.style.padding = 0;
        textArea.style.border = 'none';
        textArea.style.outline = 'none';
        textArea.style.boxShadow = 'none';
        textArea.style.background = 'transparent';
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
        }
        catch (err) {
            console.error(err);
        }
        document.body.removeChild(textArea);
    }
});
