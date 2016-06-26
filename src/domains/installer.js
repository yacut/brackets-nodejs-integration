'use strict';
(function () {

    var DOMAIN_NAME = 'brackets-nodejs-integration-installer';
    var exec = require('child_process').exec;
    var _domainManager;
    var child;

    function install(npm_bin, cwd) {
        if (!npm_bin) {
            npm_bin = 'npm';
        }
        if (!cwd) {
            cwd = __dirname;
        }
        var out = '';
        child = exec(npm_bin + ' install', {
            cwd: cwd
        });
        child.stdout.on('data', function (data) {
            out += data;
        });
        child.stderr.on('data', function (data) {
            out += data;
        });
        child.on('exit', function (code) {
            _domainManager.emitEvent(DOMAIN_NAME, 'installation_completed', [code, out]);
        });
    }

    function init(domainManager) {
        _domainManager = domainManager;
        if (!domainManager.hasDomain(DOMAIN_NAME)) {
            domainManager.registerDomain(DOMAIN_NAME, {
                major: 0,
                minor: 1
            });
        }
        domainManager.registerCommand(
            DOMAIN_NAME,
            'install',
            install,
            false,
            'Calls npm install', [
                {
                    name: 'npm_bin',
                    type: 'string'
                },
                {
                    name: 'cwd',
                    type: 'string'
                }
            ]
        );
        domainManager.registerEvent(
            DOMAIN_NAME,
            'installation_completed', [{
                    name: 'code',
                    type: 'number',
                    description: 'Exit Code'
            },
                {
                    name: 'out',
                    type: 'string',
                    description: 'Out data from process'
            }]
        );
    }

    exports.init = init;
}());
