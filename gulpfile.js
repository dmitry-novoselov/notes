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
var pathBlocksCss =  pathClientBase + "/blocks/**/*.css";

var pathLibScripts = pathClientBase + "/scripts/lib";

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
});

// clientOnly build

var pathDest = "./ClientOnly.Build";

gulp.task("build-index.html", ["concat-templates"], function() {
    return gulp.src(pathIndexCshtml)
        .pipe(replace(/@using .*/g, ""))
        .pipe(replace(/@Styles.*/g, "<link rel='stylesheet' type='text/css' href='/css/app.css'>"))
        .pipe(replace('@Scripts.Render("~/js/lib")', "<script src='/js/lib.js'></script>"))
        .pipe(replace('@Scripts.Render("~/js/app")', "<script src='/js/app.js'></script>"))
        .pipe(replace('@{ Html.RenderPartial("Templates"); }', "<!--=include src/App/Views/App/Templates.cshtml -->"))
        .pipe(include({includePaths: pathDest}))
        .pipe(rename("index.html"))
        .pipe(gulp.dest(pathDest));
});

gulp.task("clientOnly", ["build-index.html"], function() {
    gulp.watch(pathIndexCshtml, ["build-index.html"]);
    watch(pathBlocksHtml, function() { run("build-index.html"); });

    buildCss();
    watch(pathClientBase + "/blocks/**/*.css", buildCss);

    gulp.src([
        pathLibScripts + "/jquery.min.js",
        pathLibScripts + "/bem-core.no-autoinit.js",
        pathLibScripts + "/handlebars.min.js"
    ])
        .pipe(concat("lib.js"))
        .pipe(gulp.dest(pathDest + "/js"));

    buildJs();
    watch(pathClientBase + "/blocks/**/*.js", buildJs);
    watch(pathClientBase + "/scripts/**/*.js", buildJs);

    browserSync.init({
        server: {
            baseDir: pathDest
        }
    });
    
    watch(pathDest + "/**/*", browserSync.reload);
});

function buildCss() {
    gulp.src(pathBlocksCss)
        .pipe(sourcemaps.init())
        .pipe(concat("app.css"))
        .pipe(cleanCss())
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest(pathDest + "/css"))
}

function buildJs() {
    gulp.src([
        pathClientBase + "/scripts/api.js",
        pathClientBase + "/scripts/init.js",
        pathClientBase + "/blocks/**/*.js"
    ])
        .pipe(sourcemaps.init())
        .pipe(concat("app.js"))
        .pipe(uglify())
        .pipe(sourcemaps.write("."))
        .pipe(gulp.dest(pathDest + "/js"))
}
