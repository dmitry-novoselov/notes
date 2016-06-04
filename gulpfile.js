var gulp = require('gulp');

var replace = require('gulp-replace');
var rename = require("gulp-rename");
var watch = require('gulp-watch');
var concat = require('gulp-concat');

var uglify = require('gulp-uglify');
var sourcemaps = require('gulp-sourcemaps');

var browserSync = require('browser-sync').create();

gulp.task("default", function() {
    
});

// local build

var pathDest = "./LocalBuild";
var pathIndexCshtml = "./src/App/Views/App/MobileIndex.cshtml";
var pathClientBase = "./src/App/Client/";

var pathBlocksHtml =  pathClientBase + "/blocks/**/*.html";
var pathBlocksCss =  pathClientBase + "/blocks/**/*.css";

var pathLibScripts = pathClientBase + "/scripts/lib";

gulp.task("local", function() {
    gulp.src(pathIndexCshtml)
        .pipe(watch(pathIndexCshtml))
        .pipe(replace(/@using .*/g, ""))
        .pipe(replace(/@Styles.*/g, ""))
        .pipe(replace(/@Scripts\.Render\("~\/js\/lib"\)/, "<script src='/js/lib.js'></script>"))
        .pipe(replace(/@Scripts\.Render\("~\/js\/app"\)/, "<script src='/js/app.js'></script>"))
        .pipe(rename("index.html"))
        .pipe(gulp.dest(pathDest));

    gulp.src(pathBlocksHtml)
        .pipe(watch(pathBlocksHtml))
        .pipe(gulp.dest(pathDest + "/blocks"));

    gulp.src(pathBlocksCss)
        .pipe(watch(pathBlocksCss))
        .pipe(gulp.dest(pathDest + "/blocks"));

    gulp.src([
        pathLibScripts + "/jquery.min.js",
        pathLibScripts + "/bem-core.no-autoinit.js",
        pathLibScripts + "/handlebars.min.js"
    ])
        .pipe(concat("lib.js"))
        .pipe(gulp.dest(pathDest + "/js"));

    watch(pathClientBase + "/blocks/**/*.js", buildJs);
    watch(pathClientBase + "/scripts/**/*.js", buildJs);

    buildJs();

    browserSync.init({
        server: {
            baseDir: pathDest
        }
    });
});

function buildJs() {
    gulp.src([
        pathClientBase + "/scripts/api.js",
        pathClientBase + "/scripts/program/init.js",
        pathClientBase + "/blocks/**/*.js",
        pathClientBase + "/scripts/program/assemble.js"
    ])
        .pipe(sourcemaps.init())
        .pipe(concat("app.js"))
        .pipe(uglify())
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest(pathDest + "/js"))
}
