/*global brackets*/

'use strict';
define(function main(require, exports) {

    var _ = brackets.getModule('thirdparty/lodash');
    var command_manager = brackets.getModule('command/CommandManager');
    var commands = brackets.getModule('command/Commands');
    var code_hint_manager = brackets.getModule('editor/CodeHintManager');
    var editor_manager = brackets.getModule('editor/EditorManager');
    var file_system = brackets.getModule('filesystem/FileSystem');
    var file_utils = brackets.getModule('file/FileUtils');
    var menus = brackets.getModule('command/Menus');
    var project_manager = brackets.getModule('project/ProjectManager');

    var Require_hint_provider = require('src/require_hint_provider');

    var strings = require('strings');

    var JUMP_TO_REQUIRE_COMMAND_ID = 'brackets-nodejs-integration.go-to-require';

    var editor_context_menu = menus.getContextMenu(menus.ContextMenuIds.EDITOR_MENU);
    exports.init = function () {
        code_hint_manager.registerHintProvider(new Require_hint_provider(), ['javascript'], 1);

        command_manager.register(strings.JUMP_TO_REQUIRE, JUMP_TO_REQUIRE_COMMAND_ID, function () {
            function go_to_require(current_editor, current_line, search_name) {
                var matched_require_strings = current_line.match(/require[\s+]?\(['"].*['"]\)/g);
                if (matched_require_strings && matched_require_strings.length > 0) {
                    var splited_match = matched_require_strings[0].split(/['"]/);
                    var relative_path = splited_match[1];
                    if (!relative_path) {
                        return;
                    }
                    var current_file = current_editor.getFile().fullPath;
                    var current_folder = file_utils.getDirectoryPath(current_file);
                    var project_root = project_manager.getProjectRoot().fullPath;
                    var project_file_match = relative_path.match(/[\/\\]/);
                    if (project_file_match && project_file_match.length > 0) {
                        if (_.startsWith(relative_path, './')) {
                            relative_path = relative_path.slice(2);
                        }
                        if (_.endsWith(relative_path, '/')) {
                            open_file(current_folder + relative_path + 'index.js', search_name);
                        }
                        else if (!_.endsWith(relative_path, '.js') && !_.endsWith(relative_path, '.json')) {
                            if (!open_file(current_folder + relative_path + '.js', search_name)) {
                                open_file(current_folder + relative_path + '/index.js', search_name);
                            }
                        }
                        else {
                            open_file(current_folder + relative_path, search_name);
                        }
                    }
                    else {
                        if (try_open_npm_package_source(project_root, relative_path, search_name)) {
                            return;
                        }
                        if (try_open_npm_package_source(current_folder, relative_path, search_name)) {
                            return;
                        }
                        var parent_directory = current_folder;
                        var is_source_file_opened = false;
                        while (!is_source_file_opened && parent_directory !== '') {
                            parent_directory = file_utils.getParentPath(parent_directory);
                            if (parent_directory) {
                                is_source_file_opened = try_open_npm_package_source(parent_directory, relative_path, search_name);
                            }
                        }
                    }
                }
            }

            function find_name_in_editor(name) {
                var editor = editor_manager.getCurrentFullEditor();
                var text = editor.document.getText();
                var lines = text.split(/\n/);
                var line_index = -1;
                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    var found_at = line.indexOf(name);
                    if (found_at >= 0) {
                        var string_before = line.substr(0, found_at);
                        var string_after = line.substr(found_at + name.length);
                        var word_before_match = string_before.match(/[\w\d_=]+/g);
                        var word_before = word_before_match ? word_before_match.pop() : '';
                        var word_after_match = string_after.match(/[\w\d_=\(]+/g);
                        var word_after = word_after_match ? word_after_match.shift() : '';
                        if ((word_before === 'exports' && word_after === '=') ||
                            (word_before === 'prototype' && word_after === '=') ||
                            (word_before === 'function' && word_after === '(')) {
                            line_index = i;
                        }
                    }
                }
                if (line_index !== -1) {
                    editor.setCursorPos(line_index, 0, true, false);
                    editor._codeMirror.setSelection({
                        line: line_index,
                        ch: 0
                    }, {
                        line: line_index,
                        ch: null
                    });
                }
            }

            function open_file(path, search_name) {
                file_system.resolve(path, function (error, full_path_to_file) {
                    if (error) {
                        return false;
                    }
                    command_manager.execute(commands.FILE_OPEN, {
                            fullPath: full_path_to_file._path
                        })
                        .done(function () {
                            find_name_in_editor(search_name);
                            return true;
                        });
                });
            }

            function try_open_npm_package_source(directory, package_name, search_name) {
                if (open_file(directory + 'node_modules/' + package_name + '.js', search_name)) {
                    return true;
                }
                if (open_file(directory + 'node_modules/' + package_name + '/index.js', search_name)) {
                    return true;
                }
                if (open_file(directory + 'node_modules/' + package_name + '/' + package_name + '.js', search_name)) {
                    return true;
                }
                if (open_file(directory + 'node_modules/' + package_name + '/dist/' + package_name + '.js', search_name)) {
                    return true;
                }
                if (open_file(directory + 'node_modules/' + package_name + '/lib/' + package_name + '.js', search_name)) {
                    return true;
                }
                return false;
            }

            var current_editor = editor_manager.getCurrentFullEditor();
            if (current_editor.getModeForSelection() !== 'javascript') {
                return null;
            }
            var cursor_position = current_editor.getCursorPos();
            var current_line_position = cursor_position.line;
            var current_line = current_editor._codeMirror.doc.getLine(current_line_position);
            var search_name = current_editor._codeMirror.getTokenAt(cursor_position, true).string;
            if (!/\S/.test(search_name) || search_name === '.') {
                search_name = current_editor._codeMirror.getTokenAt({
                    line: cursor_position.line,
                    ch: cursor_position.ch + 1
                }, true).string;
            }
            if (!search_name) {
                return;
            }
            var current_string_from_start_to_cursor = current_line.substr(0, cursor_position.ch);
            var variable_name;
            var char_before_search_name;
            var words_before_cursor = current_string_from_start_to_cursor.match(/[\w\d_]+/g);
            if (words_before_cursor.length > 0) {
                words_before_cursor.pop();
                variable_name = _.last(words_before_cursor);
                if (variable_name) {
                    char_before_search_name = current_string_from_start_to_cursor.substr((current_string_from_start_to_cursor.lastIndexOf(variable_name) + variable_name.length), 1);
                }
            }
            if (char_before_search_name === '.' && variable_name) {
                current_editor.setCursorPos({
                    line: current_line_position,
                    ch: current_line.lastIndexOf(variable_name + '.' + search_name)
                });
            }
            command_manager.execute(commands.NAVIGATE_JUMPTO_DEFINITION, current_editor).done(function () {
                cursor_position = current_editor.getCursorPos();
                current_line_position = cursor_position.line;
                current_line = current_editor._codeMirror.doc.getLine(current_line_position);
                setTimeout(function () {
                    go_to_require(current_editor, current_line, search_name);
                }, 300);
            }).fail(function () {
                go_to_require(current_editor, current_line, search_name);
            });
        });
        editor_context_menu.addMenuItem(JUMP_TO_REQUIRE_COMMAND_ID);
    };
});
