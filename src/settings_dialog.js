/*global brackets,$*/

'use strict';
define(function main(require, exports) {
    var _ = brackets.getModule('thirdparty/lodash');
    var dialogs = brackets.getModule('widgets/Dialogs');
    var file_system = brackets.getModule('filesystem/FileSystem');
    var mustache = brackets.getModule('thirdparty/mustache/mustache');

    var SETTINGS_DIALOG_ID = 'brackets-nodejs-integration-settings-dialog';

    var prefs = require('../preferences');
    var run_configurations = prefs.get('configurations');
    var runner_panel = require('./runner_panel');
    var strings = require('strings');

    exports.show = function () {
        var modal_settings = require('text!templates/modal_settings.html');
        var modal_settings_html = mustache.render(modal_settings, strings);
        dialogs.showModalDialog(
            SETTINGS_DIALOG_ID,
            strings.RUNNER_SETTINGS,
            modal_settings_html, [
                {
                    className: dialogs.DIALOG_BTN_CLASS_PRIMARY,
                    id: dialogs.DIALOG_BTN_OK,
                    text: strings.SAVE
                        }, {
                    className: dialogs.DIALOG_BTN_CLASS_NORMAL,
                    id: dialogs.DIALOG_BTN_CANCEL,
                    text: strings.CANCEL
                        }
                    ]
        ).done(function (id) {
            if (id !== 'ok') {
                return;
            }

            var changed_configurations = [];
            _.each(runner_list.find('option'), function (runner_list_item) {
                if (runner_list_item.text) {
                    changed_configurations.push({
                        'name': runner_list_item.text,
                        'cwd': runner_list_item.getAttribute('runner_cwd'),
                        'flags': runner_list_item.getAttribute('runner_flags') || '',
                        'type': runner_list_item.getAttribute('runner_type'),
                        'target': runner_list_item.getAttribute('runner_target'),
                        'debug': false
                    });
                }
            });
            prefs.set('node-bin', node_bin_input.val().trim());
            prefs.set('mocha-bin', mocha_bin_input.val().trim());
            prefs.set('npm-bin', npm_bin_input.val().trim());
            prefs.set('v8-flags', v8_flags_input.val().trim());
            prefs.set('additional-flags', additional_flags.val().trim());
            prefs.set('lookupDepth', parseInt(lookup_depth.val().trim(), 10));
            prefs.set('removeBreakpointsOnDisconnect', remove_breakpoints_on_disconnect.prop('checked'));
            prefs.set('autoscroll', scroll_input.prop('checked'));
            prefs.set('configurations', changed_configurations);
            prefs.save();

            var configuration_to_remove = run_configurations.filter(function (run_configuration) {
                return changed_configurations.filter(function (changed_configuration) {
                    return changed_configuration.name === run_configuration.name &&
                        changed_configuration.target === run_configuration.target &&
                        changed_configuration.cwd === run_configuration.cwd &&
                        changed_configuration.type === run_configuration.type;
                }).length === 0;
            });

            var configuration_to_add = changed_configurations.filter(function (changed_configuration) {
                return run_configurations.filter(function (run_configuration) {
                    return run_configuration.name === changed_configuration.name &&
                        run_configuration.target === changed_configuration.target &&
                        run_configuration.cwd === changed_configuration.cwd &&
                        run_configuration.type === changed_configuration.type;
                }).length === 0;
            });

            run_configurations = changed_configurations;
            _.each(runner_panel.runners, function (runner_item) {
                runner_item.process.run_configurations = changed_configurations;
                runner_item.process.scroll_enabled = prefs.get('autoscroll');
            });

            if (configuration_to_remove.length > 0) {
                runner_panel.cleanup();
            }
            _.each(configuration_to_remove, function (configuration) {
                runner_panel.$runner_panel.find('.run-configuration-selector').find('option[value="' + configuration.name + '"]').remove();
            });

            _.each(configuration_to_add, function (configuration) {
                runner_panel.$runner_panel.find('.run-configuration-selector')
                    .append($(document.createElement('option'))
                        .val(configuration.name)
                        .html(configuration.name)
                        .attr('class', configuration.type));
            });
        });
        var node_bin_input = $('.brackets-nodejs-integration-runner-node-bin').val(prefs.get('node-bin'));
        var mocha_bin_input = $('.brackets-nodejs-integration-runner-mocha-bin').val(prefs.get('mocha-bin'));
        var npm_bin_input = $('.brackets-nodejs-integration-runner-npm-bin').val(prefs.get('npm-bin'));
        var scroll_input = $('.brackets-nodejs-integration-runner-autoscroll').attr('checked', prefs.get('autoscroll'));
        var v8_flags_input = $('.brackets-nodejs-integration-runner-flags').val(prefs.get('v8-flags'));
        var additional_flags = $('.brackets-nodejs-integration-additional-flags').val(prefs.get('additional-flags'));
        var lookup_depth = $('.brackets-nodejs-integration-runner-lookup-depth').val(prefs.get('lookupDepth'));
        var remove_breakpoints_on_disconnect = $('.brackets-nodejs-integration-runner-remove-breakpoints-on-disconnect').attr('checked', prefs.get('removeBreakpointsOnDisconnect'));

        var runner_name = $('#brackets-nodejs-integration-runner-name').on('input', function () {
            runner_list.children(':selected').html($(this).val());
        });
        var runner_type = $('#brackets-nodejs-integration-runner-type').on('change', function () {
            runner_list.children(':selected').attr('runner_type', $(this).val());
        });
        var runner_target = $('#brackets-nodejs-integration-runner-target').on('change', function () {
            runner_list.children(':selected').attr('runner_target', $(this).val());
        });
        var runner_cwd = $('#brackets-nodejs-integration-runner-cwd').on('change', function () {
            runner_list.children(':selected').attr('runner_cwd', $(this).val());
        });
        var runner_flags = $('#brackets-nodejs-integration-additional-flags-for-setting').on('change', function () {
            runner_list.children(':selected').attr('runner_flags', $(this).val());
        });
        var runner_list = $('#brackets-nodejs-integration-runner-list')
            .change(function () {
                var selected_runner = $(this).children(':selected');
                runner_name.val(selected_runner.html());
                runner_type.val(selected_runner.attr('runner_type'));
                runner_target.val(selected_runner.attr('runner_target'));
                runner_cwd.val(selected_runner.attr('runner_cwd'));
                runner_flags.val(selected_runner.attr('runner_flags'));
            });

        var configurations = prefs.get('configurations');
        _.each(configurations, function (configuration) {
            var option = $(document.createElement('option'))
                .html(configuration.name)
                .attr('runner_type', configuration.type)
                .attr('runner_target', configuration.target)
                .attr('runner_cwd', configuration.cwd)
                .attr('runner_flags', configuration.flags);
            runner_list.append(option);
        });

        var first_runner = runner_list.find('option:first').attr('selected', true);
        runner_name.val(first_runner.html());
        runner_type.val(first_runner.attr('runner_type'));
        runner_target.val(first_runner.attr('runner_target'));
        runner_cwd.val(first_runner.attr('runner_cwd'));
        runner_flags.val(first_runner.attr('runner_flags'));

        $('#brackets-nodejs-integration-runner-add-btn').on('click', function () {
            runner_name.val('');
            runner_type.val('node');
            runner_target.val('');
            runner_cwd.val('');
            var option = $(document.createElement('option'))
                .html('')
                .attr('runner_type', 'node')
                .attr('runner_target', '')
                .attr('runner_cwd', '')
                .attr('runner_flags', '');
            runner_list.append(option);
            runner_list.find('option:last').attr('selected', true);
        });

        $('#brackets-nodejs-integration-runner-remove-btn').on('click', function () {
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
            runner_flags.val(next_runner.attr('runner_flags'));
        });
        $('#brackets-nodejs-integration-runner-target-open-btn').on('click', function () {
            var selected_runner = runner_list.find('option:selected');
            var init_folder = selected_runner.attr('runner_target').replace(/([ ])/g, '\\$1');
            if (!file_system.isAbsolutePath(init_folder)) {
                init_folder = selected_runner.attr('runner_cwd').replace(/([ ])/g, '\\$1');
            }
            if (_.endsWith(init_folder, '.js')) {
                init_folder = init_folder.substring(0, init_folder.lastIndexOf('/')).substring(0, init_folder.lastIndexOf('\\'));
            }
            file_system.showOpenDialog(false, selected_runner.attr('runner_type') === 'mocha', strings.CHOOSE_TARGET, init_folder, [], function (error, target_list) {
                if (error) {
                    console.error(error);
                }
                if (target_list && target_list.length > 0) {
                    if (selected_runner.attr('runner_type') === 'npm' && !_.endsWith(target_list[0], 'package.json')) {
                        return;
                    }
                    if (selected_runner.attr('runner_type') === 'gulp' && !_.endsWith(target_list[0], 'gulpfile.js')) {
                        return;
                    }
                    runner_target.val(target_list[0]);
                    selected_runner.attr('runner_target', target_list[0]);
                }
            });
        });
        $('#brackets-nodejs-integration-runner-cwd-open-btn').on('click', function () {
            var selected_runner = runner_list.find('option:selected');
            var init_folder = selected_runner.attr('runner_cwd').replace(/([ ])/g, '\\$1');
            file_system.showOpenDialog(false, true, strings.CHOOSE_WORKINGS_DIRECTORY, init_folder, null, function (error, target_list) {
                if (error) {
                    console.error(error);
                }
                if (target_list && target_list.length > 0) {
                    runner_cwd.val(target_list[0]);
                    selected_runner.attr('runner_cwd', target_list[0]);
                }
            });
        });
    };
});
