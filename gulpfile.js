const gulp = require('gulp');
const isparta = require('isparta');
const mocha = require('gulp-mocha');
const eslint = require('gulp-eslint');
const istanbul = require('gulp-istanbul');

const sourcesPath = 'src/**/*.js';
const unitTestsReportPath = 'build/unit';
const unitTestsPath = 'test/unit/**/*.js';

/**
 * Linting (via ESLint)
 */
gulp.task('lint', () =>
  gulp.src([sourcesPath, unitTestsPath])
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError())
);

/**
 * Unit testing (via Mocha)
 */
gulp.task('test', () =>
  gulp.src(unitTestsPath, { read: false })
    .pipe(mocha({ reporter: 'nyan' }))
);

gulp.task('test-watch', () => {
  gulp.watch([sourcesPath, unitTestsPath], gulp.series('test'));
});

/**
 * Unit testing with coverage (via Mocha and Istanbul)
 */
gulp.task('pre-test-cover', () =>
  gulp.src([sourcesPath])
    .pipe(istanbul({ includeUntested: true, instrumenter: isparta.Instrumenter }))
    .pipe(istanbul.hookRequire())
);

gulp.task('test-cover', gulp.series('pre-test-cover', () =>
  gulp.src([unitTestsPath])
    .pipe(mocha({
      reporter: 'mocha-jenkins-reporter',
      reporterOptions: { junit_report_path: `${unitTestsReportPath}/result.xml` },
    }))
    .pipe(istanbul.writeReports({ dir: `${unitTestsReportPath}/coverage` }))
));

/**
 * Bundled tasks
 */
gulp.task('default', gulp.series(['lint', 'test']));
