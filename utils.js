/*global brackets,$*/
'use strict';

define(function (require, exports) {

    var file_system = brackets.getModule('filesystem/FileSystem');

    exports.mkdirp = function (path) {
        var dir = file_system.getDirectoryForPath(path);
        var promise = $.Deferred();

        dir.exists(function (dir_exists_err, exists) {
            if (dir_exists_err) {
                console.error(dir_exists_err);
            }
            if (!exists) {
                var parentFolder = path.replace(/\/+\s*$/, '').split('/').slice(0, -1).join('/');
                exports.mkdirp(parentFolder).then(function () {
                        dir.create(function (err) {
                            if (err) {
                                promise.reject(err);
                            }
                            else {
                                promise.resolve();
                            }
                        });
                    })
                    .fail(function (err) {
                        promise.reject(err);
                    });
            }
            else {
                promise.resolve();
            }
        });

        return promise;
    };

    exports.create_file = function (file, content) {
        var promise = $.Deferred();
        file.write(content, {}, function (err) {
            if (err) {
                promise.reject(err);
            }
            else {
                promise.resolve();
            }
        });
        return promise;
    };

    function get_merge_view_height(merge_view) {
        function editorHeight(editor) {
            if (!editor) {
                return 0;
            }
            return editor.getScrollInfo().height;
        }
        return Math.max(editorHeight(merge_view.leftOriginal()),
            editorHeight(merge_view.editor()),
            editorHeight(merge_view.rightOriginal()));
    }

    exports.resize_merge_view = function (merge_view) {
        var height = get_merge_view_height(merge_view);
        for (;;) {
            if (merge_view.leftOriginal()) {
                merge_view.leftOriginal().setSize(null, height);
            }
            merge_view.editor().setSize(null, height);
            if (merge_view.rightOriginal()) {
                merge_view.rightOriginal().setSize(null, height);
            }

            var new_height = get_merge_view_height(merge_view);
            if (new_height >= height) {
                break;
            }
            else {
                height = new_height;
            }
        }
        merge_view.wrap.style.height = height + 'px';
    };

    exports.show_popup_message = function (message, disable_auto_hide) {
        var _$indicator = $('#brackets-nodejs-integration-runner-indicator');
        _$indicator.twipsy('hide').removeData('twipsy');
        var options = {
            placement: 'left',
            trigger: 'manual',
            autoHideDelay: 5000,
            title: function () {
                return message;
            }
        };
        _$indicator.twipsy(options).twipsy('show');
        if (!disable_auto_hide) {
            setTimeout(function () {
                if (_$indicator.data('twipsy')) {
                    _$indicator.twipsy('hide').removeData('twipsy');
                }
            }, 5000);
        }
    };

    exports.uuid = function () {
        function s4() {
            return Math.floor((1 + Math.random()) * 0x10000)
                .toString(16)
                .substring(1);
        }
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
            s4() + '-' + s4() + s4() + s4();
    };
});
