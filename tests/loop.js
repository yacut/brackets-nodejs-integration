'use strict';
var message_count = 0;
var interval_id = setInterval(function () {
    message_count++;
    console.log('Message #', message_count);
    console.log('Brackets is a free open-source editor written in HTML, CSS, and JavaScript with a primary focus on Web Development. \n' +
        'It was created by Adobe Systems, licensed under the MIT License, and is currently maintained on GitHub. \n' +
        'Brackets is available for cross-platform download on Mac, Windows, and Linux.');
}, 10);

setTimeout(function () {
    clearInterval(interval_id);
    process.exit(1);
}, 5000);
