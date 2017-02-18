# Brackets - NodeJS integration

[![GitHub stars](https://img.shields.io/github/stars/yacut/brackets-nodejs-integration.svg)](https://github.com/yacut/brackets-nodejs-integration/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/yacut/brackets-nodejs-integration.svg)](https://github.com/yacut/brackets-nodejs-integration/network)
[![GitHub license](https://img.shields.io/npm/l/brackets-nodejs-integration.svg)](https://raw.githubusercontent.com/yacut/brackets-nodejs-integration/master/LICENSE)
[![GitHub issues](https://img.shields.io/github/issues/yacut/brackets-nodejs-integration.svg)](https://github.com/yacut/brackets-nodejs-integration/issues)	

Brackets - NodeJS integration is an extension for [Brackets](http://brackets.io/) editor - it provides Nodejs and Mocha integration for Brackets.
It's tested and works on any platform supported by Brackets (Windows, Mac OS X, GNU/Linux).

## Installation

#### Dependencies:
To make **Brackets - NodeJS integration** work you'll need nodejs, npm and mocha installed in your system:

- **Windows**: [Nodejs and NPM for Windows](https://nodejs.org/en/download/)
- **Mac OS X**: [Nodejs and NPM for Mac](https://nodejs.org/en/download/package-manager/#osx)
- **GNU/Linux**: [Nodejs and NPM for Debian/Ubuntu](https://nodejs.org/en/download/package-manager/#debian-and-ubuntu-based-linux-distributions)

#### Extension installation:

Use [brackets-npm-registry](https://github.com/zaggino/brackets-npm-registry)

#### Configuration:
Extension can be configured by opening the `NodeJS integration` Panel and clicking the *Open settings* button.

## Features and limitations

Currently **Brackets - NodeJS integration** supports these features (this list may be incomplete as we add new features regularly):

- Run multiple nodejs processes inside editor with console output (actual limit is only 5 processes, because brackets connections limitation)
- Run current NodeJS file (Ctrl-Shift-N)
- Run current NodeJS project (Ctrl-Shift-P)
- Run current Mocha test (Ctrl-Shift-T)
- Run npm scripts
- Run gulp scripts
- Run mocha test inside editor with tree view results
- Open file via mouse click from error stack
- Show Actual/Expected difference for mocha test
- Double click on mocha test case to open file with it
- *Jump to require* command uses "Jump to declaration" and opens required file (Ctrl-Shift-J or Cmd-Shift-J)
- Code hints for require: actual directory content, NodeJS built-in libs and project packages from package.json (use Ctrl-Space or Cmd-Space while require)
- NodeJS and Mocha debugger integration (based on [TheBenji](https://github.com/TheBenji/brackets-node-debugger) work)

## Some screenshots:

![main](https://github.com/yacut/brackets-nodejs-integration/raw/master/screenshots/main.png)  
*Main panel of NodeJS integration - run nodejs process*

![mocha](https://github.com/yacut/brackets-nodejs-integration/raw/master/screenshots/mocha.png)  
*Main panel of NodeJS integration - run mocha test*

![goto_error](https://github.com/yacut/brackets-nodejs-integration/raw/master/screenshots/goto_error.png)  
*Main panel of NodeJS integration - quick open error file*

![require_hints](https://github.com/yacut/brackets-nodejs-integration/raw/master/screenshots/require_hints.png)  
*RequireJS - Show hints while `require`*

![asert_diff](https://github.com/yacut/brackets-nodejs-integration/raw/master/screenshots/asert_diff.png)  
*Mocha test result - Show asert difference*

![settings](https://github.com/yacut/brackets-nodejs-integration/raw/master/screenshots/settings.png)  
*Settings dialog*


## How to use debugger

- Start your script in debug mode
- Use the Buttons to _Step over_, _Step in_, _Step out_ or to _continue_ the script execution.
- Click on a line number to set/remove a Breakpoint and use the console to get an variable for the current scope.
- Use the arrow keys to browse through the history.

## In this project used

- [extension registry](https://brackets-registry.aboutweb.com/)
- [http://fontawesome.io/](http://fontawesome.io/)
- [https://github.com/caolan/async](https://github.com/caolan/async)
