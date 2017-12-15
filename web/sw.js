self.importScripts('https://unpkg.com/idb-keyval@2.3.0/dist/idb-keyval-min.js')

const contentTypeHeader = new Headers({ 'Content-Type': 'application/json' })
const CACHE_NAME = 't-rex-cache-v1';
const cactusIds = ['70369520-e9bb-4895-9d7e-c32a64df3db3', 'f8b69c6b-74f0-40f9-916f-c5293f27fe10'];
const urlsToCache = [
  // caches all files in t-rex-vr
  '/',
  // caches all external files/ libraries
  'https://ucarecdn.com/d86697ef-c9b9-4b74-912b-6e332adc80cd/',
  'https://aframe.io/releases/0.7.0/aframe.min.js',
  'https://dist.3d.io/3dio-js/1.x.x/3dio.min.js',
  'https://cdn.rawgit.com/zcanter/aframe-gradient-sky/master/dist/gradientsky.min.js'
];

self.addEventListener('install', function(event) {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('Opened cache');
        // cache GET requests
        return cache.addAll(urlsToCache)
      })
      .then(function() {
        // and POST requests
        for (i = 0; i < cactusIds.length; i++) {
          let cactusId = cactusIds[i]
          let requestBody = { 'jsonrpc': '2.0', 'method': 'Product.read', 'params': { 'resourceId': cactusId }, 'id': '770f67da-4be0-47fd-bb37-e9b8c45949f9' }
          let request = new Request('https://spaces.archilogic.com/api/v2', { method: 'POST', body: JSON.stringify(requestBody), headers: contentTypeHeader })
          return cacheProductRequest(cactusId, requestBody.id, request)
        }
      })
      .catch(function(err){
        console.log('Could not cache files\n', err)
      })
  );
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Cache hit for GET requests - return response
        if (response) {
          return response;
        }

        // IMPORTANT: Clone the request. A request is a stream and
        // can only be consumed once. Since we are consuming this
        // once by cache and once by the browser for fetch, we need
        // to clone the response.
        var fetchRequest = event.request.clone();
        var cacheRequest = event.request

        // Archilogic JSONRPC requests
        if (event.request.method === 'POST' && event.request.url.match(/spaces.archilogic.com/)) {

          return event.request.json().then(function(jsonRpcRequest) {
            console.log('JSON RPC request', jsonRpcRequest)

            // furniture requests - let's cache them!
            if (jsonRpcRequest.method == 'Product.read') {
              return cacheProductRequest(jsonRpcRequest.params.resourceId, jsonRpcRequest.id, fetchRequest.clone())
            } else {
              // TODO potentially cache?
              return fetch(fetchRequest)
            }
          })
       } else {

        return fetch(fetchRequest).then(
          function(response) {
            // Check if we received a valid response
            if (!response || response.status !== 200 ) {
              return response;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            var responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(function(cache) {
                console.log('put:', cacheRequest.url)
                cache.put(cacheRequest, responseToCache);
              });

            return response;
          });
        }
      })
      .catch(function(err){
        console.log('Fatal error\n',err)
      })
    );
});

function cacheProductRequest(productId, requestId, request) {
  // check if the product is already in the IndexedDB
  return idbKeyval.get(productId).then(function (storedValue) {
    if (storedValue) {
      // need to update id in the response for the 3dio.js to be able to match request and response
      storedValue.id = requestId
      return new Response(new Blob([JSON.stringify(storedValue)]), { headers: contentTypeHeader })
    }

    // if not, let's fetch the product and save it
    console.log('Stored value NOT found!')
    return fetch(request)
      .then(function (response) { return response.json() })
      .then(function (product) {
        idbKeyval.set(productId, product)
        console.log('Product stored')
        return new Response(new Blob([JSON.stringify(product)]), { headers: contentTypeHeader })
      })
  })
}
