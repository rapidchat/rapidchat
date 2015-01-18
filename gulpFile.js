var gulp = require('gulp')
var bower = require('main-bower-files')
var concat = require('gulp-concat')
var ngannotate = require('gulp-ng-annotate')
var uglify = require('gulp-uglify')
var minifyCSS = require('gulp-minify-css')
var autoprefixer = require('gulp-autoprefixer')
var rename = require('gulp-rename')


var paths = {
  scripts: ['./js/**', './js/*'],
  styles: ['./css/*', '!css/themes'],
  bower: ['./bower_components'],
}
gulp.task('bower', function() {
  return gulp.src(bower())
  .pipe(concat('vendor.js'))
  .pipe(gulp.dest('./build/'))
})

gulp.task('scripts', function() {
  return gulp.src(paths.scripts)
  .pipe(ngannotate())
  .on('error', function(err) {
    console.error(err)
  })
  .pipe(concat('main.js'))
  .pipe(gulp.dest('./build/'))
  .pipe(rename('main.min.js'))
  .pipe(uglify())
  .pipe(gulp.dest('./build/'))
})

gulp.task('styles', function() {
  return gulp.src(paths.styles)
  .pipe(concat('main.css'))
  .pipe(autoprefixer({
    browsers: ['last 2 version', 'Firefox > 20'],
    cascade: false
  }))
  .pipe(gulp.dest('./build'))
  .pipe(rename('main.min.css'))
  .pipe(minifyCSS({keepSpecialComments: 0}))
  .pipe(gulp.dest('./build'))
})

gulp.task('default', ['scripts', 'styles', 'bower'])

gulp.task('watch', ['default'], function() {
  gulp.watch(paths.bower, ['bower'])
  gulp.watch(paths.scripts, ['scripts'])
  gulp.watch(paths.styles, ['styles'])
})
