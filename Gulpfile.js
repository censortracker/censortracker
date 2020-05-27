"use strict";

let gulp = require("gulp");
let del = require("del");
let uglify = require("gulp-uglify-es").default;
let cleancss = require("gulp-clean-css");


gulp.task('clean', function () {
    return del('dist/', {force: true});
});

gulp.task("minify-js", function () {
    return gulp.src(["src/chrome/src/*.js", "src/js/*/*.js"])
        .pipe(uglify())
        .pipe(gulp.dest("dist/js/"));
});

gulp.task("copy-js", function () {
    return gulp.src(["src/chrome/src/js/*/*.js", "src/js/*/*.js"])
        .pipe(gulp.dest("dist/js/"));
});


gulp.task("copy-html", function () {
    return gulp.src(["src/chrome/src/*/*.html"])
        .pipe(gulp.dest("dist/"));
});

gulp.task("copy-images", function () {
    return gulp.src(["src/chrome/src/images/*.*"])
        .pipe(gulp.dest("dist/images/"));
});

gulp.task("copy-manifest", function () {
    return gulp.src(["src/chrome/src/manifest.json"])
        .pipe(gulp.dest("dist/"));
});


gulp.task("minify-css", () => {
    return gulp.src(["src/chrome/src/css/*.css"])
        .pipe(cleancss())
        .pipe(gulp.dest("dist/css"));
});

gulp.task("dist", gulp.series("clean", "minify-js", "copy-html", "minify-css", "copy-images", "copy-manifest"));
gulp.task("build", gulp.series("clean", "copy-js", "copy-html", "minify-css", "copy-images", "copy-manifest"));