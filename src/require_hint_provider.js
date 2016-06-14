/*global $, define, brackets */

'use strict';
define(function (require, exports, module) {
    var file_system = brackets.getModule('filesystem/FileSystem');
    var file_utils = brackets.getModule('file/FileUtils');

    var strings = require('strings');

    function RequireHintProvider() {
        this.hints = [];
    }

    RequireHintProvider.prototype.hasHints = function (editor) {
        var that = this;
        that.editor = editor;
        return true;
    };

    RequireHintProvider.prototype.insertHint = function (completion) {
        // TODO fix case when match
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

            var matched_require_strings = current_line.match(/require[\s+]?\(['"].*/g);
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
                    if (that.match === '') {
                        var $this_directory = $(document.createElement('span'));
                        $this_directory.addClass('directory');
                        $this_directory.append($(document.createElement('span')).text('./').addClass('require-hint-value'));
                        $this_directory.append($(document.createElement('i')).text(strings.DIRECTORY).addClass('require-hint'));
                        that.hints.push($this_directory);

                        var $parent_directory = $(document.createElement('span'));
                        $parent_directory.addClass('directory');
                        $parent_directory.append($(document.createElement('span')).text('../').addClass('require-hint-value'));
                        $parent_directory.append($(document.createElement('i')).text(strings.DIRECTORY).addClass('require-hint'));
                        that.hints.push($parent_directory);
                    }

                    contents.forEach(function (content) {
                        if (that.match === '' || content.name.startsWith(that.match)) {
                            var $hint = $(document.createElement('span'));
                            if (content.isDirectory) {
                                $hint.addClass('directory');
                                $hint.append($(document.createElement('span')).text(content.name + '/').addClass('require-hint-value'));
                                $hint.append($(document.createElement('i')).text(strings.DIRECTORY).addClass('require-hint'));
                            }
                            else if (content.name.endsWith('.js')) {
                                $hint.addClass('file');
                                $hint.append($(document.createElement('span')).text(content.name.substr(0, content.name.lastIndexOf('.')) || content.name).addClass('require-hint-value'));
                                $hint.append($(document.createElement('i')).text(strings.FILE).addClass('require-hint'));
                            }
                            else if (content.name.endsWith('.json')) {
                                $hint.addClass('file');
                                $hint.append($(document.createElement('span')).text(content.name).addClass('require-hint-value'));
                                $hint.append($(document.createElement('i')).text(strings.FILE).addClass('require-hint'));
                            }

                            that.hints.push($hint);
                        }
                    });
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

    module.exports = RequireHintProvider;
});
