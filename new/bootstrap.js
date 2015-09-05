(function() {
    window.localRoot = 'NistagmusPersistent';
    window.tempRoot = 'NistagmusTemporary';
    window.mobile = window.location.href.slice(0, 12).indexOf("file://") > -1
    window.fromCache = window.fromCache || false;

    var el,
        head = document.getElementsByTagName('head')[0];

    window.pegasus = function pegasus(a, raw, xhr) {
        xhr = new XMLHttpRequest();
        xhr.open('GET', a + "?" + Date.now());
        a = [];
        xhr.onreadystatechange = xhr.then = function(onSuccess, onError, cb) {
            if (onSuccess.call) a = [onSuccess, onError];
            if (xhr.readyState == 4) {
                cb = a[0 | xhr.status / 400];
                if (cb) cb(xhr.status === 200 || xhr.status === 0 ? (raw ? xhr.responseText : JSON.parse(xhr.responseText)) : xhr);
            }
        };
        xhr.send();
        return xhr;
    };

    function loadManifest(manifest, fromLocalStorage, timeout) {
        if (!manifest.load) {
            console.error('Manifest has nothing to load (manifest.load is empty).', manifest);
            return;
        }

        var scripts = manifest.load.concat(),
            now = Date.now();

        function loadIndex() {
            console.log("CACHED INDEX", window.fromCache)
            if (window.fromCache || !window.mobile) {
                if (!fromLocalStorage){
                    localStorage.setItem('manifest', JSON.stringify(manifest));
                }
                return loadCordova();
            }
            var index = 'cdvfile://localhost/persistent/'+window.localRoot+'/index.html';
            window.pegasus(index, true).then(function(data) {
                console.log("Load cached index")
                window.fromCache = true;
                document.open();
                document.write(data);
                document.close();
            }, function(xhr) {
                console.log("No index in cdv");
                // window.fromCache = true;
                if (!fromLocalStorage){
                    localStorage.setItem('manifest', JSON.stringify(manifest));
                }
                loadCordova();
            })
        }

        function loadCordova(){
            if(window.mobile){
                el = document.createElement('script');
                el.type = 'text/javascript';
                el.src = './cordova.js';
                head.appendChild(el);
                document.addEventListener("deviceready", waitPlugins, false);
            }else{
                loadScripts();
            }
        }

        function waitPlugins(){
            // var wait = setInterval(function(){
            //     var scripts = [].slice.call(document.getElementsByTagName("script"));
            //     var ok = scripts.some(function(scr){
            //         return scr.src && scr.src.indexOf("cordova-plugin-whitelist") > -1;
            //     })
            //     if(ok){
            //         clearInterval(wait);
            //         setTimeout(loadScripts, 10);
            //     }
            // })
            setTimeout(loadScripts, 1000*1.5);
        };

        function loadScripts() {
            window.store && window.store.ready(true);
            if (window.mobile && window.fromCache) {
                var base = document.createElement("base");
                base.href = "cdvfile://localhost/persistent/" + window.localRoot + "/";
                head.appendChild(base);
            }
            scripts.forEach(function(path) {
                if (!path) return;
                if (path[0] === '/') path = path.substr(1);
                var src = manifest.root + path;
                var ext = src.split(".").pop();
                switch (true) {
                    case ext === "js":
                        el = document.createElement('script');
                        el.type = 'text/javascript';
                        el.src = src+'?'+now;
                        el.async = false;
                        break;
                    case ext === "css":
                        el = document.createElement('link');
                        el.rel = "stylesheet";
                        el.href = src+'?'+now;
                        el.type = "text/css";
                        break;
                }
                head.appendChild(el);
            });
        }

        manifest.root = manifest.root || './';
        if (manifest.root.length > 0 && manifest.root[manifest.root.length - 1] !== '/')
            manifest.root += '/';

        loadIndex();

        window.Manifest = manifest;
    }

    window.Manifest = {};
    var manifest //= JSON.parse(localStorage.getItem('manifest'));
    var s = document.querySelector('script[manifest]');
    if (!manifest) {
        var url = (s ? s.getAttribute('manifest') : null) || 'manifest.json';
        var local = window.mobile
            ? "cdvfile://localhost/persistent/"+window.localRoot+"/"
            : "";
        pegasus(local+url).then(loadManifest, function(xhr) {
            pegasus(url).then(loadManifest, function(xhr){
                console.error('Could not download ' + url + ': ' + xhr.status);
            });
        });
    } else {
        loadManifest(manifest, true, s.getAttribute('timeout') || 10000);
    }
})();
