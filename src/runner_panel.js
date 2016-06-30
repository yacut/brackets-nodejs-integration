/*global brackets,$*/

'use strict';
define(function main(require, exports, module) {

    var _ = brackets.getModule('thirdparty/lodash');
    var command_manager = brackets.getModule('command/CommandManager');
    var commands = brackets.getModule('command/Commands');
    var editor_manager = brackets.getModule('editor/EditorManager');
    var extension_utils = brackets.getModule('utils/ExtensionUtils');
    var file_system = brackets.getModule('filesystem/FileSystem');
    var file_utils = brackets.getModule('file/FileUtils');
    var main_view_manager = brackets.getModule('view/MainViewManager');
    var menus = brackets.getModule('command/Menus');
    var mustache = brackets.getModule('thirdparty/mustache/mustache');
    var pop_up_manager = brackets.getModule('widgets/PopUpManager');
    var project_manager = brackets.getModule('project/ProjectManager');
    var preferences_manager = brackets.getModule('preferences/PreferencesManager');
    var theme_manager = brackets.getModule('view/ThemeManager');
    var workspace_manager = brackets.getModule('view/WorkspaceManager');

    var code_mirror = require('../thirdparty/codemirror');
    require('../thirdparty/merge');
    var global_prefs = preferences_manager.getExtensionPrefs('fonts');
    var panel_template = require('text!../templates/panel.html');
    var prefs = require('../preferences');
    var run_configurations = prefs.get('configurations');
    var runner = require('./runner');
    var runner_panel_template = require('text!../templates/runner_panel.html');
    var settings_dialog = require('./settings_dialog');
    var strings = require('strings');
    var runner_menu_template = require('text!../templates/runner_menu.html');
    var utils = require('../utils');

    var $dropdown = null;
    var $runner_panel = $(null);
    var panel = null;
    var runner_panel = null;
    var runners = [];
    var $node_runner_indicator = $('#brackets-nodejs-integration-runner-indicator');

    panel = {
        id: 'brackets-nodejs-integration-panel',
        html_object: null,
        height: 201,
        mocha_summary: null,
        test_list: null,
        mocha_treeview: null,
        finished_tests_count: 0,
        mocha_stats: null,
        test_tree: [],
        console_output: $('.brackets-nodejs-integration-console'),
        actual_test_title: null,
        get: function (qs) {
            return this.html_object.querySelector(qs);
        },
        show: function (disallow_create_new_tab) {
            this.html_object.show();
            $node_runner_indicator.addClass('active');
            workspace_manager.recomputeLayout();
            if (!disallow_create_new_tab) {
                var new_tab_created = create_new_tab_if_config_is_set_and_panel_empty();
                change_runner_if_config_set_and_new_tab_created(new_tab_created);
            }
        },
        show_or_hide: function () {
            this.html_object.toggle();
            $node_runner_indicator.toggleClass('inactive');
            workspace_manager.recomputeLayout();
            if (this.html_object.is(':visible')) {
                var new_tab_created = create_new_tab_if_config_is_set_and_panel_empty();
                change_runner_if_config_set_and_new_tab_created(new_tab_created);
            }
        },
        hide: function () {
            this.html_object.hide();
            $node_runner_indicator.addClass('inactive');
            workspace_manager.recomputeLayout();
        },
        mousemove: function (e) {
            var h = panel.height + (panel.y - e.pageY);
            if (panel.html_object && panel.html_object.style) {
                panel.html_object.style.height = h + 'px';
                workspace_manager.recomputeLayout();
            }
        },
        mouseup: function (e) {
            document.removeEventListener('mousemove', panel.mousemove);
            document.removeEventListener('mouseup', panel.mouseup);
            panel.height = panel.height + (panel.y - e.pageY);
        },
        y: 0
    };

    var panel_template_html = mustache.render(panel_template, strings);
    runner_panel = workspace_manager.createBottomPanel(panel.id, $(panel_template_html));
    $runner_panel = runner_panel.$panel;

    panel.html_object = $('#' + panel.id);
    panel.mocha_summary = $runner_panel.find('.mocha-summary');
    panel.test_list = $runner_panel.find('.test-list');
    panel.mocha_treeview = $runner_panel.find('.mocha-treeview');
    panel.all_tests_results = $runner_panel.find('.all-tests-results')
        .on('click', function () {
            var console_elements = $runner_panel.find('.console-element');
            _.map(console_elements, function (console_element) {
                console_element.style.display = 'block';
            });
        });

    $runner_panel.on('click', '.mocha-treeview-toggle', function () {
        var mocha_treeview = $(this).parent().find('.mocha-treeview');
        if (mocha_treeview.is(':visible')) {
            $(this).html('<i class="fa fa-angle-double-right" aria-hidden="true" style="top: 50%; position: absolute;"></i>');
        }
        else {
            $(this).html('<i class="fa fa-angle-double-left" aria-hidden="true" style="top: 50%; position: absolute;"></i>');
        }
        mocha_treeview.toggle();
    });

    $runner_panel.on('click', '.brackets-nodejs-integration-debugger-toggle', function () {
        var brackets_nodejs_integration_debugger = $(this).parent().find('.brackets-nodejs-integration-debugger');
        if (brackets_nodejs_integration_debugger.is(':visible')) {
            $(this).html('<i class="fa fa-angle-double-left" aria-hidden="true" style="top: 50%; position: absolute;"></i>');
        }
        else {
            $(this).html('<i class="fa fa-angle-double-right" aria-hidden="true" style="top: 50%; position: absolute;"></i>');
        }
        brackets_nodejs_integration_debugger.toggle();
    });

    $runner_panel.on('click', '.link_to_source', function (e) {
        var link = e.target.innerHTML;
        var link_properties = link.split(/:[^\\/]/);
        var path_to_file = link_properties[0];
        path_to_file = file_utils.convertWindowsPathToUnixPath(path_to_file);
        if (!file_system.isAbsolutePath(path_to_file)) {
            get_runner($runner_panel.find('.nodejs-integration-tab-pane.active').attr('id')).done(function (active_runner) {
                var working_directory = active_runner ? active_runner.get_last_cwd() : '';
                if (!working_directory) {
                    var project_root = project_manager.getProjectRoot();
                    working_directory = project_root ? project_root.fullPath : '';
                }
                if (!_.endsWith(working_directory, '/')) {
                    working_directory = working_directory + '/';
                }
                path_to_file = working_directory + path_to_file;
            });
        }
        var file_line = link_properties[1];
        var file_column = link_properties[2];
        command_manager.execute(commands.FILE_OPEN, {
                fullPath: path_to_file
            })
            .done(function () {
                editor_manager.getCurrentFullEditor().setCursorPos({
                    line: file_line ? file_line - 1 : 0,
                    ch: file_column ? file_column - 1 : 0
                });
            });
    });
    $runner_panel.on('mousedown', '.resize', function (e) {
        panel.y = e.pageY;
        document.addEventListener('mousemove', panel.mousemove);
        document.addEventListener('mouseup', panel.mouseup);
    });

    $runner_panel.on('click', '.link_to_diff', function () {
        var actual = $(this).attr('actual');
        var expected = $(this).attr('expected');
        var target = $(this).parent().find('.diff_view');
        if (target.length > 0) {
            target.remove();
            $(this).parent().find(':contains(">>> ' + strings.HIDE_DIFFERENCE + ' <<<")').text('>>> ' + strings.SHOW_DIFFERENCE + ' <<<');
        }
        else {
            $(this).text('>>> ' + strings.HIDE_DIFFERENCE + ' <<<');
            target = $(document.createElement('view'));
            target.addClass('diff_view');
            $(this).after(target);
            var merge_view_options = {
                value: actual,
                orig: expected,
                hightlightDifferences: true,
                lineNumbers: true,
                mode: 'javascript',
                readOnly: true,
                revertButtons: false
            };
            if (!theme_manager.getCurrentTheme().name.includes('light')) {
                merge_view_options.theme = 'monokai';
            }

            var merge_view = code_mirror.MergeView(target[0], merge_view_options);
            target.prepend($(document.createElement('div'))
                .html(strings.ACTUAL_EXPECTED)
                .addClass('console-element')
                .css('font-size', global_prefs.get('fontSize'))
                .css('font-family', global_prefs.get('fontFamily')));

            target.show();
            utils.resize_merge_view(merge_view);
        }
    });
    $runner_panel.on('click', '.action-close', function () {
        panel.hide();
    });
    $runner_panel.on('click', '.stop_btn', function () {
        var id = $(this).parent().parent().parent().attr('id');
        get_runner(id).done(function (runner) {
            runner.stop();
            get_debugger(id).stop();
        });
    });
    $runner_panel.on('click', '.run_btn', function () {
        var id = $(this).parent().parent().parent().attr('id');
        get_runner(id).done(function (runner) {
            runner.run();
        });
    });
    $runner_panel.on('click', '.debug_btn', function () {
        var id = $(this).parent().parent().parent().attr('id');
        get_runner(id).done(function (runner) {
            runner.debug();
            get_debugger(id).init();
            $runner_panel.find('.brackets-nodejs-integration-debugger').show();
            $runner_panel.find('.brackets-nodejs-integration-debugger-toggle').show();
        });
    });
    $runner_panel.on('click', '.collapse_btn', function () {
        $(this).parent().parent().find('.test-list').find('input').prop('checked', false);
    });
    $runner_panel.on('click', '.expand_btn', function () {
        $(this).parent().parent().find('.test-list').find('input').prop('checked', true);
    });
    $runner_panel.on('click', '.nodejs-integration-tab-close', function () {
        var that = this;
        get_runner($(this).parent().data('target').replace('#', '')).done(function (runner) {
            runner.exit();
            get_debugger($(that).parent().data('target').replace('#', '')).exit();
            $($(that).parent().data('target')).remove();
            $(that).parent().remove();

            //move to another tab
            var $tabs = $runner_panel.find('.nodejs-integration-tab');
            var $new_tab = $tabs.last();
            var $new_tab_pane = $new_tab.data('target');
            $new_tab.add($new_tab_pane).addClass('active');
        });
    });
    $runner_panel.on('click', '.nodejs-integration-tab-new', function () {
        var $tabs = $runner_panel.find('.nodejs-integration-tab');
        if ($tabs.length >= 5) {
            return utils.show_popup_message(strings.RINNERS_LIMITATION);
        }
        create_new_tab();
        change_run_configuration(null, run_configurations[0]);
    });
    $runner_panel.on('click', '.nodejs-integration-tab-settings', function () {
        settings_dialog.show();
    });

    $runner_panel.on('click', '.run-configuration-dropdown-toggle', show_dropdown_runner_selector);

    function create_new_tab() {
        var $tabs = $runner_panel.find('.nodejs-integration-tabs');
        $runner_panel.find('.nodejs-integration-tab.active').removeClass('active');
        $runner_panel.find('.nodejs-integration-tab-pane.active').removeClass('active');
        var new_tab_id = utils.uuid();
        var new_tab_name = run_configurations[0] ? run_configurations[0].name : strings.NEW_TAB;
        $tabs.append($(document.createElement('li'))
            .addClass('nodejs-integration-tab active')
            .attr('data-target', '#' + new_tab_id)
            .append($(document.createElement('div')).addClass('nodejs-integration-tab-indicator'))
            .append($(document.createElement('p')).text(new_tab_name))
            .append($(document.createElement('button'))
                .attr('type', 'button')
                .addClass('nodejs-integration-tab-close')
                .html('&times;')
            )
        );
        $('.nodejs-integration-tabs').each(process_tab_behavior);

        var runner_panel_template_html = mustache.render(runner_panel_template, strings);
        var $tabs_content = $runner_panel.find('.nodejs-integration-tab-content');
        $tabs_content.append($(document.createElement('div'))
            .addClass('nodejs-integration-tab-pane active')
            .attr('id', new_tab_id)
            .html(runner_panel_template_html)
        );

        var max_port = 49152;
        var min_port = 65535;
        var debug_port = Math.floor(Math.random() * (max_port - min_port + 1) + min_port);
        var new_runner = runner.create_new_process(new_tab_id, run_configurations, debug_port);
        var NodeDebugger = require('../debugger/main');
        var new_debugger = NodeDebugger.create_new_debugger(new_tab_id, debug_port);
        runners.push({
            id: new_tab_id,
            process: new_runner,
            debugger: new_debugger
        });
    }

    //tab view
    var tab_view_offset = 0;
    $('.nodejs-integration-tabs').each(process_tab_behavior);

    function process_tab_behavior() {
        var $tab_container = $(this);
        var $tabs = $tab_container.find('.nodejs-integration-tab');
        var mouse_down = false;
        var dragged_tab = null;

        // Fix inline-block margin issues.
        $tab_container.append($tabs.detach());

        $tabs.on('mousedown', function (e) {
            var $this = $(this),
                $pane = $this.data('target');

            $('.nodejs-integration-tab').add('.nodejs-integration-tab-pane').removeClass('active');
            $this.add($pane).addClass('active');

            mouse_down = true;
            dragged_tab = $this;
            tab_view_offset = e.offsetX;
        });

        $(document).on('mousemove', function (e) {
            if (!mouse_down && !dragged_tab) {
                return;
            }

            var left = e.clientX - tab_view_offset;
            var ati = $('.nodejs-integration-tabs').find('.nodejs-integration-tab.active').index();

            dragged_tab.offset({
                left: left
            });

            var t = $tabs.sort(function (a, b) {
                return $(a).offset().left > $(b).offset().left;
            });

            $tabs.detach();
            $tab_container.append(t);

            if (ati !== $('.nodejs-integration-tabs').find('.nodejs-integration-tab.active').index()) {
                $('.nodejs-integration-tabs').find('.nodejs-integration-tab.active').css('left', '');
            }

            $tabs = $tab_container.find('.nodejs-integration-tab');

            e.preventDefault();
        });

        $(document).on('mouseup', function () {
            if (mouse_down && dragged_tab) {
                $tabs.css('left', '');
            }
            mouse_down = false;
            dragged_tab = null;
        });
    }

    function get_runner(panel_id, deferred) {
        if (!deferred) {
            deferred = new $.Deferred();
        }
        var selected_runner_tab = _.findLast(runners, function (runner_tab) {
            return runner_tab.id === panel_id;
        });
        if (!selected_runner_tab || !selected_runner_tab.process || !selected_runner_tab.process.process_domain) {
            setTimeout(function () {
                get_runner(panel_id, deferred);
            }, 250);
        }
        else {
            deferred.resolve(selected_runner_tab.process);
        }
        return deferred.promise();
    }

    function get_debugger(panel_id) {
        var selected_runner_tab = _.findLast(runners, function (runner_tab) {
            return runner_tab.id === panel_id;
        });
        return selected_runner_tab ? selected_runner_tab.debugger : null;
    }

    function change_run_configuration(event, run_configuration) {
        if (!run_configuration) {
            run_configuration = {
                name: $(this).attr('name'),
                type: $(this).attr('type'),
                cwd: $(this).attr('cwd'),
                target: $(this).attr('target'),
                flags: $(this).attr('flags')
            };
        }
        var selected_run_configuration = $runner_panel.find('.nodejs-integration-tab-pane.active .run-configuration-dropdown-toggle');
        selected_run_configuration.find('.type')
            .removeClass('node')
            .removeClass('mocha')
            .removeClass('npm')
            .removeClass('gulp')
            .addClass(run_configuration.type);

        selected_run_configuration.find('.name').html(run_configuration.name);
        selected_run_configuration.attr('name', run_configuration.name);
        selected_run_configuration.attr('type', run_configuration.type);
        selected_run_configuration.attr('cwd', run_configuration.cwd);
        selected_run_configuration.attr('target', run_configuration.target);
        selected_run_configuration.attr('flags', run_configuration.flags);
        var $script_selector = $runner_panel.find('.nodejs-integration-tab-pane.active .script-selector');
        var $debug_btn = $runner_panel.find('.debug_btn');
        if (run_configuration.type === 'npm') {
            $script_selector.show();
            $debug_btn.prop('disabled', true);
            $script_selector.find('option').remove();
            $.getJSON(run_configuration.target, function (npm_file) {
                var script_names = _.keys(npm_file.scripts);
                var standard_scripts = ['install', 'start', 'stop', 'restart', 'test'];
                _.each(_.union(script_names, standard_scripts), function (name) {
                    $script_selector.append($(document.createElement('option'))
                        .val(name)
                        .html(name));
                });
            });
        }
        else if (run_configuration.type === 'gulp') {
            $script_selector.show();
            $debug_btn.prop('disabled', true);
            $script_selector.find('option').remove();
            $.get(run_configuration.target, function (gulp_file) {
                var tasks_match = gulp_file.match(/task\(['"](.*)['"]/g);
                var tasks = [];
                _.each(tasks_match, function (match) {
                    var words = match.split(/['"]/);
                    if (words && words.length > 0 && words[1]) {
                        tasks.push(words[1]);
                    }
                });
                _.each(tasks, function (task) {
                    $script_selector.append($(document.createElement('option'))
                        .val(task)
                        .html(task));
                });
            }, 'text');
        }
        else {
            $script_selector.hide();
            $debug_btn.prop('disabled', false);
        }
        var id = selected_run_configuration.parent().parent().attr('id');
        get_runner(id).done(function (selected_runner) {
            selected_runner.clear();
            selected_runner.set_indicators(run_configuration);
        });
    }

    function close_dropdown_runner_selector() {
        if ($dropdown) {
            pop_up_manager.removePopUp($dropdown);
        }
        detachCloseEvents();
    }

    function show_dropdown_runner_selector(e) {
        if ($dropdown) {
            return;
        }
        e.stopPropagation();
        menus.closeAll();
        $dropdown = $(renderList());
        var active_runner_selector = $runner_panel.find('.nodejs-integration-tab-pane.active .run-configuration-dropdown-toggle');
        var buttonOffset = active_runner_selector.offset();
        var buttonHeight = active_runner_selector.outerHeight();

        $dropdown
            .css({
                left: buttonOffset.left,
                top: buttonOffset.top + buttonHeight
            })
            .appendTo($('body'));
        $dropdown.find('li').each(function () {
            $(this).attr('data-search-term', $(this).text().toLowerCase());
        });
        $dropdown.find('.live-search-box').on('keyup', function (event) {
            var code = event.which;
            if (code === 13) {
                var visible_configurations = $dropdown.find('li:visible');
                if (visible_configurations.length > 0) {
                    var first_configuration = $dropdown.find('.highlight').first().length ? $dropdown.find('.highlight').first() : visible_configurations.first();
                    first_configuration.find('div').trigger('click');
                    return;
                }
            }
            else if (code === 38 || code === 40) {
                var $current;
                var $selected = $dropdown.find('.highlight');
                $selected.removeClass('highlight');
                if (code === 38) {
                    $current = $selected.prevAll('li:visible:first').length ? $selected.prevAll('li:visible:first') : $dropdown.find('li:visible:last');
                }
                if (code === 40) {
                    $current = $selected.nextAll('li:visible:first').length ? $selected.nextAll('li:visible:first') : $dropdown.find('li:visible:first');
                }
                $dropdown.scrollTop($current.offset().top - $dropdown.offset().top + $dropdown.scrollTop());
                $current.addClass('highlight');
            }
            else {
                var searchTerm = $(this).val().toLowerCase();
                $dropdown.find('li').each(function () {
                    if ($(this).filter('[data-search-term *= ' + searchTerm + ']').length > 0 || searchTerm.length < 1) {
                        $(this).show();
                    }
                    else {
                        $(this).hide();
                    }
                });
            }
        });
        pop_up_manager.addPopUp($dropdown, detachCloseEvents, true);
        attachCloseEvents();
        $dropdown.find('div').on('click', change_run_configuration);

        $dropdown.show();
        $dropdown.find('.live-search-box').focus();
    }

    function renderList() {
        var templateVars = {
            run_configurations: prefs.get('configurations')
        };

        return mustache.render(runner_menu_template, templateVars);
    }

    function attachCloseEvents() {
        $('html').on('click', close_dropdown_runner_selector);
        $('#project-files-container').on('scroll', close_dropdown_runner_selector);
        $('#titlebar .nav').on('click', close_dropdown_runner_selector);

        var currentEditor = editor_manager.getCurrentFullEditor();
        if (currentEditor) {
            currentEditor._codeMirror.on('focus', close_dropdown_runner_selector);
        }
    }

    function detachCloseEvents() {
        $('html').off('click', close_dropdown_runner_selector);
        $('#project-files-container').off('scroll', close_dropdown_runner_selector);
        $('#titlebar .nav').off('click', close_dropdown_runner_selector);

        var currentEditor = editor_manager.getCurrentFullEditor();
        if (currentEditor) {
            currentEditor._codeMirror.off('focus', close_dropdown_runner_selector);
        }
        $dropdown = null;
        main_view_manager.focusActivePane();
    }

    function create_new_tab_if_config_is_set_and_panel_empty() {
        var $tabs = $runner_panel.find('.nodejs-integration-tab');
        if ($tabs.length === 0 && prefs.get('create_new_tab_when_panel_opened_and_empty')) {
            $runner_panel.find('.nodejs-integration-tab-new').trigger('click');
            return true;
        }
        return false;
    }

    function change_runner_if_config_set_and_new_tab_created(new_tab_created) {
        if (new_tab_created && prefs.get('change_runner_when_new_tab_opened')) {
            var active_runner_selector = $runner_panel.find('.nodejs-integration-tab-pane.active .run-configuration-dropdown-toggle');
            active_runner_selector.trigger('click');
        }
    }

    exports.$runner_panel = $runner_panel;
    exports.runner_panel = runner_panel;
    exports.runners = runners;
    exports.panel = panel;
    exports.cleanup = function () {
        var runner_directory_path = extension_utils.getModulePath(module, 'domains/');
        var runner_directory = file_system.getDirectoryForPath(runner_directory_path);
        runner_directory.getContents(function (error, files) {
            if (error) {
                console.error('Get content:', runner_directory_path, error, files);
            }
            _.each(files, function (file) {
                if (!_.endsWith(file._path, '.js')) {
                    get_runner(file._name).done(function (found_runner) {
                        found_runner.stop();
                    });
                    file.unlink(function () {});
                }
            });
        });
        var debugger_directory_path = extension_utils.getModulePath(module, '../debugger/node');
        var debugger_directory = file_system.getDirectoryForPath(debugger_directory_path);
        debugger_directory.getContents(function (error, files) {
            if (error) {
                console.error('Get content:', runner_directory_path, error, files);
            }
            _.each(files, function (file) {
                if (!_.endsWith(file._path, '.js')) {
                    get_runner(file._name).done(function (found_runner) {
                        found_runner.stop();
                    });
                    file.unlink(function () {});
                }
            });
        });
    };
    exports.change_run_configuration = change_run_configuration;
    exports.create_new_tab = function () {
        $runner_panel.find('.nodejs-integration-tab-new').trigger('click');
        change_runner_if_config_set_and_new_tab_created(true);
    };
});
