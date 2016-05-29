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

    exports.show_popup_message = function (message) {
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
        setTimeout(function () {
            if (_$indicator.data('twipsy')) {
                _$indicator.twipsy('hide').removeData('twipsy');
            }
        }, 5000);
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
