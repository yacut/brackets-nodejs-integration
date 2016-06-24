/*global brackets,$*/

'use strict';
define(function main(require, exports, module) {

    var NodeDomain = brackets.getModule('utils/NodeDomain');
    var _ = brackets.getModule('thirdparty/lodash');
    var command_manager = brackets.getModule('command/CommandManager');
    var commands = brackets.getModule('command/Commands');
    var editor_manager = brackets.getModule('editor/EditorManager');
    var extension_utils = brackets.getModule('utils/ExtensionUtils');
    var domain_template_path = extension_utils.getModulePath(module, 'domains/process_domain.js');
    var file_system = brackets.getModule('filesystem/FileSystem');
    var file_utils = brackets.getModule('file/FileUtils');
    var find_in_files = brackets.getModule('search/FindInFiles');
    var preferences_manager = brackets.getModule('preferences/PreferencesManager');
    var project_manager = brackets.getModule('project/ProjectManager');

    var ansi = require('./ansi');
    var global_prefs = preferences_manager.getExtensionPrefs('fonts');
    var prefs = require('../preferences');
    var strings = require('strings');
    var utils = require('../utils');
    var QueueManager = require('./queue_manager');

    exports.create_new_process = function (id, run_configurations, debug_port) {
        return new Process(id, run_configurations, debug_port);
    };

    var Process = function Process(id, run_configurations, debug_port) {
        var that = this;
        this.id = id;
        prefs = prefs;
        this.$panel = $('#' + id);
        this.command = '';
        this.cwd = '';
        this.actual_test_title = null;
        this.all_tests_results = this.$panel.find('.all-tests-results');
        this.console_output = this.$panel.find('.brackets-nodejs-integration-console');
        this.finished_tests_count = 0;
        this.mocha_stats = null;
        this.total_tests = 0;
        this.mocha_summary = this.$panel.find('.mocha-summary');
        this.mocha_treeview = this.$panel.find('.mocha-treeview');
        this.mocha_treeview_toggle = this.$panel.find('.mocha-treeview-toggle');
        this.run_configurations = run_configurations;
        this.test_list = this.$panel.find('.test-list');
        this.test_tree = [];
        this.scroll_enabled = prefs.get('autoscroll');
        this.debug_port = debug_port;
        var file_path = extension_utils.getModulePath(module, 'domains/' + id); //+ '.js'
        this.file_path = file_path;
        var file = file_system.getFileForPath(domain_template_path);
        file.read(function (error, content) {
            if (error) {
                return console.error(error);
            }
            create_new_domain(that, id, file_path, content);
        });
        this.all_tests_results_label = this.$panel.find('#all_tests_results_label')
            .on('click', function () {
                $('#' + id).find('.console-element').show();
            });

        this.process_finished = false;
        this.process_stopped = false;
        this.queue = new QueueManager({
            delay: 0
        });
        this.queue.each(function (data) {
            if (that.process_stopped) {
                return;
            }
            var mocha_events = data.match(/###mocha_event_start###(.*)###mocha_event_end###/gm);
            if (mocha_events) {
                mocha_events.forEach(function (mocha_event) {
                    mocha_event = mocha_event.replace('###mocha_event_start###', '').replace('###mocha_event_end###', '');
                    var output_json = JSON.parse(mocha_event);
                    var event_type = output_json[0];
                    var event_model = output_json[1];
                    if (!event_model) {
                        return;
                    }
                    if (event_model.fullTitle) {
                        that.actual_test_title = event_model.fullTitle;
                    }
                    switch (event_type) {
                        case 'start':
                            clear(that);
                            that.write(that, that.command + that.cwd);
                            that.mocha_stats = event_model;
                            that.total_tests = event_model.tests;
                            that.mocha_summary.html(get_mocha_summary(that));
                            break;
                        case 'start_suite':
                            if (event_model.title) {
                                that.add_to_test_list(utils.uuid(), event_model, 'start_suite');
                            }
                            break;
                        case 'start_test':
                            that.add_to_test_list(utils.uuid(), event_model, 'start_test');
                            break;
                        case 'pass_test':
                            that.finished_tests_count++;
                            that.mocha_summary.html(get_mocha_summary(that));
                            that.finalize_test(event_model, 'pass_test');
                            break;
                        case 'fail_test':
                            that.finished_tests_count++;
                            that.mocha_summary.html(get_mocha_summary(that));
                            that.finalize_test(event_model, 'fail_test', event_model);
                            that.write(that, event_model.stack, {
                                actual: event_model.actual ? JSON.stringify(event_model.actual, null, 2) : null,
                                expected: event_model.expected ? JSON.stringify(event_model.expected, null, 2) : null
                            });
                            break;
                        case 'pending_test':
                            that.finished_tests_count++;
                            that.mocha_summary.html(get_mocha_summary(that));
                            that.finalize_test(event_model, 'pending_test');
                            break;
                        case 'end_suite':
                            that.finalize_test(event_model, 'end_suite');
                            break;
                        case 'end':
                            that.mocha_stats = event_model;
                            that.mocha_summary.html(get_mocha_summary(that));
                            if (!that.mocha_summary.is(':visible')) {
                                utils.show_popup_message(that.mocha_summary.text());
                            }
                            that.finished_tests_count = 0;
                            break;
                        default:
                            console.error('Not suported event model.' + output_json);
                            break;
                    }
                });
            }
            else {
                _.each(data.split(/\r?\n/), function (output_string) {
                    if (output_string) {
                        that.write(that, output_string + '\n');
                    }
                });
            }

        });
        this.queue.complete(function () {
            if (!that.process_finished) {
                return;
            }

            _.forEach(that.test_tree, function (item) {
                if (item.running) {
                    that.finalize_test(item.event_model, 'pending_test');
                }
            });
            that.set_controls_by_status(false);
        });
    };

    function create_new_domain(that, id, file_path, content) {
        var file = file_system.getFileForPath(file_path);
        var dir = file_utils.getDirectoryPath(file.fullPath);
        utils.mkdirp(dir)
            .then(function () {
                return utils.create_file(file, content);
            })
            .then(function () {
                return new_domain(that, id, file_path);
            });
    }

    function new_domain(that, id, path) {
        that.process_domain = new NodeDomain(id, path);
        that.process_domain.on('console_output', function (info, data) {
            if (that.id !== info.target._domainPath.replace(/^.*[\\\/]/, '')) {
                return;
            }
            that.queue.add(data);
        });
    }

    function new_connection(that, command, cwd) {
        var working_directory;
        if (cwd) {
            working_directory = cwd;
        }
        else {
            working_directory = project_manager.getProjectRoot().fullPath;
        }
        clear(that);
        that.command = '<strong>Command: ' + command + '</strong>\n';
        if (cwd) {
            that.cwd = '<strong>Working directory: ' + cwd + '</strong>\n';
        }
        that.queue.add(that.command + that.cwd);
        that.queue.add('\n');

        that.process_domain.exec('start_process', command, working_directory)
            .done(function (error) {
                if (error && error.code && error.stderr) {
                    that.queue.add(error.stderr);
                }
                that.queue.add('\nProgram exited with code ' + (error ? error.code : '0'));
                that.process_finished = true;
            })
            .fail(function (err) {
                that.queue.add('\nError occured: \n' + err);
                that.process_finished = true;
            });
        that.last_command = command;
        that.last_cwd = working_directory;
    }

    Process.prototype.get_last_command = function () {
        return this.last_command;
    };

    Process.prototype.get_last_cwd = function () {
        return this.last_cwd;
    };

    Process.prototype.run = function () {
        this.process_domain.exec('stop_process');
        var run_configuration = this.get_selected_configuration();
        if (!run_configuration) {
            return;
        }
        var script = this.get_selected_script_name();
        this.set_indicators(run_configuration);
        this.set_controls_by_status(true);
        this.process_finished = false;
        this.process_stopped = false;
        try {
            execute_command(this, run_configuration.type, run_configuration.target, run_configuration.cwd, null, run_configuration.flags, script);
        }
        catch (err) {
            this.set_controls_by_status(false);
            this.process_finished = true;
            throw err;
        }
    };

    Process.prototype.debug = function () {
        this.process_domain.exec('stop_process');
        var run_configuration = this.get_selected_configuration();
        if (!run_configuration) {
            return;
        }
        var script = this.get_selected_script_name();
        this.set_indicators(run_configuration);
        this.set_controls_by_status(true);
        this.process_finished = false;
        this.process_stopped = false;
        try {
            execute_command(this, run_configuration.type, run_configuration.target, run_configuration.cwd, this.debug_port, run_configuration.flags, script);
        }
        catch (err) {
            this.set_controls_by_status(false);
            this.process_finished = true;
            throw err;
        }
    };

    Process.prototype.exit = function () {
        exit(this);
    };

    function exit(that) {
        that.process_domain.exec('stop_process');
        var file = file_system.getFileForPath(that.file_path);
        file.unlink(function () {});
        clear(that);
    }

    Process.prototype.stop = function () {
        stop(this);
    };

    function stop(that) {
        that.process_finished = true;
        that.process_stopped = true;
        that.queue.clear();
        that.set_controls_by_status(false);
        that.process_domain.exec('stop_process');
    }

    function execute_command(that, command_type, command_target, command_cwd, debug_port, flags, script) {
        var command;
        var v8flags = prefs.get('v8-flags');
        var additional_flags = _.union((prefs.get('additional-flags') || '').split(' '), (flags || '').split(' ')).join(' ');
        var node_bin = prefs.get('node-bin') ? prefs.get('node-bin') : 'node';
        var npm_bin = prefs.get('npm-bin') ? prefs.get('npm-bin') : 'npm';
        var gulp_bin = prefs.get('gulp-bin') ? prefs.get('gulp-bin') : 'gulp';
        var mocha_bin = prefs.get('mocha-bin') ? prefs.get('mocha-bin') : 'mocha';
        var mocha_reporter_path = extension_utils.getModulePath(module) + 'reporter/mocha_json_stream.js';
        var mocha_default_flags = ' --reporter "' + mocha_reporter_path + '" ';
        command_target = ' "' + command_target + '" ';
        v8flags = v8flags.replace(/--debug(-brk)?=?(\d+)?/g, '');
        if (debug_port) {
            v8flags += ' --debug-brk=' + debug_port + ' ';
        }
        switch (command_type) {
            case 'node':
                command = node_bin + ' ' + v8flags + ' ' + additional_flags;
                break;
            case 'mocha':
                command = mocha_bin === 'mocha' ?
                    mocha_bin + mocha_default_flags + ' ' + additional_flags + ' ' + v8flags :
                    node_bin + ' ' + v8flags + ' ' + mocha_bin + mocha_default_flags + ' ' + additional_flags;
                break;
            case 'npm':
                if (script) {
                    if (['install', 'start', 'stop', 'restart', 'test'].indexOf(script) === -1) {
                        script = 'run "' + script + '"';
                    }
                }
                command = npm_bin + ' ' + script + ' ' + v8flags + ' ' + additional_flags;
                command_target = '';
                break;
            case 'gulp':
                command = gulp_bin + ' ' + script + ' --color ' + v8flags + ' ' + additional_flags;
                command_target = '';
                break;
            default:
                return;
        }
        new_connection(that, command + command_target, command_cwd);
    }

    function get_mocha_summary(that) {
        var status_string = '';

        if (that.mocha_stats.passes) {
            status_string += '  <i class="fa fa-check-circle" aria-hidden="true"></i> ' + that.mocha_stats.passes + ' passed';
        }
        if (that.mocha_stats.pending) {
            status_string += '  <i class="fa fa-exclamation-triangle" aria-hidden="true"></i> ' + that.mocha_stats.pending + ' ignored';
        }
        if (that.mocha_stats.failures) {
            status_string += '  <i class="fa fa-times-circle" aria-hidden="true"></i> ' + that.mocha_stats.failures + ' failed';
        }
        if (that.mocha_stats.duration) {
            status_string += ' - <i class="fa fa-clock-o" aria-hidden="true"></i> ' + that.mocha_stats.duration + 'ms  -  ';
        }
        status_string += that.finished_tests_count + ' of ' + that.total_tests + ' tests';

        return status_string;
    }

    Process.prototype.set_indicators = function (run_configuration) {
        if (run_configuration) {
            this.$panel.find('.brackets-nodejs-integration-debugger').hide();
            this.$panel.find('.brackets-nodejs-integration-debugger-toggle').hide();
            if (run_configuration.type !== 'mocha') {
                this.mocha_treeview.hide();
                this.mocha_treeview_toggle.hide();
            }
            else {
                this.mocha_treeview.show();
                this.mocha_treeview_toggle
                    .html('<i class="fa fa-angle-double-left" aria-hidden="true" style="top: 50%; position: absolute;"></i>')
                    .show();

                if (!this.mocha_treeview.css('width')) {
                    this.mocha_treeview.css('width', '250px');
                }
            }

            var active_tab = $('li.nodejs-integration-tab.active');
            active_tab.find('p').html(run_configuration.name);
            active_tab.find('div').attr('class', 'nodejs-integration-tab-indicator ' + run_configuration.type);
        }
    };

    Process.prototype.set_controls_by_status = function (process_running) {
        if (process_running) {
            this.$panel.find('.run-configuration-dropdown-toggle').prop('disabled', true);
            this.$panel.find('.script-selector').prop('disabled', true);
            this.$panel.find('.run_btn').prop('disabled', true);
            this.$panel.find('.debug_btn').prop('disabled', true);
            this.$panel.find('.stop_btn').prop('disabled', false);
        }
        else {
            this.$panel.find('.run-configuration-dropdown-toggle').prop('disabled', false);
            this.$panel.find('.script-selector').prop('disabled', false);
            this.$panel.find('.run_btn').prop('disabled', false);
            if (this.get_selected_configuration().type !== 'npm' && this.get_selected_configuration().type !== 'gulp') {
                this.$panel.find('.debug_btn').prop('disabled', false);
            }
            this.$panel.find('.stop_btn').prop('disabled', true);
            this.finished_tests_count = 0;
        }
    };

    Process.prototype.get_selected_configuration = function () {
        var selected_run_configuration = this.$panel.find('.run-configuration-dropdown-toggle');
        return {
            name: selected_run_configuration.attr('name'),
            target: selected_run_configuration.attr('target'),
            cwd: selected_run_configuration.attr('cwd'),
            flags: selected_run_configuration.attr('flags'),
            type: selected_run_configuration.attr('type')
        };
    };

    Process.prototype.get_selected_script_name = function () {
        return this.$panel.find('.script-selector').val();
    };

    Process.prototype.clear = function () {
        clear(this);
    };

    function clear(that) {
        that.console_output.empty();
        that.mocha_summary.empty();
        that.test_list.empty();
        that.test_tree = [];
    }
    Process.prototype.write = function (that, output_string, diff) {
        write(that, output_string, diff);
    };

    function write(that, output_string, diff) {
        //get links to files
        var links = output_string.match(/\((.*?)([^/\\]*?)(\.[^/\\.]*)?:[0-9]+:[0-9]+\)/gi);
        if (links) {
            links.forEach(function (link) {
                link = link.replace(/[()]/g, '');
                output_string = output_string.replace(link, '<a href=\'#\' class=\'link_to_source\'>' + link + '</a>');
            });
        }
        that.console_output.append($(document.createElement('div'))
            .addClass('console-element')
            .attr('test_title', that.actual_test_title)
            .html(ansi(output_string))
            .css('font-size', global_prefs.get('fontSize'))
            .css('font-family', global_prefs.get('fontFamily')));

        if (diff && diff.actual && diff.expected) {
            that.console_output.append($(document.createElement('a'))
                .addClass('link_to_diff console-element')
                .attr({
                    'actual': diff.actual,
                    'expected': diff.expected
                })
                .attr('test_title', that.actual_test_title)
                .html('>>> ' + strings.SHOW_DIFFERENCE + ' <<<<br><br>')
                .css('font-size', global_prefs.get('fontSize'))
                .css('font-family', global_prefs.get('fontFamily')));
        }
        if (that.scroll_enabled) {
            that.console_output.parent().scrollTop(that.console_output.parent().prop('scrollHeight'));
            that.mocha_treeview.scrollTop(that.mocha_treeview.prop('scrollHeight'));
        }
    }

    Process.prototype.finalize_test = function (event_model, class_name) {
        var tree_element = _.find(this.test_tree, function (item) {
            return item.title === event_model.fullTitle && item.running;
        });
        if (!tree_element) {
            this.add_to_test_list(utils.uuid(), event_model, class_name);
            return;
        }
        var element_id = tree_element.event_id;
        if (!element_id) {
            return;
        }
        if (class_name === 'end_suite') {
            var test_describe = this.$panel.find('#' + element_id);
            if (test_describe) {
                var test_describe_labels = test_describe.find('label');
                if (test_describe_labels.length > 0) {
                    var some_test_fail = _.some(test_describe_labels, 'className', 'start_test fail_test');
                    var some_before_or_after_fail = _.some(test_describe_labels, 'className', 'fail_test');
                    var some_test_pending = _.some(test_describe_labels, 'className', 'pending_test');
                    if (some_test_fail || some_before_or_after_fail) {
                        class_name = 'fail_test';
                    }
                    else if (some_test_pending) {
                        class_name = 'pending_test';
                    }
                    else {
                        class_name = 'pass_test';
                    }
                }
            }
        }
        var label = this.test_list.find('label[for=\'' + element_id + '\']');
        if (label) {
            label.addClass(class_name);
        }
        this.test_tree = _.map(this.test_tree, function (item) {
            if (item.event_id === element_id) {
                delete item.running;
            }
            return item;
        });
    };


    Process.prototype.add_to_test_list = function (event_id, event_model, class_name) {
        var li = $(document.createElement('li'));
        var checkbox = $(document.createElement('input'))
            .attr({
                type: 'checkbox',
                checked: true
            });
        li.append(checkbox);

        var that = this;
        var label = $(document.createElement('label'))
            .addClass(class_name)
            .attr({
                'for': event_id
            })
            .html(event_model.title)
            .on('click', function () {
                var selected_title = this.innerHTML;
                var console_elements = that.$panel.find('.console-element');
                _.map(console_elements, function (console_element) {
                    var test_title = console_element.getAttribute('test_title');
                    if (test_title) {
                        console_element.style.display = test_title.indexOf(selected_title) === -1 ? 'none' : 'block';
                    }
                    else {
                        console_element.style.display = 'none';
                    }
                });
            })
            .on('dblclick', function () {
                find_in_files.doSearchInScope({
                        query: this.innerHTML,
                        caseSensitive: false,
                        isRegexp: false
                    }, null, null, null, null)
                    .done(function (results) {
                        var found_files = _.keys(results);
                        if (found_files.length > 0) {
                            var first_filename = found_files[0];
                            var first_result = results[first_filename];
                            var current_editor = editor_manager.getCurrentFullEditor();
                            if (current_editor.document.file._path === first_filename) {
                                move_cursor_to_test_case(first_result);
                            }
                            command_manager.execute(commands.FILE_OPEN, {
                                    fullPath: first_filename
                                })
                                .done(function () {
                                    move_cursor_to_test_case(first_result);
                                });
                        }
                    });
            });
        li.append(label);

        var ul = $(document.createElement('ul'))
            .attr({
                id: event_id
            });
        li.append(ul);

        this.test_tree.push({
            title: event_model.fullTitle,
            event_model: event_model,
            event_id: event_id,
            running: true
        });

        if (event_model.title === event_model.fullTitle) {
            this.test_list.append(li);
        }
        else {
            var parent_title = _.trimRight(event_model.fullTitle.replace(' ' + event_model.title, ''));
            var parent_tree_element = _.find(this.test_tree, function (item) {
                return item.title === parent_title && item.running;
            });
            if (!parent_tree_element) {
                return console.error('Mocha test runner: Parent tree element not found');
            }
            var parent_id = parent_tree_element.event_id;
            if (!parent_id) {
                return console.error('Mocha test runner: Parent id not found');
            }
            var parent = this.$panel.find('#' + parent_id);
            if (parent) {
                parent.append(li);
            }
        }
    };

    function move_cursor_to_test_case(result) {
        if (result.matches && result.matches.length > 0) {
            var position = result.matches[0].start;
            editor_manager.getCurrentFullEditor().setCursorPos({
                line: position.line ? position.line : 0,
                ch: position.ch ? position.ch : 0
            });
        }
    }

});
