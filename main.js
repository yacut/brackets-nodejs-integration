/*global brackets,$*/
'use strict';

define(function (require, exports, module) {

    var _ = brackets.getModule('thirdparty/lodash');
    var command_manager = brackets.getModule('command/CommandManager');
    var document_manager = brackets.getModule('document/DocumentManager');
    var extension_utils = brackets.getModule('utils/ExtensionUtils');
    var menus = brackets.getModule('command/Menus');
    var project_manager = brackets.getModule('project/ProjectManager');

    var ADD_MOCHA_TO_RUNNER_MENU_ID = 'brackets-nodejs-integration.add-mocha-to-runner';
    var ADD_NODE_TO_RUNNER_MENU_ID = 'brackets-nodejs-integration.add-node-to-runner';
    var ADD_NPM_TO_RUNNER_MENU_ID = 'brackets-nodejs-integration.add-npm-to-runner';
    var ADD_GULP_TO_RUNNER_MENU_ID = 'brackets-nodejs-integration.add-gulp-to-runner';
    var CONTINUE_RUNNER_ID = 'brackets-nodejs-integration.debug-continue';
    var DEBUG_ACTIVE_RUNNER_ID = 'brackets-nodejs-integration.debug-runner';
    var JUMP_TO_REQUIRE_COMMAND_ID = 'brackets-nodejs-integration.go-to-require';
    var MAIN_MENU_ID = 'brackets-nodejs-integration-main-menu';
    var RUNNER_CMD_ID = 'brackets-nodejs-integration.runner';
    var CREATE_NEW_TAB_CMD_ID = 'brackets-nodejs-integration.create-new-tab';
    var CLOSE_CURRENT_TAB_CMD_ID = 'brackets-nodejs-integration.close-current-tab';
    var SETTINGS_CMD_ID = 'brackets-nodejs-integration.settings';
    var START_ACTIVE_RUNNER_ID = 'brackets-nodejs-integration.start-runner';
    var START_CURRENT_FILE_RUNNER_ID = 'brackets-nodejs-integration.start-current-file';
    var START_CURRENT_PROJECT_RUNNER_ID = 'brackets-nodejs-integration.start-current-project';
    var START_CURRENT_TEST_RUNNER_ID = 'brackets-nodejs-integration.start-current-test';
    var STEP_OVER_RUNNER_ID = 'brackets-nodejs-integration.debug-step-over';
    var STOP_ACTIVE_RUNNER_ID = 'brackets-nodejs-integration.stop-runner';

    var improved_require = require('src/improved_require');
    var main_menu = menus.addMenu('NodeJS', MAIN_MENU_ID);
    var prefs = require('./preferences');
    var runner_panel = require('src/runner_panel');
    var settings_dialog = require('src/settings_dialog');
    var strings = require('strings');
    var run_configurations = prefs.get('configurations');

    improved_require.init();

    extension_utils.loadStyleSheet(module, 'debugger/assets/style.css');
    extension_utils.loadStyleSheet(module, 'styles/panel.css');
    extension_utils.loadStyleSheet(module, 'styles/font-awesome.min.css');
    extension_utils.loadStyleSheet(module, 'thirdparty/merge.css');
    extension_utils.loadStyleSheet(module, 'thirdparty/monokai.css');

    project_manager.on('beforeAppClose', runner_panel.cleanup);
    project_manager.on('beforeProjectClose', runner_panel.cleanup);

    var $node_runner_indicator = $('<a id="brackets-nodejs-integration-runner-indicator" class="inactive"></a>')
        .on('click', function () {
            runner_panel.panel.show_or_hide();
        });
    $('#main-toolbar .buttons').append($node_runner_indicator);

    command_manager.register(strings.SHOW_OR_HIDE_RUNNER, RUNNER_CMD_ID, function () {
        runner_panel.panel.show_or_hide();
    });
    main_menu.addMenuItem(RUNNER_CMD_ID, 'F4');

    command_manager.register(strings.CREATE_NEW_TAB, CREATE_NEW_TAB_CMD_ID, function () {
        runner_panel.panel.show(true);
        runner_panel.create_new_tab();
    });
    main_menu.addMenuItem(CREATE_NEW_TAB_CMD_ID, 'Shift-F4');

    command_manager.register(strings.CLOSE_CURRENT_TAB, CLOSE_CURRENT_TAB_CMD_ID, function () {
        var close_btn = runner_panel.panel.html_object.find('.nodejs-integration-tab.active .nodejs-integration-tab-close');
        if (close_btn.length !== 0) {
            close_btn.trigger('click');
        }
    });
    main_menu.addMenuItem(CLOSE_CURRENT_TAB_CMD_ID, 'Ctrl-F4');

    command_manager.register(strings.SETTINGS, SETTINGS_CMD_ID, function () {
        settings_dialog.show();
    });
    main_menu.addMenuItem(SETTINGS_CMD_ID, '');

    command_manager.register(strings.START_ACTIVE_RUNNER, START_ACTIVE_RUNNER_ID, function () {
        var run_btn = runner_panel.panel.html_object.find('.nodejs-integration-tab-pane.active .run_btn');
        if (run_btn.length !== 0) {
            runner_panel.panel.show();
            run_btn.trigger('click');
        }
    });
    main_menu.addMenuItem(START_ACTIVE_RUNNER_ID, 'F6', menus.LAST);

    command_manager.register(strings.DEBUG_ACTIVE_RUNNER, DEBUG_ACTIVE_RUNNER_ID, function () {
        var debug_btn = runner_panel.panel.html_object.find('.nodejs-integration-tab-pane.active .debug_btn');
        if (debug_btn.length !== 0) {
            runner_panel.panel.show();
            debug_btn.trigger('click');
        }
    });
    main_menu.addMenuItem(DEBUG_ACTIVE_RUNNER_ID, 'F7', menus.LAST);

    command_manager.register(strings.STOP_ACTIVE_RUNNER, STOP_ACTIVE_RUNNER_ID, function () {
        var stop_btn = runner_panel.panel.html_object.find('.nodejs-integration-tab-pane.active .stop_btn');
        if (stop_btn.length !== 0) {
            runner_panel.panel.show();
            stop_btn.trigger('click');
        }
    });
    main_menu.addMenuItem(STOP_ACTIVE_RUNNER_ID, 'Shift-F6', menus.LAST);

    command_manager.register(strings.START_CURRENT_NODEJS_PROJECT, START_CURRENT_PROJECT_RUNNER_ID, function () {
        var project_root = project_manager.getProjectRoot();
        if (!project_root) {
            return;
        }
        create_and_run_configuration('.', 'node', project_root.fullPath);
    });
    main_menu.addMenuItem(START_CURRENT_PROJECT_RUNNER_ID, 'Ctrl-Shift-P', menus.LAST);

    command_manager.register(strings.START_CURRENT_NODEJS_FILE, START_CURRENT_FILE_RUNNER_ID, function () {
        var current_document = document_manager.getCurrentDocument();
        if (!current_document) {
            return;
        }
        create_and_run_configuration(current_document.file.fullPath, 'node');
    });
    main_menu.addMenuItem(START_CURRENT_FILE_RUNNER_ID, 'Ctrl-Shift-N', menus.LAST);

    command_manager.register(strings.START_CURRENT_MOCHA_FILE, START_CURRENT_TEST_RUNNER_ID, function () {
        var current_document = document_manager.getCurrentDocument();
        if (!current_document) {
            return;
        }
        create_and_run_configuration(current_document.file.fullPath, 'mocha');
    });
    main_menu.addMenuItem(START_CURRENT_TEST_RUNNER_ID, 'Ctrl-Shift-T', menus.LAST);

    function create_and_run_configuration(path, type, cwd) {
        runner_panel.panel.show();
        var active_tab = runner_panel.panel.html_object.find('.nodejs-integration-tab-pane.active');
        if (active_tab.length === 0) {
            runner_panel.create_new_tab();
            active_tab = runner_panel.panel.html_object.find('.nodejs-integration-tab-pane.active');
        }
        var process_running = runner_panel.panel.html_object.find('.nodejs-integration-tab-pane.active .run_btn').prop('disabled');
        if (process_running) {
            runner_panel.create_new_tab();
            active_tab = runner_panel.panel.html_object.find('.nodejs-integration-tab-pane.active');
        }

        var filename = path.replace(/^.*[\\\/]/, '');
        if (path === '.') {
            filename = project_manager.getProjectRoot()._name;
        }
        runner_panel.change_run_configuration(null, {
            'name': filename,
            'type': type,
            'cwd': cwd || '',
            'target': path,
            'debug': false
        });
        active_tab.find('.run_btn').trigger('click');
    }

    command_manager.register(strings.DEBUGGER_STEP_OVER_ACTIVE_RUNNER, STEP_OVER_RUNNER_ID, function () {
        runner_panel.panel.html_object.find('.nodejs-integration-tab-pane.active .step_over_btn').trigger('click');
    });
    main_menu.addMenuItem(STEP_OVER_RUNNER_ID, 'Shift-F11', menus.LAST);

    command_manager.register(strings.DEBUGGER_CONTINUE_ACTIVE_RUNNER, CONTINUE_RUNNER_ID, function () {
        runner_panel.panel.html_object.find('.nodejs-integration-tab-pane.active .continue_btn').trigger('click');
    });
    main_menu.addMenuItem(CONTINUE_RUNNER_ID, 'F11', menus.LAST);
    main_menu.addMenuDivider();

    // Global breakpoint gutter *************************************************/
    var global_gutter = require('./debugger/breakpoints/breakpointGutter').create_new();
    global_gutter.init(null, main_menu);

    main_menu.addMenuItem(JUMP_TO_REQUIRE_COMMAND_ID, 'Ctrl-Shift-J', menus.LAST);

    var context_menu = menus.getContextMenu(menus.ContextMenuIds.PROJECT_MENU);
    context_menu.addMenuDivider();
    command_manager.register(strings.ADD_TO_NODEJS_RUNNER, ADD_NODE_TO_RUNNER_MENU_ID, function () {
        var path = project_manager.getSelectedItem().fullPath;
        var cwd = project_manager.getSelectedItem().parentPath;
        if (!_.endsWith(path, '.js')) {
            return;
        }
        add_run_configuration('node', path, cwd);
        runner_panel.panel.show();
    });
    context_menu.addMenuItem(ADD_NODE_TO_RUNNER_MENU_ID, '', menus.LAST);
    command_manager.register(strings.ADD_TO_MOCHA_RUNNER, ADD_MOCHA_TO_RUNNER_MENU_ID, function () {
        var path = project_manager.getSelectedItem().fullPath;
        var cwd = project_manager.getSelectedItem().parentPath;
        if (!_.endsWith(path, '.js')) {
            return;
        }
        add_run_configuration('mocha', path, cwd);
        runner_panel.panel.show();
    });
    context_menu.addMenuItem(ADD_MOCHA_TO_RUNNER_MENU_ID, '', menus.LAST);
    command_manager.register(strings.ADD_TO_NPM_RUNNER, ADD_NPM_TO_RUNNER_MENU_ID, function () {
        var path = project_manager.getSelectedItem().fullPath;
        var cwd = project_manager.getSelectedItem().parentPath;
        if (!_.endsWith(path, 'package.json')) {
            return;
        }
        add_run_configuration('npm', path, cwd);
        runner_panel.panel.show();
    });
    context_menu.addMenuItem(ADD_NPM_TO_RUNNER_MENU_ID, '', menus.LAST);
    command_manager.register(strings.ADD_TO_GULP_RUNNER, ADD_GULP_TO_RUNNER_MENU_ID, function () {
        var path = project_manager.getSelectedItem().fullPath;
        var cwd = project_manager.getSelectedItem().parentPath;
        if (!_.endsWith(path, 'gulpfile.js')) {
            return;
        }
        add_run_configuration('gulp', path, cwd);
        runner_panel.panel.show();
    });
    context_menu.addMenuItem(ADD_GULP_TO_RUNNER_MENU_ID, '', menus.LAST);

    function add_run_configuration(type, path, cwd) {
        var filename = path.replace(/^.*[\\\/]/, '');
        var project_root = project_manager.getProjectRoot();
        var working_directory = cwd ? cwd : project_root ? project_root.fullPath : '';
        run_configurations.push({
            'name': filename,
            'type': type,
            'cwd': working_directory,
            'target': path,
            'debug': false
        });
        runner_panel.$runner_panel.find('.run-configuration-selector')
            .append($(document.createElement('option'))
                .val(filename)
                .html(filename)
                .attr('class', type));
        runner_panel.$runner_panel.find('.run-configuration-selector').val(filename);
        var run_configurations_without_ids = _.cloneDeep(run_configurations);
        _.forEach(run_configurations_without_ids, function (item) {
            delete item.id;
        });
        prefs.set('configurations', run_configurations_without_ids);
        run_configurations_without_ids = null;
    }

    var preferences_manager = brackets.getModule('preferences/PreferencesManager');
    var global_prefs = preferences_manager.getExtensionPrefs('fonts');
    global_prefs.on('change', 'fontSize', applyFontChanges);
    global_prefs.on('change', 'fontFamily', applyFontChanges);

    function applyFontChanges() {
        $('.console-element, .link_to_diff.console-element')
            .css('font-size', global_prefs.get('fontSize'))
            .css('font-family', global_prefs.get('fontFamily'));

        $('.brackets-nodejs-integration-debugger-log, .brackets-nodejs-integration-debugger-log span.var-name, .brackets-nodejs-integration-debugger-log span.var-value')
            .css('font-size', global_prefs.get('fontSize'))
            .css('font-family', global_prefs.get('fontFamily'));
    }
});
