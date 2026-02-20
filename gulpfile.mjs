import gulp from 'gulp';
import * as dartSass from 'sass';
import gulpSass from 'gulp-sass';
import uglify from 'gulp-uglify';
import rename from 'gulp-rename';
import filter from 'gulp-filter';
import path from 'path';
import { fileURLToPath } from 'url';
import { deleteAsync as del } from 'del';
import { exec } from 'child_process';
import { promisify } from 'util';

const sass = gulpSass(dartSass);
const cssSourceGlob = './assets/sass/**/*.scss';
const cssOutputDir = './assets/css';
const generatedCssFiles = [
    `${cssOutputDir}/custom.min.css`,
    `${cssOutputDir}/main.min.css`,
    `${cssOutputDir}/noscript.min.css`
];

gulp.task('delete', function () {
    return del(['images/*.*']);
});

const execAsync = promisify(exec);
const rootDir = path.dirname(fileURLToPath(import.meta.url));

gulp.task('generate-theme', async function () {
    try {
        const { stdout } = await execAsync('node scripts/generate-theme-vars.mjs', { cwd: rootDir });
        if (stdout) console.log(stdout.trim());
    } catch (error) {
        console.error('Theme generation failed:', error.message);
        throw error;
    }
});

gulp.task('resize-images', async function () {
    console.log('Running custom image resize script...');
    try {
        const { stdout, stderr } = await execAsync('node resize-images.js');
        console.log(stdout);
        if (stderr) {
            console.error(stderr);
        }
    } catch (error) {
        console.error('Error running resize script:', error.message);
        throw error;
    }
});

// clear previously generated css
gulp.task('clean-css', function () {
    return del(generatedCssFiles);
});

// compile scss to css
gulp.task('sass', gulp.series('generate-theme', 'clean-css', function compileSass() {
    return gulp.src(cssSourceGlob)  // Target all .scss files
        .pipe(sass({
            outputStyle: 'compressed',
            silenceDeprecations: ['import', 'legacy-js-api', 'if-function', 'global-builtin', 'color-functions']
        }).on('error', sass.logError))
        .pipe(rename(function (path) {
            path.basename += '.min';  // Append .min to the output filename
        }))
        .pipe(gulp.dest(cssOutputDir));  // Output to the CSS directory
}));

// watch changes in scss files and config, run sass task
gulp.task('sass:watch', function () {
    gulp.watch(['./assets/sass/**/*.scss', '_config.yml'], gulp.series('sass'));
});

// minify js
gulp.task('minify-js', function () {
    return gulp.src('./assets/js/**/*.js')
        .pipe(filter(function (file) {
            const filePath = file.path;
            const basename = path.basename(filePath, '.js');
            
            // Skip files that are already minified
            return !basename.endsWith('.min');
        }))
        .pipe(uglify())
        .pipe(rename(function (path) {
            path.basename += '.min';
            path.extname = '.js';
        }))
        .pipe(gulp.dest('./assets/js'));
});

// build task
gulp.task('build', gulp.series('sass', 'minify-js'));

// resize images
gulp.task('resize', gulp.series('resize-images'));

// default task
gulp.task('default', gulp.series('build', 'resize'));