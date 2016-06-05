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
var pathTemplatesCshtml = "./src/App/Views/App/Templates.cshtml";
var pathClientBase = "./src/App/Client";

var pathBlocksHtml =  pathClientBase + "/blocks/**/*.html";
var pathsCss = [
    pathClientBase + "/css/body.css",
    pathClientBase + "/blocks/**/*.css"
];

var pathLibScripts = pathClientBase + "/scripts/lib";
var pathScripts = [
    pathClientBase + "/js/init.js",
    pathClientBase + "/js/api.js",
    pathClientBase + "/blocks/**/*.js"
];

// VS build

gulp.task("concat-templates", function() {
    return gulp.src(pathBlocksHtml)
        .pipe(wrap({src: pathClientBase + "/blocks/template-wrap.txt"}))
        .pipe(concat("Templates.cshtml"))
        .pipe(gulp.dest("./src/App/Views/App"));
});

gulp.task("default", function() {
    run("concat-templates");
    watch(pathBlocksHtml, function() { run("concat-templates"); });
    
    buildCss(pathClientBase + "/css");
    watchCss(pathClientBase + "/css");
    
    buildStaticJs(pathClientBase + "/scripts");
    buildJs(pathClientBase + "/scripts");
    watchJs(pathClientBase + "/scripts");
});

// clientOnly build

var pathDest = "./ClientOnly.Build";

gulp.task("build-index.html", ["concat-templates"], function() {
    return gulp.src(pathIndexCshtml)
        .pipe(replace("/client/", "/"))
        .pipe(replace('@{ Html.RenderPartial("Templates"); }', "<!--=include ./../src/App/Views/App/Templates.cshtml -->"))
        .pipe(include({includePaths: pathDest}))
        .pipe(rename("index.html"))
        .pipe(gulp.dest(pathDest));
});

gulp.task("clientOnly", ["build-index.html"], function() {
    gulp.watch(pathIndexCshtml, ["build-index.html"]);
    watch(pathBlocksHtml, function() { run("build-index.html"); });

    buildCss(pathDest + "/css");
    watchCss(pathDest + "/css");

    buildStaticJs(pathDest + "/js");
    buildJs(pathDest + "/js");
    watchJs(pathDest + "/js");

    browserSync.init({
        server: {
            baseDir: pathDest
        }
    });
    
    watch(pathDest + "/**/*", browserSync.reload);
});

function buildCss(dest) {
    gulp.src(pathsCss)
        .pipe(sourcemaps.init())
        .pipe(concat("app.css"))
        .pipe(cleanCss())
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest(dest))
}

function watchCss(dest) {
    pathsCss.forEach(function(path) {
        watch(path, buildCss.bind(null, dest));
    });
}

function buildStaticJs(dest) {
    gulp.src([
        pathLibScripts + "/jquery.min.js",
        pathLibScripts + "/bem-core.no-autoinit.js",
        pathLibScripts + "/handlebars.min.js"
    ])
        .pipe(concat("lib.js"))
        .pipe(gulp.dest(dest));
}

function buildJs(dest) {
    gulp.src(pathScripts)
        .pipe(sourcemaps.init())
        .pipe(concat("app.js"))
        .pipe(uglify())
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest(dest))
}

function watchJs(dest) {
    pathScripts.forEach(function(path) {
        watch(path, buildJs.bind(null, dest));
    });
}