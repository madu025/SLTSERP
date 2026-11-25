/**
 * After a deploy the JavaScript files get new names and the old ones are gone. A page (or a browser tab) that still holds the
 * old HTML then asks for files that no longer exist, React never starts, and the person sees "Loading sign-in…" until a manual refresh.
 *
 * This small script runs inline in the page head, before any bundle, so it still works when every bundle fails: when a file under
 * /_next/static/ cannot be loaded (or a code-split chunk fails later), the page reloads ONCE (never twice within a minute, so a real
 * outage cannot cause a reload loop) and gets the new HTML.
 */
export const CHUNK_RECOVERY_SCRIPT = String.raw`(function(){
var K='chunk-reload-at';
function recover(){try{var t=+sessionStorage.getItem(K)||0;if(Date.now()-t<60000)return;sessionStorage.setItem(K,String(Date.now()));}catch(e){}location.reload();}
var CHUNK=/ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module/;
window.addEventListener('error',function(e){var t=e.target;if(t&&(t.tagName==='SCRIPT'||t.tagName==='LINK')){var u=t.src||t.href||'';if(u.indexOf('/_next/static/')>-1)recover();return;}if(CHUNK.test(String(e.message||'')))recover();},true);
window.addEventListener('unhandledrejection',function(e){var r=e.reason;if(CHUNK.test(String(r&&(r.name+' '+r.message)||r)))recover();});
})();`;
