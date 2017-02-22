/*global brackets*/
'use strict';

define(function main(require, exports, module) {
    var extension_utils = brackets.getModule('utils/ExtensionUtils');
    var preferences_manager = brackets.getModule('preferences/PreferencesManager');
    var prefs = preferences_manager.getExtensionPrefs('brackets-nodejs-integration');

    // Default settings
    prefs.definePreference('node-bin', 'string', '');
    prefs.definePreference('mocha-bin', 'string', extension_utils.getModulePath(module, 'node_modules/mocha/bin/mocha'));
    prefs.definePreference('npm-bin', 'string', '');
    prefs.definePreference('gulp-bin', 'string', extension_utils.getModulePath(module, 'node_modules/gulp/bin/gulp.js'));
    prefs.definePreference('autoscroll', 'boolean', true);
    prefs.definePreference('create_new_tab_when_panel_opened_and_empty', 'boolean', true);
    prefs.definePreference('change_runner_when_new_tab_opened', 'boolean', true);
    prefs.definePreference('debugger_break_on_start', 'boolean', true);
    prefs.definePreference('v8-flags', 'string', '');
    prefs.definePreference('additional-flags', 'string', '');
    prefs.definePreference('configurations', 'array', [
        {
            'name': 'npm run',
            'cwd': '',
            'flags': '',
            'type': 'npm',
            'target': '{project_root}/package.json',
            'debug': false
        },
        {
            'name': 'nodejs process sample',
            'cwd': '',
            'flags': '',
            'type': 'node',
            'target': extension_utils.getModulePath(module, 'tests/hello.js'),
            'debug': false
        },
        {
            'name': 'http server sample',
            'cwd': '',
            'flags': '',
            'type': 'node',
            'target': extension_utils.getModulePath(module, 'tests/server.js'),
            'debug': false
        },
        {
            'name': 'mocha test sample',
            'cwd': '',
            'flags': '',
            'type': 'mocha',
            'target': extension_utils.getModulePath(module, 'tests/mocha_test.js'),
            'debug': false
        }
    ]);
    //debugger
    prefs.definePreference('debugger-host', 'string', 'localhost');
    prefs.definePreference('removeBreakpointsOnDisconnect', 'boolean', false);
    prefs.definePreference('lookupDepth', 'number', 4);
    prefs.definePreference('breakpoints', 'array', []);

    prefs.save();
    module.exports = prefs;
});
