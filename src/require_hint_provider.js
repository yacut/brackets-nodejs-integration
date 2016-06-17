/*global $, define, brackets */

'use strict';
define(function (require, exports, module) {

    var _ = brackets.getModule('thirdparty/lodash');
    var file_system = brackets.getModule('filesystem/FileSystem');
    var file_utils = brackets.getModule('file/FileUtils');
    var project_manager = brackets.getModule('project/ProjectManager');

    var strings = require('strings');

    var node_builtin_libs = ['assert', 'buffer', 'child_process', 'cluster',
                             'crypto', 'dgram', 'dns', 'domain', 'events',
                             'fs', 'http', 'https', 'net', 'os', 'path',
                             'punycode', 'querystring', 'readline', 'repl',
                             'stream', 'string_decoder', 'tls', 'tty', 'url',
                             'util', 'v8', 'vm', 'zlib'];

    function RequireHintProvider() {
        this.hints = [];
    }

    RequireHintProvider.prototype.hasHints = function (editor) {
        var that = this;
        that.editor = editor;
        that.hints = [];
        that.match = '';
        var cursor_position = that.editor.getCursorPos();
        var current_document = that.editor.document;
        if (!current_document || !cursor_position) {
            return false;
        }
        var current_line_position = cursor_position.line;
        var current_line = that.editor._codeMirror.doc.getLine(current_line_position).slice(0, cursor_position.ch);
        current_line = current_line.replace(/ /g, '');
        var matched_require_strings = current_line.match(/require\(['"].*/g);
        var end_of_require_strings = current_line.match(/require\(['"].*['"]/g);

        if (!matched_require_strings || matched_require_strings.length === 0) {
            return false;
        }
        if (end_of_require_strings && end_of_require_strings.length > 0) {
            return false;
        }

        var project_root = project_manager.getProjectRoot();
        if (project_root) {
            var npm_file_path = project_root.fullPath + 'package.json';
            $.getJSON(npm_file_path, function (npm_json) {
                that.dependencies = npm_json.dependencies;
                that.packages_names = _.keys(npm_json.dependencies);
            });
        }

        return true;
    };

    RequireHintProvider.prototype.insertHint = function (completion) {
        var cursor = this.editor.getCursorPos();
        var hint_value = completion.find('.require-hint-value').text();
        this.editor.document.replaceRange(hint_value, cursor);
        return false;
    };

    RequireHintProvider.prototype.getHints = function () {
        var that = this;
        return $.Deferred(function () {
            var self = this;
            that.hints = [];
            that.match = '';
            var cursor_position = that.editor.getCursorPos();
            var current_document = that.editor.document;

            if (!current_document || !cursor_position) {
                return self.resolve({
                    hints: that.hints,
                    match: null,
                    selectInitial: true,
                    handleWideResults: false
                });
            }

            var current_line_position = cursor_position.line;
            var current_line = that.editor._codeMirror.doc.getLine(current_line_position).slice(0, cursor_position.ch);
            current_line = current_line.replace(/ /g, '');
            var end_of_require_strings = current_line.match(/require\(['"].*['"]/g);
            if (end_of_require_strings && end_of_require_strings.length > 0) {
                return self.resolve({
                    hints: that.hints,
                    match: null,
                    selectInitial: true,
                    handleWideResults: false
                });
            }
            var matched_require_strings = current_line.match(/require\(['"].*/g);
            if (!matched_require_strings || matched_require_strings.length === 0) {
                return self.resolve({
                    hints: that.hints,
                    match: null,
                    selectInitial: true,
                    handleWideResults: false
                });
            }
            var splited_match = matched_require_strings[0].split(/['"]/);
            var relative_path_full = splited_match[1];
            var relative_path = '';
            if (relative_path_full && relative_path_full.lastIndexOf('/') !== -1) {
                relative_path = relative_path_full.slice(0, relative_path_full.lastIndexOf('/'));
                that.match = relative_path_full.slice(relative_path_full.lastIndexOf('/') + 1);
            }
            else {
                that.match = relative_path_full;
            }

            var current_file = that.editor.getFile().fullPath;
            var current_folder_path = file_utils.getDirectoryPath(current_file);
            var current_folder = file_system.getDirectoryForPath(current_folder_path);
            if (!file_system.isAbsolutePath(current_folder.fullPath + relative_path)) {
                return self.resolve({
                    hints: that.hints,
                    match: null,
                    selectInitial: true,
                    handleWideResults: false
                });
            }
            file_system.resolve(current_folder.fullPath + relative_path, function (error, full_path) {
                if (error) {
                    return self.resolve({
                        hints: that.hints,
                        match: null,
                        selectInitial: true,
                        handleWideResults: false
                    });
                }
                file_system.getDirectoryForPath(full_path.fullPath).getContents(function (get_contents_error, contents) {
                    if (get_contents_error) {
                        return self.resolve({
                            hints: that.hints,
                            match: null,
                            selectInitial: true,
                            handleWideResults: false
                        });
                    }
                    if (!contents || !contents.length > 0) {
                        return self.resolve({
                            hints: that.hints,
                            match: null,
                            selectInitial: true,
                            handleWideResults: false
                        });
                    }

                    if (that.match === '' || that.match === '.') {
                        that.hints.push(create_hint('./', that.match, strings.DIRECTORY, strings.DIRECTORY, strings.CURRENT_DIRECTORY));
                    }
                    if (that.match === '' || that.match === '.' || that.match === '..') {
                        that.hints.push(create_hint('../', that.match, strings.DIRECTORY, strings.DIRECTORY, strings.PARENT_DIRECTORY));
                    }

                    _.each(contents, function (content) {
                        if (that.match === '' || content.name.startsWith(that.match)) {
                            if (content.isDirectory) {
                                that.hints.push(create_hint(content.name + '/', that.match, strings.DIRECTORY, strings.DIRECTORY, '', ''));
                            }
                            else if (content.name.endsWith('.js')) {
                                that.hints.push(create_hint(content.name.substr(0, content.name.lastIndexOf('.')) || content.name, that.match, strings.FILE, strings.FILE, content.name));
                            }
                            else if (content.name.endsWith('.json')) {
                                that.hints.push(create_hint(content.name, that.match, strings.FILE, strings.FILE, content.name));
                            }
                        }
                    });

                    if (relative_path === '') {
                        _.each(that.packages_names, function (package_name) {
                            if (that.match === '' || package_name.startsWith(that.match)) {
                                var link_to_registry = 'https://www.npmjs.com/package/' + package_name;
                                that.hints.push(create_hint(package_name, that.match, strings.PACKAGE, strings.PACKAGE, that.dependencies[package_name], link_to_registry));
                            }
                        });

                        _.each(node_builtin_libs, function (builtin_lib_name) {
                            if (that.match === '' || builtin_lib_name.startsWith(that.match)) {
                                var link_to_descrition = 'https://nodejs.org/api/' + builtin_lib_name + '.html';
                                that.hints.push(create_hint(builtin_lib_name, that.match, strings.BUILT_IN_LIB, strings.BUILT_IN_LIB, '', link_to_descrition));
                            }
                        });
                    }

                    self.resolve({
                        hints: that.hints,
                        match: null,
                        selectInitial: true,
                        handleWideResults: false
                    });
                });
            });
        });
    };

    /**
     * Create code hint link with details
     * @param {string} value
     * @param {string} match
     * @param {string} type
     * @param {string} title
     * @param {string} link
     */
    function create_hint(value, match, type, title, description, link) {
        var $hint = $(document.createElement('span'));
        $hint.addClass('brackets-js-hints brackets-js-hints-with-type-details');
        $hint.attr('title', title);
        if (match) {
            value = value.replace(match, '');
            $hint.append($(document.createElement('span')).text(match).addClass('matched-hint'));
            $hint.append($(document.createElement('span')).text(value).addClass('require-hint-value'));
        }
        else {
            $hint.append($(document.createElement('span')).text(value).addClass('require-hint-value'));
        }
        if (link) {
            $hint.append($(document.createElement('a')).addClass('jshint-link').attr('href', link));
        }
        $hint.append($(document.createElement('span')).text(type).addClass('brackets-js-hints-type-details'));
        $hint.append($(document.createElement('span')).text(type).addClass('jshint-description'));
        if (description) {
            $hint.append($(document.createElement('span')).text(description).addClass('jshint-jsdoc'));
        }

        return $hint;
    }

    module.exports = RequireHintProvider;
});
