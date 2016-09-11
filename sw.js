const SilM_WorkerVersion = 1;
const SilM_CacheName = `SilverbirdM_Cache_Version${SilM_WorkerVersion}`;
const SilM_CachePath = [
  "fonts.googleapis.com",
  "fonts.gstatic.com"
];

self.addEventListener("install", (event) => {
  //console.info(`sw:install: %o`, event);
  event.waitUntil(Promise.all([
    self.skipWaiting(),
    caches.open(SilM_CacheName).then((cache) => {
      console.info(`sw:install: open cache: ${SilM_CacheName}`);
    })
  ]));
});

self.addEventListener("activate", (event) => {
  //console.info(`sw:activate: %o`, event);
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then((cacheNames) => {
      return Promise.all(cacheNames.map((cacheName) => {
        if(cacheName !== SilM_CacheName) {
          console.info(`sw:activate: delete cache: %s`, cacheName);
          return caches.delete(cacheName);
        }
      }));
    })
  ]));
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  if(url.includes("chrome-extension://")) {
    return;
  }
  if(SilM_CachePath.reduce((prev, current, index, array) => {
    return url.includes(current) || prev;
  }, false)) {
    event.respondWith(
      caches.open(SilM_CacheName).then((cache) => {
        return cache.match(event.request).then((response) => {
          if(response) {
            return response;
          } else {
            return fetch(event.request.clone()).then((response) => {
              if(response.ok) {
                cache.put(event.request, response.clone());
              }
              return response;
            });
          }
        });
      }).catch((e) => {
        console.warn(`sw:fetch: respondWith: %o`, e);
      })
    )
  }
  //console.info(`sw:fetch: %o`, event);
});

self.addEventListener("message", (event) => {
  if(!event.data) {
    return;
  }
  switch(true) {
    default:
      console.info(`sw:message: %o`, event);
      break;
  }
});
