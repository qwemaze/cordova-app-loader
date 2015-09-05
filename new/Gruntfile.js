module.exports = function(grunt) {

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-concat');

    grunt.initConfig({
        concat: {
            options: {
                separator: '\n',
            },
            dist: {
                src: [
                    "src/cordova-app-loader-complete.js",
                    "src/autoupdate.js",
                    "src/js/audio.js",
                    "src/js/hints.js",
                    "src/js/share.js",
                    "src/lib/jquery-2.1.3.min.js",
                    "src/lib/jquery.transit.min.js",
                    "src/lib/lodash.min.js",
                    "src/lib/jquery.ba-throttle-debounce.min.js",
                    "src/lib/knockoutjs/knockout-3.2.0.js",
                    "src/lib/google.fastbutton.js",
                    "src/trashlib.js",
                    "src/levelpacks/impression/config.js",
                    "src/levelpacks/waves/config.js",
                    "src/Tile.js",
                    "src/LevelPack.js",
                    "src/m_site.js",
                    "src/js/feedback.js",
                    "src/js/storeInit.js",
                    "src/js/helps.js",
                    "src/testcanvas.js",
                    "src/animations/animation1/main.js",
                    "src/animations/graph/main.js",
                    "src/animations/wave/main.js",
                    "src/animations/bezier/main.js",
                    "src/animations/bounce/main.js",
                    "src/lib/jquery.include-min.js",
                    "src/index.js"
                ],
                dest: 'concat/project.js',
            },
        },
        jsonmanifest: {
            generate: {
                options: {
                    basePath: './www',
                    exclude: [],
                    //load all found assets
                    loadall: false,
                    //manually add files to the manifest
                    files: {},
                    //manually predefine the files that should be injected into the page firstly
                    load: [
                        "lib/font-awesome-4.2.0/css/font-awesome.css",
                        "index.css",
                        "help.css",
                        "gameanim.css",
                        "cordova-app-loader-complete.js",
                        "autoupdate.js",
                        "js/audio.js",
                        "js/hints.js",
                        "js/share.js",
                        "js/analytics.js",
                        "lib/jquery-2.1.3.min.js",
                        "lib/jquery.transit.min.js",
                        "lib/lodash.min.js",
                        "lib/jquery.ba-throttle-debounce.min.js",
                        "lib/knockoutjs/knockout-3.2.0.js",
                        "lib/google.fastbutton.js",
                        "trashlib.js",
                        "levelpacks/impression/config.js",
                        "levelpacks/waves/config.js",
                        "Tile.js",
                        "LevelPack.js",
                        "m_site.js",
                        "js/feedback.js",
                        "js/storeInit.js",
                        "js/helps.js",
                        "testcanvas.js",
                        "animations/animation1/main.js",
                        "animations/graph/main.js",
                        "animations/wave/main.js",
                        "animations/bezier/main.js",
                        "animations/bounce/main.js",
                        "lib/jquery.include-min.js",
                        "index.js"
                    ],
                    skip: [
                            "cordova.js",
                            // "autoupdate.js",
                            "bootstrap.js",
                            // "cordova-app-loader-complete.js"
                        ]
                        // root location of files to be loaded in the load array.
                        // root: "./"
                },
                src: [
                    '**/**.js',
                    '**/**.css',
                    '**/**.html',
                    '**/**.html',
                    '**/**.woff',
                    '**/**.jpg',
                    '**/**.woff2',
                    '**/**.png',
                    '**/**.mp3'
                ],
                dest: ['./www/manifest.json']
            }
        },
        uglify: {
            options: {
                mangle: true,
                compress: true
            },
            my_target: {
                files: [{
                    expand: true,
                    cwd: 'src',
                    src: '**/*.js',
                    dest: 'www'
                }]
            }
        }
    });

    grunt.registerMultiTask('jsonmanifest', 'Generate JSON Manifest for Hot Updates', function() {
        var options = this.options({
            loadall: true,
            root: "./",
            files: {},
            load: [],
            skip: []
        });
        var done = this.async();

        var path = require('path');
        this.files.forEach(function(file) {
            var files;

            //manifest format
            var json = {
                "files": options.files,
                "load": options.load,
                "root": options.root
            };

            //clear load array if loading all found assets
            // if (options.loadall) {
            //     json.load = [];
            // }

            // check to see if src has been set
            if (typeof file.src === "undefined") {
                grunt.fatal('Need to specify which files to include in the json manifest.', 2);
            }

            // if a basePath is set, expand using the original file pattern
            console.log(file.orig.src)
            if (options.basePath) {
                files = grunt.file.expand({
                    cwd: options.basePath
                }, file.orig.src);
            } else {
                files = file.src;
            }

            // Exclude files
            if (options.exclude) {
                files = files.filter(function(item) {
                    return options.exclude.indexOf(item) === -1;
                });
            }

            // Set default destination file
            if (!file.dest) {
                file.dest = ['manifest.json'];
            }

            // add files
            if (files) {
                files.forEach(function(item) {
                    var hasher = require('crypto').createHash('sha256');
                    var filename = encodeURI(item);
                    var key = filename.split("/").join(".");
                    json.files[key] = {}
                    json.files[key]['filename'] = filename;
                    json.files[key]['version'] = hasher.update(grunt.file.read(path.join(options.basePath, item))).digest("hex")

                    if (options.loadall) {
                        var ext = filename.split('.').pop();
                        ((ext != 'js' && ext != 'css') || (options.skip.indexOf(filename) < 0 && json.load.indexOf(filename) < 0 && json.load.push(filename)));
                    }
                });
            }
            //write out the JSON to the manifest files
            file.dest.forEach(function(f) {
                grunt.file.write(f, JSON.stringify(json, null, 2));
            });

            done();
        });

    });

    grunt.registerTask('default', ['jsonmanifest']);

};
