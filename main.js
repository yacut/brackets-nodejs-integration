define(function (require, exports, module) {
    "use strict";

    var _ = brackets.getModule("thirdparty/lodash");
    var command_manager = brackets.getModule("command/CommandManager");
    var commands = brackets.getModule("command/Commands");
    var dialogs = brackets.getModule("widgets/Dialogs");
    var editor_manager = brackets.getModule("editor/EditorManager");
    var extension_utils = brackets.getModule("utils/ExtensionUtils");
    var file_system = brackets.getModule("filesystem/FileSystem");
    var menus = brackets.getModule("command/Menus");
    var project_manager = brackets.getModule("project/ProjectManager");
    var workspace_manager = brackets.getModule("view/WorkspaceManager");

    var ADD_MOCHA_TO_RUNNER_MENU_ID = "brackets-nodejs-integration.add-mocha-to-runner";
    var ADD_NODE_TO_RUNNER_MENU_ID = "brackets-nodejs-integration.add-node-to-runner";
    var DIFF_DIALOG_ID = "brackets-nodejs-integration-diff-dialog";
    var SETTINGS_DIALOG_ID = "brackets-nodejs-integration-settings-dialog";

    var object_diff = require('thirdparty/objectDiff/objectDiff');
    var panel_template = require('text!templates/panel.html');
    var runner_panel_template = require('text!templates/runner_panel.html');
    var prefs = require("./preferences");
    var run_configurations = prefs.get("configurations");

    var runner = require("src/runner");
    var runners = [];

    var runner_panel = null;
    var $runner_panel = $(null);

    var panel = {
        id: "brackets-nodejs-integration-panel",
        html_object: null,
        height: 201,
        mocha_summary: null,
        test_list: null,
        mocha_treeview: null,
        finished_tests_count: 0,
        mocha_stats: null,
        test_tree: [],
        console_output: null,
        actual_test_title: null,
        get: function (qs) {
            return this.html_object.querySelector(qs);
        },
        show: function () {
            this.html_object.show();
            $node_runner_indicator.addClass('active');
            workspace_manager.recomputeLayout();
        },
        show_or_hide: function () {
            this.html_object.toggle();
            $node_runner_indicator.toggleClass('inactive');
            workspace_manager.recomputeLayout();
        },
        hide: function () {
            this.html_object.hide();
            $node_runner_indicator.addClass('inactive');
            workspace_manager.recomputeLayout();
        },
        mousemove: function (e) {
            var h = panel.height + (panel.y - e.pageY);
            panel.html_object.style.height = h + "px";
            workspace_manager.recomputeLayout();
        },
        mouseup: function (e) {
            document.removeEventListener("mousemove", panel.mousemove);
            document.removeEventListener("mouseup", panel.mouseup);
            panel.height = panel.height + (panel.y - e.pageY);
        },
        y: 0
    };

    var runner_panel = workspace_manager.createBottomPanel(panel.id, $(panel_template));
    var $runner_panel = runner_panel.$panel;

    $runner_panel.on("click", ".link_to_source", function (e) {
        var link = e.target.innerHTML;
        var link_properties = link.split(":");
        var path_to_file = link_properties[0];
        if (!file_system.isAbsolutePath(path_to_file)) {
            var runner = get_runner($(this).parent().parent().parent().parent().parent().attr('id'));
            var working_directory = runner ? runner.get_last_cwd() : '';
            if (!working_directory) {
                var project_root = project_manager.getProjectRoot();
                working_directory = project_root ? project_root.fullPath : '';
            }
            if (!_.endsWith(working_directory, '/')) {
                working_directory = working_directory + '/';
            }
            path_to_file = working_directory + path_to_file;
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
    $runner_panel.on("mousedown", ".resize", function (e) {
        panel.y = e.pageY;
        document.addEventListener("mousemove", panel.mousemove);
        document.addEventListener("mouseup", panel.mouseup);
    });
    $runner_panel.on("click", ".link_to_diff", function () {
        var actual = JSON.parse($(this).attr('actual'));
        var expected = JSON.parse($(this).attr('expected'));
        var diff = object_diff.diffOwnProperties(actual, expected);
        var diff_html = object_diff.convertToXMLString(diff);
        dialogs.showModalDialog(
            DIFF_DIALOG_ID,
            "Actual/Expected difference",
            diff_html, [
                {
                    className: dialogs.DIALOG_BTN_CLASS_PRIMARY,
                    id: dialogs.DIALOG_BTN_OK,
                    text: "OK"
                        }
                    ]
        ).done(function () {
            return;
        });
    });
    $runner_panel.on("click", ".action-close", function () {
        panel.hide();
    });
    $runner_panel.on("click", ".stop_btn", function () {
        get_runner($(this).parent().parent().parent().attr('id')).stop();
    });
    $runner_panel.on("click", ".run_btn", function () {
        get_runner($(this).parent().parent().parent().attr('id')).run();
    });
    $runner_panel.on("click", ".collapse_btn", function () {
        $(this).parent().parent().find('.test-list').find('input').prop('checked', false);
    });
    $runner_panel.on("click", ".expand_btn", function () {
        $(this).parent().parent().find('.test-list').find('input').prop('checked', true);
    });
    $runner_panel.on("click", ".nodejs-integration-tab-close", function () {
        get_runner($(this).parent().data("target").replace('#', '')).exit();
        $($(this).parent().data("target")).remove();
        $(this).parent().remove();

        //move to another tab
        var $tabs = $runner_panel.find('.nodejs-integration-tab');
        var $new_tab = $tabs.last();
        var $new_tab_pane = $new_tab.data('target');
        $new_tab.add($new_tab_pane).addClass('active');
    });
    $runner_panel.on("click", ".nodejs-integration-tab-new", function () {
        create_new_tab();
    });
    $runner_panel.on("click", ".nodejs-integration-tab-settings", function () {
        dialog.settings.show();
    });

    function create_new_tab() {
        var $tabs = $runner_panel.find('.nodejs-integration-tabs');
        $runner_panel.find('.nodejs-integration-tab.active').removeClass('active');
        $runner_panel.find('.nodejs-integration-tab-pane.active').removeClass('active');
        var new_tab_id = uuid();
        var new_tab_name = run_configurations[0] ? run_configurations[0].name : 'New Tab';
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

        var $tabs_content = $runner_panel.find('.nodejs-integration-tab-content');
        $tabs_content.append($(document.createElement('div'))
            .addClass('nodejs-integration-tab-pane active')
            .attr('id', new_tab_id)
            .html(runner_panel_template)
        );
        fill_run_selector($runner_panel.find('#' + new_tab_id).find('.run-configuration-selector'));
        var new_runner = runner.create_new_process(new_tab_id, run_configurations);
        runners.push({
            id: new_tab_id,
            process: new_runner
        });
        var run_configuration = new_runner.get_selected_configuration();
        new_runner.set_indicators(run_configuration);
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

            if (ati != $('.nodejs-integration-tabs').find('.nodejs-integration-tab.active').index()) {
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

    extension_utils.loadStyleSheet(module, 'styles/panel.css');
    extension_utils.loadStyleSheet(module, 'thirdparty/objectDiff/objectDiff.css');
    extension_utils.loadStyleSheet(module, 'styles/font-awesome.min.css');

    panel.html_object = $('#' + panel.id);
    panel.mocha_summary = $runner_panel.find('.mocha-summary');
    panel.test_list = $runner_panel.find('.test-list');
    panel.mocha_treeview = $runner_panel.find(".mocha-treeview");
    panel.all_tests_results = $runner_panel.find(".all-tests-results")
        .on('click', function () {
            var console_elements = $runner_panel.find('.console-element');
            _.map(console_elements, function (console_element) {
                console_element.style.display = 'block';
            });
        });
    panel.console_output = $('.brackets-nodejs-integration-console');
    $runner_panel.on("change", ".run-configuration-selector", function () {
        var runner = get_runner($(this).parent().parent().attr('id'));
        runner.clear();
        var run_configuration = runner.get_selected_configuration();
        runner.set_indicators(run_configuration);
    });

    function get_runner(panel_id) {
        var runner_tab = _.findLast(runners, function (runner_tab) {
            return runner_tab.id === panel_id;
        });
        return runner_tab ? runner_tab.process : null;
    }

    var dialog = {
        settings: {
            html: require("text!templates/modal_settings.html"),
            show: function () {
                dialogs.showModalDialog(
                    SETTINGS_DIALOG_ID,
                    "Runner settings",
                    this.html, [
                        {
                            className: dialogs.DIALOG_BTN_CLASS_PRIMARY,
                            id: dialogs.DIALOG_BTN_OK,
                            text: "Save"
                        }, {
                            className: dialogs.DIALOG_BTN_CLASS_NORMAL,
                            id: dialogs.DIALOG_BTN_CANCEL,
                            text: "Cancel"
                        }
                    ]
                ).done(function (id) {
                    if (id !== "ok") {
                        return;
                    }

                    var changed_configurations = [];
                    _.each(runner_list.find('option'), function (runner) {
                        if (runner.text) {
                            changed_configurations.push({
                                "name": runner.text,
                                "cwd": runner.getAttribute('runner_cwd'),
                                "type": runner.getAttribute('runner_type'),
                                "target": runner.getAttribute('runner_target'),
                                "debug": false
                            });
                        }
                    });
                    prefs.set("node-bin", node_bin_input.val().trim());
                    prefs.set("mocha-bin", mocha_bin_input.val().trim());
                    prefs.set("v8-flags", v8_flags_input.val().trim());
                    prefs.set("autoscroll", scroll_input.prop('checked'));
                    prefs.set("configurations", changed_configurations);
                    prefs.save();

                    var configuration_to_remove = run_configurations.filter(function (run_configuration) {
                        return changed_configurations.filter(function (changed_configuration) {
                            return changed_configuration.name == run_configuration.name &&
                                changed_configuration.target == run_configuration.target &&
                                changed_configuration.cwd == run_configuration.cwd &&
                                changed_configuration.type == run_configuration.type;
                        }).length === 0;
                    });

                    var configuration_to_add = changed_configurations.filter(function (changed_configuration) {
                        return run_configurations.filter(function (run_configuration) {
                            return run_configuration.name == changed_configuration.name &&
                                run_configuration.target == changed_configuration.target &&
                                run_configuration.cwd == changed_configuration.cwd &&
                                run_configuration.type == changed_configuration.type;
                        }).length === 0;
                    });

                    run_configurations = changed_configurations;
                    _.each(runners, function (runner) {
                        runner.process.run_configurations = changed_configurations;
                        runner.process.scroll_enabled = prefs.get("autoscroll");
                    });

                    _.each(configuration_to_add, function (configuration) {
                        $runner_panel.find('.run-configuration-selector')
                            .append($(document.createElement('option'))
                                .val(configuration.name)
                                .html(configuration.name)
                                .attr('class', configuration.type));
                    });

                    if (configuration_to_remove.length > 0) {
                        stop_all_runners();
                    }
                    _.each(configuration_to_remove, function (configuration) {
                        $runner_panel.find('.run-configuration-selector').find('option[value="' + configuration.name + '"]').remove();
                    });
                });
                var node_bin_input = $(".brackets-nodejs-integration-runner-node-bin").val(prefs.get("node-bin"));
                var mocha_bin_input = $(".brackets-nodejs-integration-runner-mocha-bin").val(prefs.get("mocha-bin"));
                var scroll_input = $(".brackets-nodejs-integration-runner-autoscroll").attr('checked', prefs.get("autoscroll"));
                var v8_flags_input = $(".brackets-nodejs-integration-runner-flags").val(prefs.get("v8-flags"));

                var runner_name = $("#brackets-nodejs-integration-runner-name").on("input", function () {
                    runner_list.children(":selected").html($(this).val());
                });
                var runner_type = $("#brackets-nodejs-integration-runner-type").on("change", function () {
                    runner_list.children(":selected").attr('runner_type', $(this).val());
                });
                var runner_target = $("#brackets-nodejs-integration-runner-target").on("change", function () {
                    runner_list.children(":selected").attr('runner_target', $(this).val());
                });
                var runner_cwd = $("#brackets-nodejs-integration-runner-cwd").on("change", function () {
                    runner_list.children(":selected").attr('runner_cwd', $(this).val());
                });
                var runner_list = $("#brackets-nodejs-integration-runner-list")
                    .change(function () {
                        var runner = $(this).children(":selected");
                        runner_name.val(runner.html());
                        runner_type.val(runner.attr('runner_type'));
                        runner_target.val(runner.attr('runner_target'));
                        runner_cwd.val(runner.attr('runner_cwd'));
                    });

                var configurations = prefs.get("configurations");
                _.each(configurations, function (configuration) {
                    var option = $(document.createElement("option"))
                        .html(configuration.name)
                        .attr('runner_type', configuration.type)
                        .attr('runner_target', configuration.target)
                        .attr('runner_cwd', configuration.cwd);
                    runner_list.append(option);
                });

                var first_runner = runner_list.find('option:first').attr('selected', true);
                runner_name.val(first_runner.html());
                runner_type.val(first_runner.attr('runner_type'));
                runner_target.val(first_runner.attr('runner_target'));
                runner_cwd.val(first_runner.attr('runner_cwd'));

                $("#brackets-nodejs-integration-runner-add-btn").on("click", function () {
                    runner_name.val('');
                    runner_type.val('node');
                    runner_target.val('');
                    runner_cwd.val('');
                    var option = $(document.createElement("option"))
                        .html('')
                        .attr('runner_type', 'node')
                        .attr('runner_target', '')
                        .attr('runner_cwd', '');
                    runner_list.append(option);
                    runner_list.find('option:last').attr('selected', true);
                });

                $("#brackets-nodejs-integration-runner-remove-btn").on("click", function () {
                    var selected_runner = runner_list.find('option:selected');
                    var next_runner = selected_runner.next('option');
                    selected_runner.remove();
                    if (next_runner.length === 0) {
                        next_runner = runner_list.find('option:last');
                    }
                    next_runner.attr('selected', true);
                    runner_name.val(next_runner.html());
                    runner_type.val(next_runner.attr('runner_type'));
                    runner_target.val(next_runner.attr('runner_target'));
                    runner_cwd.val(next_runner.attr('runner_cwd'));
                });
                $("#brackets-nodejs-integration-runner-target-open-btn").on("click", function () {
                    var selected_runner = runner_list.find('option:selected');
                    var init_folder = selected_runner.attr('runner_target').replace(/([ ])/g, '\\$1');
                    if (!file_system.isAbsolutePath(init_folder)) {
                        init_folder = selected_runner.attr('runner_cwd').replace(/([ ])/g, '\\$1');
                    }
                    if (_.endsWith(init_folder, '.js')) {
                        init_folder = init_folder.substring(0, init_folder.lastIndexOf('/')).substring(0, init_folder.lastIndexOf('\\'));
                    }
                    file_system.showOpenDialog(false, selected_runner.attr('runner_type') === 'mocha', "Choose target...", init_folder, [], function (error, target_list) {
                        if (target_list && target_list.length > 0) {
                            runner_target.val(target_list[0]);
                            selected_runner.attr('runner_target', target_list[0]);
                        }
                    });
                });
                $("#brackets-nodejs-integration-runner-cwd-open-btn").on("click", function () {
                    var selected_runner = runner_list.find('option:selected');
                    var init_folder = selected_runner.attr('runner_cwd').replace(/([ ])/g, '\\$1');
                    file_system.showOpenDialog(false, true, "Choose working directory...", init_folder, null, function (error, target_list) {
                        if (target_list && target_list.length > 0) {
                            runner_cwd.val(target_list[0]);
                            selected_runner.attr('runner_cwd', target_list[0]);
                        }
                    });
                });
            }
        }
    };

    project_manager.on('beforeAppClose', stop_all_runners);
    project_manager.on('beforeProjectClose', stop_all_runners);

    function stop_all_runners() {
        var directory_path = extension_utils.getModulePath(module, "src/domains/");
        var directory = file_system.getDirectoryForPath(directory_path);
        directory.getContents(function (error, files) {
            _.each(files, function (file) {
                if (!_.endsWith(file._path, '.js')) {
                    var runner = get_runner(file._name);
                    if (runner) {
                        runner.stop();
                    }
                    file.unlink(function () {});
                }
            });
        });
    }

    var $node_runner_indicator = $("<a id='brackets-nodejs-integration-runner-indicator' class='inactive'></a>")
        .on('click', function () {
            panel.show_or_hide();
        });
    $('#main-toolbar .buttons').append($node_runner_indicator);

    var context_menu = menus.getContextMenu(menus.ContextMenuIds.PROJECT_MENU);
    context_menu.addMenuDivider();
    command_manager.register("Add to Node.js runner", ADD_NODE_TO_RUNNER_MENU_ID, function () {
        var path = project_manager.getSelectedItem().fullPath;
        add_run_configuration("node", path);
        panel.show();
    });
    context_menu.addMenuItem(ADD_NODE_TO_RUNNER_MENU_ID, "", menus.LAST);
    command_manager.register("Add to Mocha runner", ADD_MOCHA_TO_RUNNER_MENU_ID, function () {
        var path = project_manager.getSelectedItem().fullPath;
        add_run_configuration("mocha", path);
        //TODO select config before show panel
        panel.show();
    });
    context_menu.addMenuItem(ADD_MOCHA_TO_RUNNER_MENU_ID, "", menus.LAST);
    context_menu.addMenuDivider();

    fill_run_selector($runner_panel.find('.run-configuration-selector'));

    function fill_run_selector($run_selector) {
        run_configurations.forEach(function (run_configuration, index) {
            $run_selector.append($(document.createElement('option'))
                .val(run_configuration.name)
                .html(run_configuration.name)
                .attr('class', run_configuration.type));
        });
    }

    function add_run_configuration(type, path) {
        //TODO check if config exist
        var filename = path.replace(/^.*[\\\/]/, '');
        var project_root = project_manager.getProjectRoot();
        var working_directory = project_root ? project_root.fullPath : '';
        run_configurations.push({
            "name": filename,
            "type": type,
            "cwd": working_directory,
            "target": path,
            "debug": false
        });
        $runner_panel.find('.run-configuration-selector')
            .append($(document.createElement('option'))
                .val(filename)
                .html(filename)
                .attr('class', type));
        $runner_panel.find('.run-configuration-selector').val(filename);
        var run_configurations_without_ids = _.cloneDeep(run_configurations);
        _.forEach(run_configurations_without_ids, function (item) {
            delete item.id;
        });
        prefs.set("configurations", run_configurations_without_ids);
        run_configurations_without_ids = null;
    }

    function uuid() {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    }
});
