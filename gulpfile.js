var gulp = require('gulp');
var run = require('run-sequence');

var fs = require('fs');
var mkdirp = require('mkdirp');
var exec = require('child_process').execSync;
var globby = require('globby');

var replace = require('gulp-replace');
var rename = require("gulp-rename");
var watch = require('gulp-watch');
var wrap = require('gulp-wrap');
var concat = require('gulp-concat');
var include = require('gulp-include');

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

var pathDest = "./Client.Build";

// VS build

gulp.task("default", ["make-dest-path"], function() {
    run("concat-templates");
    watch(pathBlocksHtml, function() {
        run("concat-templates");
    });

    buildCss(pathClientBase);
    watchCss(pathClientBase);

    compileLibJs(pathClientBase);
    compileJs(pathClientBase);
    pathScripts.forEach(function(path) {
        watch(path, compileJs.bind(null, pathClientBase));
    });
});

// client-only build

gulp.task("build-index.html", ["concat-templates"], function() {
    return gulp.src(pathIndexCshtml)
        .pipe(replace("/client/", "/"))
        .pipe(replace('@{ Html.RenderPartial("Templates"); }', "<!--=include ./../src/App/Views/App/Templates.cshtml -->"))
        .pipe(include({includePaths: pathDest}))
        .pipe(rename("index.html"))
        .pipe(gulp.dest(pathDest));
});

gulp.task("client", ["make-dest-path"], function() {
    run("build-index.html");
    gulp.watch(pathIndexCshtml, ["build-index.html"]);
    watch(pathBlocksHtml, function() {
        run("build-index.html");
    });

    buildCss(pathDest);
    watchCss(pathDest);

    compileLibJs(pathDest);
    compileJs(pathDest);
    pathScripts.forEach(function(path) {
        watch(path, compileJs.bind(null, pathDest));
    });

    browserSync.init({
        server: {
            baseDir: pathDest
        }
    });

    watch(pathDest + "/**/*", browserSync.reload);
});

// just serve Client.Build

gulp.task("serve", function() {
    browserSync.init({
        server: {
            baseDir: pathDest
        }
    });

    watch(pathDest + "/**/*", browserSync.reload);
});

// shared utils

gulp.task("make-dest-path", function(done) {
    mkdirp(pathDest + "/js", done);
});

gulp.task("concat-templates", function() {
    return gulp.src(pathBlocksHtml)
        .pipe(wrap({src: pathClientBase + "/blocks/template-wrap.txt"}))
        .pipe(concat("Templates.cshtml"))
        .pipe(gulp.dest("./src/App/Views/App"));
});

function compileJs(destBase) {
    globby(pathScripts).then(function(filesPaths) {
        var cmd =
            ' uglifyjs "' + filesPaths.join('" "') + '"' +
            ' --output "app.js" --source-map "app.js.map" --source-map-include-sources --prefix 4';

        exec(cmd);
        
        fs.renameSync("app.js", destBase + "/js/app.js");
        fs.renameSync("app.js.map", destBase + "/js/app.js.map");
    });
}

function compileLibJs(destBase) {
    gulp.src([
        pathLibScripts + "/jquery.min.js",
        pathLibScripts + "/bem-core.no-autoinit.js",
        pathLibScripts + "/handlebars.min.js"
    ])
        .pipe(concat("lib.js"))
        .pipe(gulp.dest(destBase + "/js"));
}

function buildCss(destBase) {
    gulp.src(pathsCss)
        .pipe(sourcemaps.init())
        .pipe(concat("app.css"))
        .pipe(cleanCss())
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest(destBase + "/css"))
}

function watchCss(destBase) {
    pathsCss.forEach(function(path) {
        watch(path, buildCss.bind(null, destBase));
    });
}
