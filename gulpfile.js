'use strict';
const gulp = require('gulp');
const eslint = require('gulp-eslint');

gulp.task('default', ['lint']);
gulp.task('lint', function () {
  return gulp.src(['**/*.js', '!node_modules/**/*', '!thirdparty/**.*', '!debugger/thirdparty/**.*'])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});
