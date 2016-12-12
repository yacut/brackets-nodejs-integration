/*global define, brackets */

'use strict';

/**
 * parse key words in settings
 *
 * keywords :
 *   {project_root} - the full path of the root folder opened in Brackets now
 *   {file} - the full path of a folder contains the current file
 *   ...
 */
define(function main(require, exports) {
    var project_manager = brackets.getModule('project/ProjectManager');
    var editor_manager = brackets.getModule('editor/EditorManager');

    var parsers = {
        project_root: function () {
            return project_manager.getProjectRoot().fullPath.replace(/(\\|\/)$/, '');
        },
        file: function () {
            var ae = editor_manager.getActiveEditor();

            return ae ? ae.getFile().parentPath.replace(/(\\|\/)$/, '') : '';
        }
    };

    var pattern = /\{[a-z0-9_]+\}/g;

    /**
     * parser keywords
     * @param {string} value - a value of a settings' item
     * @return {string} the value after replacing keywords
     */
    exports.parse = function (value) {
        var kws = value.match(pattern) || [];
        kws = kws.map(function (d) {
            var kw = d.replace(/\{|\}/g, '');
            var pf = parsers[kw];
            return pf ? pf() : d;
        });

        var result = [], parts = value.split(pattern);
        for (var i=0; i<parts.length; i++) {
            result.push(parts[i]);
            result.push(kws[i] || '');
        }

        return result.join('');
    }

});
