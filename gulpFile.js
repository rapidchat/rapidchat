var gulp = require('gulp')
var bower = require('main-bower-files')
var concat = require('gulp-concat')
var ngannotate = require('gulp-ng-annotate')

var paths = {
  scripts: ['./js/**', './js/*'],
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
})

gulp.task('default', ['scripts', 'bower'])

gulp.task('watch', ['default'], function() {
  gulp.watch(paths.bower, ['bower'])
  gulp.watch(paths.scripts, ['scripts'])
})
