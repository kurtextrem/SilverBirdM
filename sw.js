const SilM_WorkerVersion = 1;
const SilM_CacheName = `SilverbirdM_Cache_Version${SilM_WorkerVersion}`;

self.addEventListener("install", (event) => {
  console.log(`sw:install: %o`, event);
  event.waitUntil(skipWaiting());
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if(url.includes("chrome-extension://")) {
    return;
  }
  console.log(`sw:fetch: %o`, event);
});
self.addEventListener("message", (event) => {
});
