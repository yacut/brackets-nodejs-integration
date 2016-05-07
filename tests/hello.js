'use strict';

console.log('Hello World');
console.log('Secound line');
console.log('Third');

if (process.env.npm_package_name) {
    console.log('I am %s', process.env.npm_package_name);
}
console.log(process.execPath);

var colors = {
    black: '\u001b[30m',
    red: '\u001b[31m',
    green: '\u001b[32m',
    yellow: '\u001b[33m',
    blue: '\u001b[34m',
    magenta: '\u001b[35m',
    white: '\u001b[37m',
    grey: '\u001b[90m',
    reset: '\u001b[0m'
};
var foo = 5;

console.log(colors.red + 'This is red' + colors.reset + ' while ' + colors.blue + 'this is blue' + colors.reset);
console.log(colors.green + 'hello green color' + colors.reset);
console.error(new Error('wtf error'));
console.log(colors.white + 'Hello World' + colors.reset);
console.log(colors.grey + 'Hello World' + colors.reset);
console.log(colors.black + 'Hello World' + colors.reset);
console.log(colors.yellow + 'Hello World' + colors.reset);
console.log(colors.magenta + 'Hello World' + colors.reset);

process.exit(3);
