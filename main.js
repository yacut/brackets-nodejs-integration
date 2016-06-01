/*global brackets,$*/
'use strict';

define(function (require, exports, module) {

    var _ = brackets.getModule('thirdparty/lodash');
    var command_manager = brackets.getModule('command/CommandManager');
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
    var SETTINGS_CMD_ID = 'brackets-nodejs-integration.settings';
    var START_ACTIVE_RUNNER_ID = 'brackets-nodejs-integration.start-runner';
    var STEP_OVER_RUNNER_ID = 'brackets-nodejs-integration.debug-step-over';
    var STOP_ACTIVE_RUNNER_ID = 'brackets-nodejs-integration.stop-runner';

    var improved_require = require('src/improved_require');
    var main_menu = menus.addMenu('NodeJS', MAIN_MENU_ID);
    var prefs = require('./preferences');
    var runner_panel = require('src/runner_panel');
    var settings_dialog = require('src/settings_dialog');
    var run_configurations = prefs.get('configurations');

    improved_require.init();

    extension_utils.loadStyleSheet(module, 'debugger/assets/style.css');
    extension_utils.loadStyleSheet(module, 'styles/panel.css');
    extension_utils.loadStyleSheet(module, 'thirdparty/objectDiff/objectDiff.css');
    extension_utils.loadStyleSheet(module, 'styles/font-awesome.min.css');

    project_manager.on('beforeAppClose', runner_panel.cleanup);
    project_manager.on('beforeProjectClose', runner_panel.cleanup);

    var $node_runner_indicator = $('<a id="brackets-nodejs-integration-runner-indicator" class="inactive"></a>')
        .on('click', function () {
            runner_panel.panel.show_or_hide();
        });
    $('#main-toolbar .buttons').append($node_runner_indicator);


    command_manager.register('Show/Hide runner', RUNNER_CMD_ID, function () {
        runner_panel.panel.show_or_hide();
    });
    main_menu.addMenuItem(RUNNER_CMD_ID, 'F4');

    command_manager.register('Settings...', SETTINGS_CMD_ID, function () {
        settings_dialog.show();
    });
    main_menu.addMenuItem(SETTINGS_CMD_ID, '');

    command_manager.register('Start (active runner)', START_ACTIVE_RUNNER_ID, function () {
        runner_panel.panel.show();
        runner_panel.panel.html_object.find('.nodejs-integration-tab-pane.active .run_btn').trigger('click');
    });
    main_menu.addMenuItem(START_ACTIVE_RUNNER_ID, 'F6', menus.LAST);
    command_manager.register('Debug (active runner)', DEBUG_ACTIVE_RUNNER_ID, function () {
        runner_panel.panel.show();
        runner_panel.panel.html_object.find('.nodejs-integration-tab-pane.active .debug_btn').trigger('click');
    });
    main_menu.addMenuItem(DEBUG_ACTIVE_RUNNER_ID, 'F7', menus.LAST);

    command_manager.register('Stop (active runner)', STOP_ACTIVE_RUNNER_ID, function () {
        runner_panel.panel.show();
        runner_panel.panel.html_object.find('.nodejs-integration-tab-pane.active .stop_btn').trigger('click');
    });
    main_menu.addMenuItem(STOP_ACTIVE_RUNNER_ID, 'Shift-F6', menus.LAST);

    command_manager.register('Debugger - step over (active runner)', STEP_OVER_RUNNER_ID, function () {
        runner_panel.panel.html_object.find('.nodejs-integration-tab-pane.active .step_over_btn').trigger('click');
    });
    main_menu.addMenuItem(STEP_OVER_RUNNER_ID, 'Shift-F11', menus.LAST);

    command_manager.register('Debugger - continue (active runner)', CONTINUE_RUNNER_ID, function () {
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
    command_manager.register('Add to Node.js runner', ADD_NODE_TO_RUNNER_MENU_ID, function () {
        var path = project_manager.getSelectedItem().fullPath;
        var cwd = project_manager.getSelectedItem().parentPath;
        if (!_.endsWith(path, '.js')) {
            return;
        }
        add_run_configuration('node', path, cwd);
        runner_panel.panel.show();
    });
    context_menu.addMenuItem(ADD_NODE_TO_RUNNER_MENU_ID, '', menus.LAST);
    command_manager.register('Add to Mocha runner', ADD_MOCHA_TO_RUNNER_MENU_ID, function () {
        var path = project_manager.getSelectedItem().fullPath;
        var cwd = project_manager.getSelectedItem().parentPath;
        if (!_.endsWith(path, '.js')) {
            return;
        }
        add_run_configuration('mocha', path, cwd);
        //TODO select config before show panel
        runner_panel.panel.show();
    });
    context_menu.addMenuItem(ADD_MOCHA_TO_RUNNER_MENU_ID, '', menus.LAST);
    command_manager.register('Add to NPM runner', ADD_NPM_TO_RUNNER_MENU_ID, function () {
        var path = project_manager.getSelectedItem().fullPath;
        var cwd = project_manager.getSelectedItem().parentPath;
        if (!_.endsWith(path, 'package.json')) {
            return;
        }
        add_run_configuration('npm', path, cwd);
        runner_panel.panel.show();
    });
    context_menu.addMenuItem(ADD_NPM_TO_RUNNER_MENU_ID, '', menus.LAST);
    command_manager.register('Add to gulp runner', ADD_GULP_TO_RUNNER_MENU_ID, function () {
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
        //TODO check if config exist
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

});
