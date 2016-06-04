'use strict';
(function (root, factory) {
    if (typeof exports === 'object') {
        module.exports = factory();
    }
    else if (typeof define === 'function' && define.amd) {
        define([], factory);
    }
    else {
        root.QueueManager = factory();
    }
}(this, function () {
    function extend(object) {
        var args = Array.prototype.slice.call(arguments, 1);
        for (var i = 0, source; source = args[i]; i++) {
            if (!source) {
                continue;
            }
            for (var property in source) {
                if ({}.hasOwnProperty.call(source, property)) {
                    object[property] = source[property];
                }
            }
        }
        return object;
    }
    var QueueManager = (function () {
        function QueueManager(settings) {
            this.version = '1.0';
            var defaults = {
                delay: 100,
                batch: 1,
                callback: null,
                complete: null,
                paused: false,
                queue: []
            };
            this.options = extend({}, defaults, settings);
            this.queue = this.options.queue;
            this.paused = this.options.paused;
            this.recent = [];
            this.timeoutId = null;
            this.cleared = false;

            if (!this.paused) {
                this.start();
            }
        }

        QueueManager.prototype.each = function (args) {
            var that = this;
            this.onEach = args;
            return that;
        };

        QueueManager.prototype.complete = function (args) {
            var that = this;
            that.onComplete = args;
            return that;
        };

        QueueManager.prototype.add = function (item, priority) {
            var that = this;
            return that.addEach([item], priority);
        };

        QueueManager.prototype.addEach = function (items, priority) {
            var that = this;
            if (items) {
                that.cleared = false;
                that.queue = priority ? items.concat(that.queue) : that.queue.concat(items);
                if (!that.paused) {
                    that.start();
                }
            }
            return that;
        };

        QueueManager.prototype.start = function () {
            var that = this;
            this.paused = false;
            if (this.size() && !this.timeoutId && !this.recent.length) {
                (function loopy() {
                    var delay = that.options.delay;
                    var batch = that.options.batch;
                    var complete = that.options.complete || that.onComplete;
                    var callback = that.options.callback || that.onEach;
                    that.stop();
                    if (!that.size()) {
                        that.cleared = true;
                        if (complete) {
                            complete.apply(that);
                        }
                        return that;
                    }
                    that.recent = that.queue.splice(0, batch);

                    if (callback && callback.apply(that, [(batch === 1 ? that.recent[0] : that.recent)]) === true) {
                        that.queue = that.recent.concat(that.queue);
                        that.recent = [];
                    }

                    if (typeof delay === 'number' && delay >= 0) {
                        that.recent = [];
                        that.timeoutId = setTimeout(loopy, delay);
                    }
                })();
            }
            return that;
        };

        QueueManager.prototype.next = function (retry) {
            var that = this;
            var complete = that.options.complete || that.onComplete;

            if (retry) {
                that.queue = that.recent.concat(that.queue);
            }

            that.recent = [];

            if (that.size()) {
                that.start();
            }
            else if (!that.cleared) {
                that.cleared = true;
                if (complete) {
                    complete.apply(that);
                }
            }
        };

        QueueManager.prototype.clear = function () {
            var that = this;
            var result = that.queue;
            that.stop();
            that.queue = [];
            that.cleared = true;
            that.recent = [];
            return result;
        };

        QueueManager.prototype.pause = function () {
            var that = this;
            that.stop();
            that.paused = true;
            return that;
        };

        QueueManager.prototype.update = function (opts) {
            var that = this;
            extend(that.options, opts);
            return that;
        };

        QueueManager.prototype.size = function () {
            var that = this;
            return that.queue.length;
        };

        QueueManager.prototype.indexOf = function (item) {
            var that = this;
            return that.queue.indexOf(item);
        };

        QueueManager.prototype.stop = function () {
            var that = this;
            if (that.timeoutId) {
                clearTimeout(that.timeoutId);
                that.timeoutId = undefined;
            }
            return that;
        };

        QueueManager.prototype.getVersion = function () {
            return this.version;
        };

        return QueueManager;
    }());

    return QueueManager;
}));
