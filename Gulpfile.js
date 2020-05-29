'use strict'

const gulp = require('gulp')
const del = require('del')
const uglify = require('gulp-uglify-es').default
const cleancss = require('gulp-clean-css')
const concat = require('gulp-concat')
const jsonEditor = require('gulp-json-editor')
const jsonFormat = require('gulp-json-format')
const argv = require('yargs').argv

const VERSION = argv.version || '0.1.2'
const BG_SCRIPT_NAME = argv.bg || 'core.min.js'

gulp.task('clean', function () {
  return del('dist/', { force: true })
})

gulp.task('concat-core-scripts', function () {
  // Order truly matters
  return gulp.src([
    'src/chrome/js/core/settings.js',
    'src/chrome/js/core/database.js',
    'src/chrome/js/core/sessions.js',
    'src/chrome/js/core/shortcuts.js',
    'src/chrome/js/core/registry.js',
    'src/chrome/js/core/proxies.js',
    // 'src/chrome/js/core/background.js'
  ])
    .pipe(concat(BG_SCRIPT_NAME))
    .pipe(uglify())
    .pipe(gulp.dest('dist/js/core/'))
})

gulp.task('copy-third-party-scripts', function () {
  return gulp.src(['src/chrome/js/*/*.js', 'src/chrome/js/core/background.js', 'src/chrome/js/core/*.js'])
    .pipe(gulp.dest('dist/js/'))
})

gulp.task('copy-assets', function () {
  return gulp.src(['src/chrome/*/*.html', 'src/chrome/*/*.png', 'src/chrome/*/*.css'])
    .pipe(gulp.dest('dist/'))
})

gulp.task('copy-manifest', function () {
  return gulp.src(['src/chrome/manifest.json'])
    .pipe(jsonEditor(function (json) {
      json.version = VERSION
      return json
    }))
    .pipe(jsonFormat(2))
    .pipe(gulp.dest('dist/'))
})

gulp.task('minify-css', () => {
  return gulp.src(['src/chrome/css/*.css'])
    .pipe(cleancss())
    .pipe(gulp.dest('dist/css'))
})

gulp.task(
  'dist', gulp.series(
    'clean',
    // 'concat-core-scripts',
    'copy-third-party-scripts',
    'copy-assets',
    'copy-manifest')
)
