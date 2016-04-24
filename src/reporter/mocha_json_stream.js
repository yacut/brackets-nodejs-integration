'use strict';

var Base = require('mocha').reporters.Base;
var prefix = '###mocha_event_start###';
var postfix = '###mocha_event_end###';

exports = module.exports = json_reporter;

function json_reporter(runner) {
    Base.call(this, runner);

    var self = this;
    var total = runner.total;

    runner.on('start', function () {
        console.log(log_event(['start', {
            tests: total
        }]));
        //TODO register each test
    });

    runner.on('suite', function (suite) {
        console.log(log_event(['start_suite', clean(suite)]));
    });

    runner.on('test', function (test) {
        console.log(log_event(['start_test', clean(test)]));
    });

    runner.on('pending', function (test) {
        console.log(log_event(['pending_test', clean(test)]));
    });

    runner.on('pass', function (test) {
        console.log(log_event(['pass_test', clean(test)]));
    });

    runner.on('fail', function (test, err) {
        test = clean(test);
        test.err = err.message;
        test.stack = err.stack || null;
        test.actual = err.actual || null;
        test.expected = err.expected || null;
        /*test.actual = typeof err.actual === 'object' ? err.actual : null;
        test.expected = typeof err.expected === 'object' ? err.expected : null;*/
        console.log(log_event(['fail_test', test]));
    });

    runner.on('suite end', function (suite) {
        console.log(log_event(['end_suite', clean(suite)]));
    });

    runner.on('end', function () {
        process.stdout.write(log_event(['end', self.stats]));
    });
}

function clean(test) {
    var event_model = {
        title: test.title || null,
        duration: test.duration || null
    };
    try {
        event_model.fullTitle = test.fullTitle();
    } catch (err) {
        event_model.err = err.message;
        event_model.stack = err.stack || null;
    }
    return event_model;
}

function log_event(json_event_model) {
    return prefix +
        JSON.stringify(json_event_model) +
        postfix;
}
