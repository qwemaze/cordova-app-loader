/******/
(function(modules) { // webpackBootstrap
    /******/ // The module cache
    /******/
    var installedModules = {};

    /******/ // The require function
    /******/
    function __webpack_require__(moduleId) {

        /******/ // Check if module is in cache
        /******/
        if (installedModules[moduleId])
        /******/
            return installedModules[moduleId].exports;

        /******/ // Create a new module (and put it into the cache)
        /******/
        var module = installedModules[moduleId] = {
            /******/
            exports: {},
            /******/
            id: moduleId,
            /******/
            loaded: false
                /******/
        };

        /******/ // Execute the module function
        /******/
        modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

        /******/ // Flag the module as loaded
        /******/
        module.loaded = true;

        /******/ // Return the exports of the module
        /******/
        return module.exports;
        /******/
    }


    /******/ // expose the modules object (__webpack_modules__)
    /******/
    __webpack_require__.m = modules;

    /******/ // expose the module cache
    /******/
    __webpack_require__.c = installedModules;

    /******/ // __webpack_public_path__
    /******/
    __webpack_require__.p = "";

    /******/ // Load entry module and return exports
    /******/
    return __webpack_require__(0);
    /******/
})
/************************************************************************/
/******/
([
    /* 0 */
    /***/
    function(module, exports, __webpack_require__) {

        window.CordovaAppLoader = __webpack_require__(1);
        window.CordovaFileCache = __webpack_require__(2);
        window.CordovaPromiseFS = __webpack_require__(3);
        window.Promise = __webpack_require__(4);
        window.setImmediate = window.setTimeout; // for promiscuous to work!

        /***/
    },
    /* 1 */
    /***/
    function(module, exports, __webpack_require__) {

        var CordovaFileCache = __webpack_require__(2);
        var CordovaPromiseFS = __webpack_require__(3);
        var Promise = null;

        var BUNDLE_ROOT = location.href.replace(location.hash, '');
        BUNDLE_ROOT = BUNDLE_ROOT.substr(0, BUNDLE_ROOT.lastIndexOf('/') + 1);
        if (/ip(hone|ad|od)/i.test(navigator.userAgent)) {
            BUNDLE_ROOT = location.pathname.substr(location.pathname.indexOf('/www/'));
            BUNDLE_ROOT = BUNDLE_ROOT.substr(0, BUNDLE_ROOT.lastIndexOf('/') + 1);
            BUNDLE_ROOT = 'cdvfile://localhost/bundle' + BUNDLE_ROOT;
        }

        function hash(files) {
            var keys = Object.keys(files);
            keys.sort();
            var str = '';
            keys.forEach(function(key) {
                if (files[key] && files[key].version);
                str += '@' + files[key].version;
            });
            return CordovaFileCache.hash(str) + '';
        }

        function AppLoader(options) {
            if (!options) throw new Error('CordovaAppLoader has no options!');
            if (!options.fs) throw new Error('CordovaAppLoader has no "fs" option (cordova-promise-fs)');
            if (!options.serverRoot) throw new Error('CordovaAppLoader has no "serverRoot" option.');
            if (!window.pegasus || !window.Manifest) throw new Error('CordovaAppLoader bootstrap.js is missing.');
            this.allowServerRootFromManifest = options.allowServerRootFromManifest === true;
            Promise = options.fs.Promise;

            // initialize variables
            this.manifest = window.Manifest;
            this.newManifest = null;
            this.localManifest = null;

            // normalize serverRoot and set remote manifest url
            options.serverRoot = options.serverRoot || '';
            this.versionFile = options.serverRoot + (options.versionFile || 'hashver');
            if (!!options.serverRoot && options.serverRoot[options.serverRoot.length - 1] !== '/') options.serverRoot += '/';
            this.newManifestUrl = options.manifestUrl || options.serverRoot + (options.manifest || 'manifest.json');

            // initialize a file cache
            if (options.mode) options.mode = 'mirror';
            this.cache = new CordovaFileCache(options);

            // private stuff
            this._toBeDownloaded = [];
            this._toBeDeleted = [];
            this._updateReady = false;
            this._checkTimeout = options.checkTimeout || 10000;
        }

        AppLoader.prototype._createFilemap = function(files) {
            var result = {};
            var normalize = this.cache._fs.normalize;
            Object.keys(files).forEach(function(key) {
                files[key].filename = normalize(files[key].filename);
                result[files[key].filename] = files[key];
            });
            return result;
        };

        AppLoader.prototype.getFiles = function(files) {
            var result = [];
            var normalize = this.cache._fs.normalize;
            Object.keys(files).forEach(function(key) {
                result.push(normalize(files[key].filename));
            });
            return result;
        };

        AppLoader.prototype.copyFromBundle = function(file) {
            var url = BUNDLE_ROOT + file;
            var root = this.cache.localRoot;
            return this.cache._fs.download(url, root + file);
        };

        AppLoader.prototype.getBundledManifest = function(local) {
            var self = this;
            var bootstrapScript = document.querySelector('script[manifest]');
            var bundledManifestUrl = (bootstrapScript ? bootstrapScript.getAttribute('manifest') : null) || 'manifest.json';
            var manifestUrl = (local ? self.cache._fs.toInternalURLSync(self.cache.localRoot) : BUNDLE_ROOT ) + bundledManifestUrl;
            return new Promise(function(resolve, reject) {
                local && self.localManifest && resolve(self.localManifest);
                pegasus(manifestUrl).then(function(manifest) {
                    if(local) self.localManifest = manifest;
                    resolve(manifest);
                }, function(){resolve(null)})
                setTimeout(function() {
                    reject(new Error('manifest timeout'));
                }, self._checkTimeout);
            });
        };

        AppLoader.prototype.ensureLocalCache = function() {
        	var self = this;
            return new Promise(function(resolve, reject) {
                self.getBundledManifest(true).then(function(manifest) {
                    if (!manifest) {
                        self.getBundledManifest().then(function(manifest) {
                            var files = self.getFiles(manifest.files);
                            files.push("manifest.json");
                            Promise.all(files.map(function(file){
                                return self.cache._fs.download(BUNDLE_ROOT + file, self.cache._fs.toInternalURLSync(self.cache.localRoot) + file);
                            })).then(function(val){
                                resolve(true);
                            }, function(reason) {
                                reject(reason);
                            });
                        }, reject)
                    } else {
                        resolve(true);
                    }
                }, reject);
            })
        };

        AppLoader.prototype.check = function(newManifest) {
            var self = this,
                manifest = this.manifest;

            !newManifest && (newManifest = self.newManifestUrl);

            var gotNewManifest = function(){
                return new Promise(function(resolve, reject) {
                    if (typeof newManifest === "object") {
                        resolve(newManifest);
                    } else {
                        pegasus(newManifest).then(function(manifest) {
                            resolve(manifest);
                        }, reject);
                        setTimeout(function() {
                            reject(new Error('new manifest timeout'));
                        }, self._checkTimeout);
                    }
                });
            };

            var checkVer = new Promise(function(resolve, reject){
                pegasus(self.versionFile, true).then(function(ver){
                    if(ver && ver !== self.manifest.version) resolve(ver);
                    else(reject(false));
                },function(){reject(false)});
                setTimeout(function() {
                    reject(408);
                }, self._checkTimeout);
            });

            var root = self.cache.localRoot;

            return checkVer.then(function(wat){
                return self.cache.init().then(function(){
                    return new Promise(function(resolve, reject){
                        var all = [gotNewManifest(), self.ensureLocalCache(), self.cache.list(true)];
                        Promise.all(all).then(function(values){
                            console.log("CHCK", values)
                            var newManifest = values[0];
                            var localManifest = self.manifest; // local or bundled manifest;
                            var newFiles = hash(newManifest.files);
                            var presentFiles = values[2].map(function(entry){
                                entry = entry.split('/');
                                entry.shift();
                                return entry.join('/');
                            });

                            if (!newManifest.files) {
                                reject('Downloaded Manifest has no "files" attribute.');
                                return;
                            };

                            var newFiles = self._createFilemap(newManifest.files); // files in new manifest
                            var localFiles = self._createFilemap(localManifest.files); // files in app bundle

                            // Create COPY and DOWNLOAD lists
                            self._toBeDownloaded = [];
                            self._toBeDeleted = [];
                            Object.keys(newFiles)
                                .filter(function(file) {
                                    return !localFiles[file]
                                        || localFiles[file].version !== newFiles[file].version
                                        // || !(self.cache.isCached(file) || !temp);
                                })
                                .forEach(function(file) {
                                    if (!localFiles[file] || localFiles[file].version !== newFiles[file].version) {
                                        self._toBeDownloaded.push(file);
                                    }
                                });

                            presentFiles.forEach(function(entry){
                                if(!newFiles[entry]){
                                    entry != 'manifest.json' && self._toBeDeleted.push(entry);
                                }
                            })

                            console.log("TBDWNLDED", self._toBeDownloaded)
                            console.log("TBDELETED", self._toBeDeleted)
                            var changes = self._toBeDownloaded.length + self._toBeDeleted.length;
                            if (changes > 0) {
                                self._toBeDownloaded.push("manifest.json");
                                self.newManifest = newManifest;
                                self.newManifest.root = self.cache._fs.toInternalURLSync(self.cache.localRoot);
                                resolve(true);
                            } else {
                                resolve(false);
                            }
                        }, function(err) {
                            reject(err);
                        }); // end of .then
                    }); // end of new Promise
                });
            }, function(err){
                return(err);
            });
        };

        AppLoader.prototype.canDownload = function() {
            return !!this.newManifest && !this._updateReady;
        };

        AppLoader.prototype.canUpdate = function() {
            return this._updateReady;
        };

        AppLoader.prototype.download = function(onprogress) {
            var self = this;
            if (!self.canDownload()) {
                return new Promise(function(resolve) {
                    resolve(null);
                });
            };
            localStorage.removeItem('manifest');
            this.manifest.files = Manifest.files = {};
            var root = self.cache.tempRoot;
            if (self.allowServerRootFromManifest && self.newManifest.serverRoot) {
                self.cache.serverRoot = self.newManifest.serverRoot;
            }
            self.cache.add(self._toBeDownloaded);
            // alert("ADDED")
            self.cache.remove(self._toBeDeleted);
            return self.cache.download(onprogress);
        };

        AppLoader.prototype.update = function() {
            // console.log("DOWNLOADED")
            return this.cache.move();
        };

        AppLoader.prototype.clear = function() {
            // localStorage.removeItem('last_update_files');
            localStorage.removeItem('manifest');
            return this.cache.clear();
        };

        AppLoader.prototype.reset = function() {
            return this.clear().then(function() {
                location.reload();
            }, function() {
                location.reload();
            });
        };

        module.exports = AppLoader;

        /***/
    },
    /* 2 */
    /***/
    function(module, exports, __webpack_require__) {

        var hash = __webpack_require__(5);
        var Promise = null;
        var isCordova = typeof cordova !== 'undefined';

        /* Cordova File Cache x */
        function FileCache(options) {
            var self = this;
            // cordova-promise-fs
            this._fs = options.fs;
            if (!this._fs) {
                throw new Error('Missing required option "fs". Add an instance of cordova-promise-fs.');
            }
            // Use Promises from fs.
            Promise = this._fs.Promise;

            // 'mirror' mirrors files structure from "serverRoot" to "localRoot"
            // 'hash' creates a 1-deep filestructure, where the filenames are hashed server urls (with extension)
            this._mirrorMode = options.mode !== 'hash';
            this._retry = options.retry || [500, 1500, 8000];
            this._cacheBuster = !!options.cacheBuster;

            // normalize path
            this.localRoot = this._fs.normalize(options.localRoot || 'data');
            this.tempRoot = this._fs.normalize(options.tempRoot || 'temp');
            this.serverRoot = this._fs.normalize(options.serverRoot || '');

            // set internal variables
            this._downloading = []; // download promises
            this._added = []; // added files
            this._cached = {}; // cached files

            // list existing cache contents
            this.ready = Promise.all([
                this._fs.ensure(this.localRoot)
                .then(function(entry) {
                    self.localInternalURL = isCordova ? entry.toInternalURL() : entry.toURL();
                    self.localUrl = entry.toURL();
                    return self.list();
                }),
                this._fs.ensure(this.tempRoot)
                .then(function(entry) {
                    self.tempInternalURL = isCordova ? entry.toInternalURL() : entry.toURL();
                    self.tempUrl = entry.toURL();
                    return self.list(true);
                })
            ]);
        }

        FileCache.hash = hash;

        FileCache.prototype.init = function init(){
        	this._downloading = []; // download promises
            this._added = []; // added files
            this._cached = {}; // cached files
            this.ready = Promise.all([
                this._fs.ensure(this.localRoot)
                .then(function(entry) {
                    self.localInternalURL = isCordova ? entry.toInternalURL() : entry.toURL();
                    self.localUrl = entry.toURL();
                    return self.list();
                }),
                this._fs.ensure(this.tempRoot)
                .then(function(entry) {
                    self.tempInternalURL = isCordova ? entry.toInternalURL() : entry.toURL();
                    self.tempUrl = entry.toURL();
                    return self.list(true);
                })
            ]);
            return this.clear();
        }

        /**
         * Helper to cache all 'internalURL' and 'URL' for quick synchronous access
         * to the cached files.
         */
        FileCache.prototype.list = function list(local) {
            var self = this;
            var root = !local ? self.tempRoot : self.localRoot;
            return new Promise(function(resolve, reject) {
                self._fs.list(root, 'rfe').then(function(entries) {
                    // self._cached = {}
                    entries = entries.map(function(entry) {
                        var fullPath = self._fs.normalize(entry.fullPath);
                        // self._cached[fullPath] = {
                        //     toInternalURL: isCordova ? entry.toInternalURL() : entry.toURL(),
                        //     toURL: entry.toURL(),
                        // };
                        return fullPath;
                    });
                    resolve(entries);
                }, function() {
                    resolve([]);
                });
            });
        };

        FileCache.prototype.add = function add(urls, local) {
            if (!urls) urls = [];
            if (typeof urls === 'string') urls = [urls];
            var self = this;
            // var added = temp ? self._tempAdded : self._added;
            urls.forEach(function(url) {
                url = local ? self._fs.toInternalURLSync(self.tempRoot + url) : self.toServerURL(url);
                // console.log("ADD", url)
                if (self._added.indexOf(url) === -1) {
                    self._added.push(url);
                }
            });
            return true;
        };

        FileCache.prototype.remove = function remove(urls, returnPromises) {
            if (!urls) urls = [];
            var promises = [];
            if (typeof urls === 'string') urls = [urls];
            var self = this;
            urls.forEach(function(url) {
                var index = self._added.indexOf(self.toServerURL(url));
                if (index >= 0) self._added.splice(index, 1);
                var path = self.toPath(url, true);
                promises.push(self._fs.remove(path));
                delete self._cached[path];
            });
            return returnPromises ? Promise.all(promises) : true;
        };

        FileCache.prototype.getDownloadQueue = function() {
            var self = this;
            // var added = temp ? self._tempAdded : self._added;
            var queue = self._added.filter(function(url) {
                return !self.isCached(url);
            });
            return queue;
        };

        FileCache.prototype.getAdded = function() {
            return this._added;
        };

        FileCache.prototype.isDirty = function isDirty() {
            return this.getDownloadQueue().length > 0;
        };

        FileCache.prototype.move = function move(){
            var self = this;
            var queue = self.getDownloadQueue();
            if(queue.length == 0) return;
            return Promise.all(queue.map(function(url){
                return self._fs.move(
                    self.toPath(url, false),
                    self.toPath(url, true)
                );
            }));
        }

        FileCache.prototype.download = function download(onprogress) {
            var fs = this._fs;
            var self = this;
            // console.log("CACHE DOWNLOAD")
            self.abort();
            var root = self.tempRoot

            return new Promise(function(resolve, reject) {
                fs.ensure(root).then(function() {

                    var queue = self.getDownloadQueue();
                    if(queue.length == 0) return resolve();
                    var started = [];
                    var index = self._downloading.length;
                    var done = self._downloading.length;
                    var total = self._downloading.length + queue.length;

                    queue.forEach(function(url) {
                        var path = self.toPath(url, false);
                        // console.log("URL", url, "to PATH", path)
                        var onSingleDownloadProgress;
                        // console.log("FC OP", onprogress);
                        if (typeof onprogress === 'function') {
                            onSingleDownloadProgress = function(ev) {
                                // console.log("onSingleProgress")
                                // console.log(ev)
                                ev.queueIndex = index;
                                ev.queueSize = total;
                                ev.url = url;
                                ev.path = path;
                                ev.percentage = index / total;
                                if (ev.loaded > 0 && ev.total > 0 && index !== total) {
                                    ev.percentage += (ev.loaded / ev.total) / total;
                                }
                                if (started.indexOf(url) < 0) {
                                    started.push(url);
                                    index++;
                                }
                                onprogress(ev);
                            };
                        }

                        var onDone = function() {
                            done++;
                            if (done === total) {
                                self._downloading = [];
                                if (onSingleDownloadProgress) onSingleDownloadProgress(new ProgressEvent());
                                resolve(self);
                            }
                        };
                        // console.log("FC OSP", onSingleDownloadProgress);
                        var downloadUrl = url;
                        if (self._cacheBuster) downloadUrl += "?" + Date.now();
                        // console.log("Download", downloadUrl, path)
                        var download = fs.download(downloadUrl, path, {
                            retry: self._retry
                        }, onSingleDownloadProgress);
                        download.then(onDone, onDone);
                        self._downloading.push(download);
                    });
                }, reject);
            });
        };

        FileCache.prototype.abort = function abort() {
            // var downloading = temp ? this._tempDownloading : this._downloading;
            this._downloading.forEach(function(download) {
                download.abort();
            });
            self._downloading = [];
        };

        FileCache.prototype.isCached = function isCached(url) {
            url = this.toPath(url);
            return !!this._cached[url];
        };

        FileCache.prototype.clear = function clear(local) {
            var self = this;
            var root = local ? self.localRoot : self.tempRoot;
            self._cached = {};
            return this._fs.removeDir(root).then(function() {
                return self._fs.ensure(root);
            });
        };

        /**
         * Helpers to output to various formats
         */
        FileCache.prototype.toInternalURL = function toInternalURL(url) {
            // console.log("toInternalURL temp",temp)
            path = this.toPath(url);
            // var cached = temp ? this._tempCached : this._cached;
            if (this._cached[path]) return this._cached[path].toInternalURL;
            return url;
        };

        FileCache.prototype.changeRoot = function changeRoot(url){
        	var url = url.split('/');
        	url.shift();
        	url.unshift(temp ? this.tempRoot : this.localRoot);
        	return url.join('/');
        };

        FileCache.prototype.rmRoot = function rmRoot(url){
        	var url = url.split('/');
        	url.shift();
        	return url.join('/');
        };

        FileCache.prototype.get = function get(url) {
            path = this.toPath(url);
            // var cached = temp ? this._tempCached : this._cached;
            if (this._cached[path]) return this._cached[path].toInternalURL;
            return this.toServerURL(url);
        };

        FileCache.prototype.toDataURL = function toDataURL(url) {
            return this._fs.toDataURL(this.toPath(url));
        };

        FileCache.prototype.toURL = function toURL(url) {
            path = this.toPath(url);
            // var cached = temp ? this._tempCached : this._cached;
            return this._cached[path] ? this._cached[path].toURL : url;
        };

        FileCache.prototype.toServerURL = function toServerURL(path) {
            path = this._fs.normalize(path);
            return path.indexOf('://') < 0 ? this.serverRoot + path : path;
        };

        /**
         * Helper to transform remote URL to a local path (for cordova-promise-fs)
         */
        FileCache.prototype.toPath = function toPath(url, local) {
            var root = !local ? this.tempRoot : this.localRoot;
            var server = this.serverRoot;
            if (this._mirrorMode) {
                var query = url.indexOf('?');
                if (query > -1) {
                    url = url.substr(0, query);
                }
                url = url = this._fs.normalize(url || '');
                len = server.length;
                if (url.substr(0, len) !== server) {
                    return root + url;
                } else {
                    return root + url.substr(len);
                }
            } else {
                return root + hash(url) + url.substr(url.lastIndexOf('.'));
            }
        };

        module.exports = FileCache;

        /***/
    },
    /* 3 */
    /***/
    function(module, exports, __webpack_require__) {

        /**
         * Static Private functions
         */

        /* createDir, recursively */
        function __createDir(rootDirEntry, folders, success, error) {
            rootDirEntry.getDirectory(folders[0], {
                create: true
            }, function(dirEntry) {
                // Recursively add the new subfolder (if we still have another to create).
                if (folders.length > 1) {
                    __createDir(dirEntry, folders.slice(1), success, error);
                } else {
                    success(dirEntry);
                }
            }, error);
        }

        function dirname(str) {
            str = str.substr(0, str.lastIndexOf('/') + 1);
            if (str[0] === '/') str = str.substr(1);
            return str;
        }

        function filename(str) {
            return str.substr(str.lastIndexOf('/') + 1);
        }

        function normalize(str) {
            str = str || '';
            if (str[0] === '/') str = str.substr(1);
            if (!!str && str.indexOf('.') < 0 && str[str.length - 1] !== '/') str += '/';
            if (str === './') str = '';
            return str;
        }

        var transferQueue = [], // queued fileTransfers
            inprogress = 0; // currently active filetransfers

        /**
         * Factory function: Create a single instance (based on single FileSystem)
         */
        module.exports = function(options) {
            /* Promise implementation */
            var Promise = options.Promise || window.Promise;
            if (typeof Promise === 'undefined') {
                throw new Error("No Promise library given in options.Promise");
            }

            /* default options */
            this.options = options = options || {};
            options.persistent = options.persistent !== undefined ? options.persistent : true;
            options.storageSize = options.storageSize || 20 * 1024 * 1024;
            options.concurrency = options.concurrency || 3;
            options.retry = options.retry || [];

            /* Cordova deviceready promise */
            var deviceready, isCordova = typeof cordova !== 'undefined';
            if (isCordova) {
                deviceready = new Promise(function(resolve, reject) {
                    document.addEventListener("deviceready", resolve, false);
                    setTimeout(function() {
                        reject(new Error('deviceready has not fired after 5 seconds.'));
                    }, 5100);
                });
            } else {
                /* FileTransfer implementation for Chrome */
                deviceready = ResolvedPromise(true);
                // console.log("YES FS")
                if (typeof webkitRequestFileSystem !== 'undefined') {
                    window.requestFileSystem = webkitRequestFileSystem;
                    window.FileTransfer = function FileTransfer() {};
                    FileTransfer.prototype.download = function download(url, file, win, fail) {
                        // console.log("FTDWL", url, file)
                        var xhr = new XMLHttpRequest();
                        xhr.open('GET', url);
                        xhr.responseType = "blob";
                        xhr.onreadystatechange = function(onSuccess, onError, cb) {
                            if (xhr.readyState == 4) {
                                if (xhr.status === 200) {
                                    write(file, xhr.response).then(win, fail);
                                } else {
                                    fail(xhr.status);
                                }
                            }
                        };
                        xhr.send();
                        return xhr;
                    };
                    window.ProgressEvent = function ProgressEvent() {};
                    window.FileEntry = function FileEntry() {};
                } else {
                    console.log("NO FS")
                    window.requestFileSystem = function(x, y, z, fail) {
                        fail(new Error('requestFileSystem not supported!'));
                    };
                }
            }

            /* Promise resolve helper */
            function ResolvedPromise(value) {
                return new Promise(function(resolve) {
                    return resolve(value);
                });
            }

            /* the filesystem! */
            var fs = new Promise(function(resolve, reject) {
                deviceready.then(function() {
                    var type = options.persistent ? 1 : 0;
                    if (typeof options.fileSystem === 'number') {
                        type = options.fileSystem;
                    }
                    // Chrome only supports persistent and temp storage, not the exotic onces from Cordova
                    if (!isCordova && type > 1) {
                        console.warn('Chrome does not support fileSystem "' + type + '". Falling back on "0" (temporary).');
                        type = 0;
                    }
                    // console.log("FS",window.requestFileSystem, type, options.storageSize, resolve, reject)
                    window.requestFileSystem(type, options.storageSize, resolve, reject);
                    setTimeout(function() {
                        reject(new Error('Could not retrieve FileSystem after 5 seconds.'));
                    }, 5100);
                }, reject);
            });

            /* debug */
            fs.then(function(fs) {
                window.__fs = fs;
            }, function(err) {
                console.error('Could not get Cordova FileSystem:', err);
            });

            /* ensure directory exists */
            function ensure(folders) {
                return new Promise(function(resolve, reject) {
                    return fs.then(function(fs) {
                        if (!folders) {
                            resolve(fs.root);
                        } else {
                            folders = folders.split('/').filter(function(folder) {
                                return folder && folder.length > 0 && folder !== '.' && folder !== '..';
                            });
                            __createDir(fs.root, folders, resolve, reject);
                        }
                    }, reject);
                });
            }

            /* get file file */
            function file(path, options) {
                return new Promise(function(resolve, reject) {
                    if (typeof path === 'object') {
                        return resolve(path);
                    }
                    path = normalize(path);
                    options = options || {};
                    return fs.then(function(fs) {
                        fs.root.getFile(path, options, resolve, reject);
                    }, reject);
                });
            }

            /* get directory entry */
            function dir(path, options) {
                path = normalize(path);
                options = options || {};
                return new Promise(function(resolve, reject) {
                    return fs.then(function(fs) {
                        if (!path || path === '/') {
                            resolve(fs.root);
                        } else {
                            fs.root.getDirectory(path, options, resolve, reject);
                        }
                    }, reject);
                });
            }

            /* list contents of a directory */
            function list(path, mode) {
                mode = mode || '';
                var recursive = mode.indexOf('r') > -1;
                var getAsEntries = mode.indexOf('e') > -1;
                var onlyFiles = mode.indexOf('f') > -1;
                var onlyDirs = mode.indexOf('d') > -1;
                if (onlyFiles && onlyDirs) {
                    onlyFiles = false;
                    onlyDirs = false;
                }

                return new Promise(function(resolve, reject) {
                    return dir(path).then(function(dirEntry) {
                        var dirReader = dirEntry.createReader();
                        dirReader.readEntries(function(entries) {
                            var promises = [ResolvedPromise(entries)];
                            if (recursive) {
                                entries
                                    .filter(function(entry) {
                                        return entry.isDirectory;
                                    })
                                    .forEach(function(entry) {
                                        promises.push(list(entry.fullPath, 're'));
                                    });
                            }
                            Promise.all(promises).then(function(values) {
                                var entries = [];
                                entries = entries.concat.apply(entries, values);
                                if (onlyFiles) entries = entries.filter(function(entry) {
                                    return entry.isFile;
                                });
                                if (onlyDirs) entries = entries.filter(function(entry) {
                                    return entry.isDirectory;
                                });
                                if (!getAsEntries) entries = entries.map(function(entry) {
                                    return entry.fullPath;
                                });
                                resolve(entries);
                            }, reject);
                        }, reject);
                    }, reject);
                });
            }

            /* does file exist? If so, resolve with fileEntry, if not, resolve with false. */
            function exists(path) {
                return new Promise(function(resolve, reject) {
                    file(path).then(
                        function(fileEntry) {
                            resolve(fileEntry);
                        },
                        function(err) {
                            if (err.code === 1) {
                                resolve(false);
                            } else {
                                reject(err);
                            }
                        }
                    );
                });
            }

            function create(path) {
                return ensure(dirname(path)).then(function() {
                    return file(path, {
                        create: true
                    });
                });
            }

            /* convert path to URL to be used in JS/CSS/HTML */
            function toURL(path) {
                return file(path).then(function(fileEntry) {
                    return fileEntry.toURL();
                });
            }

            /* convert path to URL to be used in JS/CSS/HTML */
            var toInternalURL, toInternalURLSync;
            if (isCordova) {
                /* synchronous helper to get internal URL. */
                toInternalURLSync = function(path) {
                    path = normalize(path);
                    return path.indexOf('://') < 0 ? 'cdvfile://localhost/' + (options.persistent ? 'persistent/' : 'temporary/') + path : path;
                };

                toInternalURL = function(path) {
                    return file(path).then(function(fileEntry) {
                        return fileEntry.toInternalURL();
                    });
                };
            } else {
                /* synchronous helper to get internal URL. */
                toInternalURLSync = function(path) {
                    path = normalize(path);
                    return 'filesystem:' + location.origin + (options.persistent ? '/persistent/' : '/temporary/') + path;
                };

                toInternalURL = function(path) {
                    return file(path).then(function(fileEntry) {
                        return fileEntry.toURL();
                    });
                };
            }

            /* return contents of a file */
            function read(path, method) {
                method = method || 'readAsText';
                return file(path).then(function(fileEntry) {
                    return new Promise(function(resolve, reject) {
                        fileEntry.file(function(file) {
                            var reader = new FileReader();
                            reader.onloadend = function() {
                                resolve(this.result);
                            };
                            reader[method](file);
                        }, reject);
                    });
                });
            }

            /* convert path to base64 date URI */
            function toDataURL(path) {
                return read(path, 'readAsDataURL');
            }


            function readJSON(path) {
                return read(path).then(JSON.parse);
            }

            /* write contents to a file */
            function write(path, blob, mimeType) {
                return ensure(dirname(path))
                    .then(function() {
                        return file(path, {
                            create: true
                        });
                    })
                    .then(function(fileEntry) {
                        return new Promise(function(resolve, reject) {
                            fileEntry.createWriter(function(writer) {
                                writer.onwriteend = resolve;
                                writer.onerror = reject;
                                if (typeof blob === 'string') {
                                    blob = new Blob([blob], {
                                        type: mimeType || 'text/plain'
                                    });
                                } else if (blob instanceof Blob !== true) {
                                    blob = new Blob([JSON.stringify(blob, null, 4)], {
                                        type: mimeType || 'application/json'
                                    });
                                }
                                writer.write(blob);
                            }, reject);
                        });
                    });
            }

            /* move a file */
            function move(src, dest) {
                // console.log("MOVE",src,dst)
                return ensure(dirname(dest))
                    .then(function(dir) {
                        return file(src).then(function(fileEntry) {
                            return new Promise(function(resolve, reject) {
                                fileEntry.moveTo(dir, filename(dest), resolve, reject);
                            });
                        });
                    });
            }

            /* copy a file */
            function copy(src, dest) {
                return ensure(dirname(dest))
                    .then(function(dir) {
                        return file(src).then(function(fileEntry) {
                            return new Promise(function(resolve, reject) {
                                fileEntry.copyTo(dir, filename(dest), resolve, reject);
                            });
                        });
                    });
            }

            /* delete a file */
            function remove(path, mustExist) {
                var method = mustExist ? file : exists;
                return new Promise(function(resolve, reject) {
                    method(path).then(function(fileEntry) {
                        if (fileEntry !== false) {
                            fileEntry.remove(resolve, reject);
                        } else {
                            resolve(1);
                        }
                    }, reject);
                }).then(function(val) {
                    return val === 1 ? false : true;
                });
            }

            /* delete a directory */
            function removeDir(path) {
                return dir(path).then(function(dirEntry) {
                    return new Promise(function(resolve, reject) {
                        dirEntry.removeRecursively(resolve, reject);
                    });
                });
            }

            // Whenever we want to start a transfer, we call popTransferQueue
            function popTransferQueue() {
                // while we are not at max concurrency
                while (transferQueue.length > 0 && inprogress < options.concurrency) {
                    // increment activity counter
                    inprogress++;

                    // fetch filetranfer, method-type (isDownload) and arguments
                    var args = transferQueue.pop();
                    var ft = args.shift();
                    var isDownload = args.shift();
                    var serverUrl = args.shift();
                    var localPath = args.shift();
                    var win = args.shift();
                    var fail = args.shift();
                    var trustAllHosts = args.shift();
                    var transferOptions = args.shift();

                    if (ft._aborted) {
                        inprogress--;
                    } else if (isDownload) {
                        // console.log("DWL", serverUrl, localPath);
                        ft.download.call(ft, serverUrl, localPath, win, fail, trustAllHosts, transferOptions);
                        if (ft.onprogress) ft.onprogress(new ProgressEvent());
                    } else {
                        // console.log("UPL", localPath, serverUrl);
                        ft.upload.call(ft, localPath, serverUrl, win, fail, transferOptions, trustAllHosts);
                    }
                }
                // if we are at max concurrency, popTransferQueue() will be called whenever
                // the transfer is ready and there is space avaialable.
            }

            // Promise callback to check if there are any more queued transfers
            function nextTransfer(result) {
                inprogress--; // decrement counter to free up one space to start transfers again!
                popTransferQueue(); // check if there are any queued transfers
                return result;
            }

            function filetransfer(isDownload, serverUrl, localPath, transferOptions, onprogress) {
                // console.log(isDownload,serverUrl,localPath)
                // if (typeof transferOptions === 'function') {
                //     onprogress = transferOptions;
                //     transferOptions = {};
                // }
                if (isCordova && localPath.indexOf('://') < 0) localPath = toInternalURLSync(localPath);

                transferOptions = transferOptions || {};
                if (!transferOptions.retry || !transferOptions.retry.length) {
                    transferOptions.retry = options.retry;
                }
                transferOptions.retry = transferOptions.retry.concat();
                if (!transferOptions.file && !isDownload) {
                    transferOptions.fileName = filename(localPath);
                }

                var ft = new FileTransfer();
                // console.log("before onprogress", onprogress)
                onprogress = onprogress || transferOptions.onprogress;
                // console.log("onprogress", onprogress)
                if (typeof onprogress === 'function') ft.onprogress = onprogress;
                // console.log("FileTransfer", ft)
                var promise = new Promise(function(resolve, reject) {
                    var attempt = function(err) {
                        if (transferOptions.retry.length === 0) {
                            reject(err);
                        } else {
                            transferQueue.unshift([ft, isDownload, serverUrl, localPath, resolve, attempt, transferOptions.trustAllHosts || false, transferOptions]);
                            var timeout = transferOptions.retry.shift();
                            if (timeout > 0) {
                                setTimeout(nextTransfer, timeout);
                            } else {
                                nextTransfer();
                            }
                        }
                    };
                    transferOptions.retry.unshift(0);
                    inprogress++;
                    attempt();
                });
                promise.then(nextTransfer, nextTransfer);
                promise.progress = function(onprogress) {
                    ft.onprogress = onprogress;
                    return promise;
                };
                promise.abort = function() {
                    ft._aborted = true;
                    ft.abort();
                    return promise;
                };
                return promise;
            }

            function download(url, dest, options, onprogress) {
                // console.log("NDWL", url, dest)
                return filetransfer(true, url, dest, options, onprogress);
            }

            function upload(source, dest, options, onprogress) {
                return filetransfer(false, dest, source, options, onprogress);
            }

            return {
                fs: fs,
                normalize: normalize,
                file: file,
                filename: filename,
                dir: dir,
                dirname: dirname,
                create: create,
                read: read,
                readJSON: readJSON,
                write: write,
                move: move,
                copy: copy,
                remove: remove,
                removeDir: removeDir,
                list: list,
                ensure: ensure,
                exists: exists,
                download: download,
                upload: upload,
                toURL: toURL,
                isCordova: isCordova,
                toInternalURLSync: toInternalURLSync,
                toInternalURL: toInternalURL,
                toDataURL: toDataURL,
                deviceready: deviceready,
                options: options,
                Promise: Promise
            };
        };


        /***/
    },
    /* 4 */
    /***/
    function(module, exports, __webpack_require__) {

        /* WEBPACK VAR INJECTION */
        (function(setImmediate) { /**@license MIT-promiscuous-©Ruben Verborgh*/
            (function(func, obj) {
                // Type checking utility function
                function is(type, item) {
                    return (typeof item)[0] == type;
                }

                // Creates a promise, calling callback(resolve, reject), ignoring other parameters.
                function Promise(callback, handler) {
                    // The `handler` variable points to the function that will
                    // 1) handle a .then(resolved, rejected) call
                    // 2) handle a resolve or reject call (if the first argument === `is`)
                    // Before 2), `handler` holds a queue of callbacks.
                    // After 2), `handler` is a finalized .then handler.
                    handler = function pendingHandler(resolved, rejected, value, queue, then, i) {
                        queue = pendingHandler.q;

                        // Case 1) handle a .then(resolved, rejected) call
                        if (resolved != is) {
                            return Promise(function(resolve, reject) {
                                queue.push({
                                    p: this,
                                    r: resolve,
                                    j: reject,
                                    1: resolved,
                                    0: rejected
                                });
                            });
                        }

                        // Case 2) handle a resolve or reject call
                        // (`resolved` === `is` acts as a sentinel)
                        // The actual function signature is
                        // .re[ject|solve](<is>, success, value)

                        // Check if the value is a promise and try to obtain its `then` method
                        if (value && (is(func, value) | is(obj, value))) {
                            try {
                                then = value.then;
                            } catch (reason) {
                                rejected = 0;
                                value = reason;
                            }
                        }
                        // If the value is a promise, take over its state
                        if (is(func, then)) {
                            function valueHandler(resolved) {
                                return function(value) {
                                    then && (then = 0, pendingHandler(is, resolved, value));
                                };
                            }
                            try {
                                then.call(value, valueHandler(1), rejected = valueHandler(0));
                            } catch (reason) {
                                rejected(reason);
                            }
                        }
                        // The value is not a promise; handle resolve/reject
                        else {
                            // Replace this handler with a finalized resolved/rejected handler
                            handler = function(Resolved, Rejected) {
                                // If the Resolved or Rejected parameter is not a function,
                                // return the original promise (now stored in the `callback` variable)
                                if (!is(func, (Resolved = rejected ? Resolved : Rejected)))
                                    return callback;
                                // Otherwise, return a finalized promise, transforming the value with the function
                                return Promise(function(resolve, reject) {
                                    finalize(this, resolve, reject, value, Resolved);
                                });
                            };
                            // Resolve/reject pending callbacks
                            i = 0;
                            while (i < queue.length) {
                                then = queue[i++];
                                // If no callback, just resolve/reject the promise
                                if (!is(func, resolved = then[rejected]))
                                    (rejected ? then.r : then.j)(value);
                                // Otherwise, resolve/reject the promise with the result of the callback
                                else
                                    finalize(then.p, then.r, then.j, value, resolved);
                            }
                        }
                    };
                    // The queue of pending callbacks; garbage-collected when handler is resolved/rejected
                    handler.q = [];

                    // Create and return the promise (reusing the callback variable)
                    callback.call(callback = {
                            then: function(resolved, rejected) {
                                return handler(resolved, rejected);
                            },
                            catch: function(rejected) {
                                return handler(0, rejected);
                            }
                        },
                        function(value) {
                            handler(is, 1, value);
                        },
                        function(reason) {
                            handler(is, 0, reason);
                        });
                    return callback;
                }

                // Finalizes the promise by resolving/rejecting it with the transformed value
                function finalize(promise, resolve, reject, value, transform) {
                    setImmediate(function() {
                        try {
                            // Transform the value through and check whether it's a promise
                            value = transform(value);
                            transform = value && (is(obj, value) | is(func, value)) && value.then;
                            // Return the result if it's not a promise
                            if (!is(func, transform))
                                resolve(value);
                            // If it's a promise, make sure it's not circular
                            else if (value == promise)
                                reject(TypeError());
                            // Take over the promise's state
                            else
                                transform.call(value, resolve, reject);
                        } catch (error) {
                            reject(error);
                        }
                    });
                }

                // Export the main module
                module.exports = Promise;

                // Creates a resolved promise
                Promise.resolve = ResolvedPromise;

                function ResolvedPromise(value) {
                    return Promise(function(resolve) {
                        resolve(value);
                    });
                }

                // Creates a rejected promise
                Promise.reject = function(reason) {
                    return Promise(function(resolve, reject) {
                        reject(reason);
                    });
                };

                // Transforms an array of promises into a promise for an array
                Promise.all = function(promises) {
                    return Promise(function(resolve, reject, count, values) {
                        // Array of collected values
                        values = [];
                        // Resolve immediately if there are no promises
                        count = promises.length || resolve(values);
                        // Transform all elements (`map` is shorter than `forEach`)
                        promises.map(function(promise, index) {
                            ResolvedPromise(promise).then(
                                // Store the value and resolve if it was the last
                                function(value) {
                                    values[index] = value;
                                    --count || resolve(values);
                                },
                                // Reject if one element fails
                                reject);
                        });
                    });
                };
            })('f', 'o');

            /* WEBPACK VAR INJECTION */
        }.call(exports, __webpack_require__(6).setImmediate))

        /***/
    },
    /* 5 */
    /***/
    function(module, exports, __webpack_require__) {

        /**
         * JS Implementation of MurmurHash3 (r136) (as of May 20, 2011)
         *
         * @author <a href="mailto:gary.court@gmail.com">Gary Court</a>
         * @see http://github.com/garycourt/murmurhash-js
         * @author <a href="mailto:aappleby@gmail.com">Austin Appleby</a>
         * @see http://sites.google.com/site/murmurhash/
         *
         * @param {string} key ASCII only
         * @param {number} seed Positive integer only
         * @return {number} 32-bit positive integer hash
         */

        function murmurhash3_32_gc(key, seed) {
            var remainder, bytes, h1, h1b, c1, c1b, c2, c2b, k1, i;

            remainder = key.length & 3; // key.length % 4
            bytes = key.length - remainder;
            h1 = seed;
            c1 = 0xcc9e2d51;
            c2 = 0x1b873593;
            i = 0;

            while (i < bytes) {
                k1 =
                    ((key.charCodeAt(i) & 0xff)) |
                    ((key.charCodeAt(++i) & 0xff) << 8) |
                    ((key.charCodeAt(++i) & 0xff) << 16) |
                    ((key.charCodeAt(++i) & 0xff) << 24);
                ++i;

                k1 = ((((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16))) & 0xffffffff;
                k1 = (k1 << 15) | (k1 >>> 17);
                k1 = ((((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16))) & 0xffffffff;

                h1 ^= k1;
                h1 = (h1 << 13) | (h1 >>> 19);
                h1b = ((((h1 & 0xffff) * 5) + ((((h1 >>> 16) * 5) & 0xffff) << 16))) & 0xffffffff;
                h1 = (((h1b & 0xffff) + 0x6b64) + ((((h1b >>> 16) + 0xe654) & 0xffff) << 16));
            }

            k1 = 0;

            switch (remainder) {
                case 3:
                    k1 ^= (key.charCodeAt(i + 2) & 0xff) << 16;
                case 2:
                    k1 ^= (key.charCodeAt(i + 1) & 0xff) << 8;
                case 1:
                    k1 ^= (key.charCodeAt(i) & 0xff);

                    k1 = (((k1 & 0xffff) * c1) + ((((k1 >>> 16) * c1) & 0xffff) << 16)) & 0xffffffff;
                    k1 = (k1 << 15) | (k1 >>> 17);
                    k1 = (((k1 & 0xffff) * c2) + ((((k1 >>> 16) * c2) & 0xffff) << 16)) & 0xffffffff;
                    h1 ^= k1;
            }

            h1 ^= key.length;

            h1 ^= h1 >>> 16;
            h1 = (((h1 & 0xffff) * 0x85ebca6b) + ((((h1 >>> 16) * 0x85ebca6b) & 0xffff) << 16)) & 0xffffffff;
            h1 ^= h1 >>> 13;
            h1 = ((((h1 & 0xffff) * 0xc2b2ae35) + ((((h1 >>> 16) * 0xc2b2ae35) & 0xffff) << 16))) & 0xffffffff;
            h1 ^= h1 >>> 16;

            return h1 >>> 0;
        }

        module.exports = murmurhash3_32_gc;

        /***/
    },
    /* 6 */
    /***/
    function(module, exports, __webpack_require__) {

        /* WEBPACK VAR INJECTION */
        (function(setImmediate, clearImmediate) {
            var nextTick = __webpack_require__(7).nextTick;
            var apply = Function.prototype.apply;
            var slice = Array.prototype.slice;
            var immediateIds = {};
            var nextImmediateId = 0;

            // DOM APIs, for completeness

            exports.setTimeout = function() {
                return new Timeout(apply.call(setTimeout, window, arguments), clearTimeout);
            };
            exports.setInterval = function() {
                return new Timeout(apply.call(setInterval, window, arguments), clearInterval);
            };
            exports.clearTimeout =
                exports.clearInterval = function(timeout) {
                    timeout.close();
                };

            function Timeout(id, clearFn) {
                this._id = id;
                this._clearFn = clearFn;
            }
            Timeout.prototype.unref = Timeout.prototype.ref = function() {};
            Timeout.prototype.close = function() {
                this._clearFn.call(window, this._id);
            };

            // Does not start the time, just sets up the members needed.
            exports.enroll = function(item, msecs) {
                clearTimeout(item._idleTimeoutId);
                item._idleTimeout = msecs;
            };

            exports.unenroll = function(item) {
                clearTimeout(item._idleTimeoutId);
                item._idleTimeout = -1;
            };

            exports._unrefActive = exports.active = function(item) {
                clearTimeout(item._idleTimeoutId);

                var msecs = item._idleTimeout;
                if (msecs >= 0) {
                    item._idleTimeoutId = setTimeout(function onTimeout() {
                        if (item._onTimeout)
                            item._onTimeout();
                    }, msecs);
                }
            };

            // That's not how node.js implements it but the exposed api is the same.
            exports.setImmediate = typeof setImmediate === "function" ? setImmediate : function(fn) {
                var id = nextImmediateId++;
                var args = arguments.length < 2 ? false : slice.call(arguments, 1);

                immediateIds[id] = true;

                nextTick(function onNextTick() {
                    if (immediateIds[id]) {
                        // fn.call() is faster so we optimize for the common use-case
                        // @see http://jsperf.com/call-apply-segu
                        if (args) {
                            fn.apply(null, args);
                        } else {
                            fn.call(null);
                        }
                        // Prevent ids from leaking
                        exports.clearImmediate(id);
                    }
                });

                return id;
            };

            exports.clearImmediate = typeof clearImmediate === "function" ? clearImmediate : function(id) {
                delete immediateIds[id];
            };
            /* WEBPACK VAR INJECTION */
        }.call(exports, __webpack_require__(6).setImmediate, __webpack_require__(6).clearImmediate))

        /***/
    },
    /* 7 */
    /***/
    function(module, exports, __webpack_require__) {

        // shim for using process in browser

        var process = module.exports = {};
        var queue = [];
        var draining = false;

        function drainQueue() {
            if (draining) {
                return;
            }
            draining = true;
            var currentQueue;
            var len = queue.length;
            while (len) {
                currentQueue = queue;
                queue = [];
                var i = -1;
                while (++i < len) {
                    currentQueue[i]();
                }
                len = queue.length;
            }
            draining = false;
        }
        process.nextTick = function(fun) {
            queue.push(fun);
            if (!draining) {
                setTimeout(drainQueue, 0);
            }
        };

        process.title = 'browser';
        process.browser = true;
        process.env = {};
        process.argv = [];
        process.version = ''; // empty string to avoid regexp issues
        process.versions = {};

        function noop() {}

        process.on = noop;
        process.addListener = noop;
        process.once = noop;
        process.off = noop;
        process.removeListener = noop;
        process.removeAllListeners = noop;
        process.emit = noop;

        process.binding = function(name) {
            throw new Error('process.binding is not supported');
        };

        // TODO(shtylman)
        process.cwd = function() {
            return '/'
        };
        process.chdir = function(dir) {
            throw new Error('process.chdir is not supported');
        };
        process.umask = function() {
            return 0;
        };


        /***/
    }
    /******/
]);
