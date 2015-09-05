(function() {
    if(!window.mobile) return;

    var onprogress = function(ev){
        var bar = document.getElementById("progressBar");
        var status = document.getElementById("progressStatus");
        var width = function(ev){
            var rez = ev.percentage*100;
            return rez+"%";
        };
        console.log("PROGRESS EVENT");
        console.log(ev && ev.percentage);
        if(ev && ev.percentage){
            ev.copy ? (status.textContent = "PROCESSING") : (status.textContent = "DOWNLOADING");
            bar.style.width = width(ev);
        }
    }

    var serverRoot;
    var fs;
    var script = document.querySelector('script[server]');

    if (script){
        var devuuids = script.getAttribute('devuuids') || null;
        devuuids && (devuuids == devuuids.split(' '));
        var isDev = devuuids && window.device && devuuids.indexOf(window.device.uuid) > -1;
        var servAttr = isDev ? 'devserver' : 'server';
        serverRoot = script.getAttribute(servAttr);
    }
    if (!serverRoot) {
        throw new Error('Add a "server" attribute to the bootstrap.js script!');
    }

    if(!fs)fs = new CordovaPromiseFS({
        persistent: window.mobile,
        Promise: Promise
    });

    if(!window.loader)
    window.loader = new CordovaAppLoader({
        fs: fs,
        localRoot: window.localRoot,
        tempRoot: window.tempRoot,
        serverRoot: serverRoot,
        mode: 'mirror',
        cacheBuster: true
    });

    function check(newManfiestURL, onprogress) {
        loader.check(newManfiestURL)
            .then(function(updateNeeded){
                console.log("updateNeeded",updateNeeded)
                // alert("updateNeeded "+updateNeeded);
                if(updateNeeded == true){
                    return new Promise(function(resolve,reject){
                        // confirm("Download?", function(butt){
                        //     if(butt == 3){
                                goTo("Update");
                                return loader.download(onprogress).then(resolve,reject);
                        //     }
                        // }, "Update available!", ["Later","","YES!"])
                    });
                };
            }, function(err){
                if(err !== false && err !== 408)
                console.error('Check Error:', err);
            })
            .then(function(){ //on dwld
                return loader.update();
            }, function(err){
                alert("Pleaase try again later.", null, "Download error");
                goTo("Splash");
                console.error('Download Error:', err);
            })
            .then(function(ok){ //on upd
                if(!ok)return;
                console.log("DONE");
                localStorage.setItem('manifest', JSON.stringify(loader.newManifest));
                loader.cache.clear()
                    .then(function(){
                        if(localStorage.feedback == 'message') localStorage.feedback = null;
                        location.reload();
                    })
            }, function(err){
                console.error("Update err:", err);
                goTo("Splash");
                return loader.cache.clear();
            })
    }

    check(null, onprogress);

    isDev && fs.deviceready.then(function() {
        document.addEventListener('resume', function(){
            check(null, onprogress)
        });
    });

})();