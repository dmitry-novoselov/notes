var gulp = require('gulp');
var run = require('run-sequence');

var replace = require('gulp-replace');
var rename = require("gulp-rename");
var watch = require('gulp-watch');
var wrap = require('gulp-wrap');
var concat = require('gulp-concat');
var include = require('gulp-include');

var uglify = require('gulp-uglify');
var cleanCss = require('gulp-clean-css');
var sourcemaps = require('gulp-sourcemaps');

var browserSync = require('browser-sync').create();

// paths

var pathIndexCshtml = "./src/App/Views/App/MobileIndex.cshtml";
var pathClientBase = "./src/App/Client";

var pathBlocksHtml = pathClientBase + "/blocks/**/*.html";
var pathsCss = [
    pathClientBase + "/css/body.css",
    pathClientBase + "/blocks/**/*.css"
];

var pathLibScripts = pathClientBase + "/js/lib";
var pathScripts = [
    pathClientBase + "/js/render.js",
    pathClientBase + "/js/modules/**/*.js",
    pathClientBase + "/blocks/**/*.js"
];

// VS build

gulp.task("default", function () {
    run("concat-templates");
    watch(pathBlocksHtml, function () {
        run("concat-templates");
    });

    buildCss(pathClientBase);
    watchCss(pathClientBase);

    buildStaticJs(pathClientBase);
    buildJs(pathClientBase);
    watchJs(pathClientBase);
});

// client-only build

var pathDest = "./Client.Build";

gulp.task("build-index.html", ["concat-templates"], function () {
    return gulp.src(pathIndexCshtml)
        .pipe(replace("/client/", "/"))
        .pipe(replace('@{ Html.RenderPartial("Templates"); }', "<!--=include ./../src/App/Views/App/Templates.cshtml -->"))
        .pipe(include({includePaths: pathDest}))
        .pipe(rename("index.html"))
        .pipe(gulp.dest(pathDest));
});

gulp.task("client", ["build-index.html"], function () {
    gulp.watch(pathIndexCshtml, ["build-index.html"]);
    watch(pathBlocksHtml, function () {
        run("build-index.html");
    });

    buildCss(pathDest);
    watchCss(pathDest);

    buildStaticJs(pathDest);
    buildJs(pathDest);
    watchJs(pathDest);

    browserSync.init({
        server: {
            baseDir: pathDest
        }
    });

    watch(pathDest + "/**/*", browserSync.reload);
});

// just serve Client.Build

gulp.task("serve", function () {
    browserSync.init({
        server: {
            baseDir: pathDest
        }
    });

    watch(pathDest + "/**/*", browserSync.reload);
});

// shared utils

gulp.task("concat-templates", function () {
    return gulp.src(pathBlocksHtml)
        .pipe(wrap({src: pathClientBase + "/blocks/template-wrap.txt"}))
        .pipe(concat("Templates.cshtml"))
        .pipe(gulp.dest("./src/App/Views/App"));
});

function buildCss(destBase) {
    gulp.src(pathsCss)
        .pipe(sourcemaps.init())
        .pipe(concat("app.css"))
        .pipe(cleanCss())
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest(destBase + "/css"))
}

function watchCss(destBase) {
    pathsCss.forEach(function (path) {
        watch(path, buildCss.bind(null, destBase));
    });
}

function buildStaticJs(destBase) {
    gulp.src([
        pathLibScripts + "/jquery.min.js",
        pathLibScripts + "/bem-core.no-autoinit.js",
        pathLibScripts + "/handlebars.min.js"
    ])
        .pipe(concat("lib.js"))
        .pipe(gulp.dest(destBase + "/js"));
}

function buildJs(destBase) {
    gulp.src(pathScripts)
        .pipe(sourcemaps.init())
        .pipe(concat("app.js"))
        .pipe(uglify({mangle: false}))
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest(destBase + "/js"))
}

function watchJs(destBase) {
    pathScripts.forEach(function (path) {
        watch(path, buildJs.bind(null, destBase));
    });
}
