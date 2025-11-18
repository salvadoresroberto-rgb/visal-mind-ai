// Visual Mind AI - Service Worker v1.0.0
// Estrategia: Network First con fallback a cache para máxima actualización

const CACHE_NAME = 'visual-mind-ai-v1.0.0';
const RUNTIME_CACHE = 'visual-mind-runtime-v1.0.0';

// Recursos críticos para cachear en instalación
const PRECACHE_URLS = [
  '/',
  '/visual-mind-ai-pwa.html',
  '/index.html',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js'
];

// URLs externas que NO se deben cachear
const NO_CACHE_URLS = [
  'https://api.anthropic.com'
];

// INSTALACIÓN: Cachear recursos críticos
self.addEventListener('install', (event) => {
  console.log('[SW] Instalando Service Worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Cacheando recursos críticos');
        return cache.addAll(PRECACHE_URLS.map(url => new Request(url, { mode: 'no-cors' })))
          .catch(err => {
            console.warn('[SW] Error cacheando algunos recursos:', err);
            // No fallar la instalación si algunos recursos no se pueden cachear
            return Promise.resolve();
          });
      })
      .then(() => self.skipWaiting())
  );
});

// ACTIVACIÓN: Limpiar cachés viejos
self.addEventListener('activate', (event) => {
  console.log('[SW] Activando Service Worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((cacheName) => {
              return cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE;
            })
            .map((cacheName) => {
              console.log('[SW] Eliminando caché antiguo:', cacheName);
              return caches.delete(cacheName);
            })
        );
      })
      .then(() => self.clients.claim())
  );
});

// FETCH: Estrategia Network First con fallback a cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip requests que no deben cachearse
  if (NO_CACHE_URLS.some(noCache => url.href.startsWith(noCache))) {
    return; // Dejar que el navegador maneje normalmente
  }

  // Solo cachear GET requests
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Si la respuesta es válida, cachearla
        if (response && response.status === 200 && response.type !== 'opaque') {
          const responseToCache = response.clone();
          
          caches.open(RUNTIME_CACHE)
            .then((cache) => {
              cache.put(request, responseToCache);
            })
            .catch(err => console.warn('[SW] Error cacheando respuesta:', err));
        }
        
        return response;
      })
      .catch(() => {
        // Network falló, intentar desde cache
        return caches.match(request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[SW] Sirviendo desde cache:', request.url);
              return cachedResponse;
            }
            
            // Si no hay cache, retornar respuesta offline personalizada
            if (request.headers.get('accept').includes('text/html')) {
              return new Response(
                `<!DOCTYPE html>
                <html lang="es">
                <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Visual Mind AI - Sin Conexión</title>
                  <style>
                    body {
                      font-family: system-ui, -apple-system, sans-serif;
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      min-height: 100vh;
                      margin: 0;
                      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                      color: white;
                      text-align: center;
                      padding: 20px;
                    }
                    .container {
                      max-width: 400px;
                    }
                    h1 {
                      font-size: 3em;
                      margin: 0 0 20px 0;
                    }
                    p {
                      font-size: 1.2em;
                      margin: 10px 0;
                      color: #94a3b8;
                    }
                    button {
                      margin-top: 30px;
                      padding: 15px 30px;
                      font-size: 1em;
                      background: #22d3ee;
                      color: #0c1e3d;
                      border: none;
                      border-radius: 10px;
                      cursor: pointer;
                      font-weight: bold;
                    }
                    button:hover {
                      background: #06b6d4;
                    }
                  </style>
                </head>
                <body>
                  <div class="container">
                    <h1>⚠️</h1>
                    <h2>Sin Conexión</h2>
                    <p>Visual Mind AI requiere conexión a internet para funcionar completamente.</p>
                    <p>Verifica tu conexión e intenta nuevamente.</p>
                    <button onclick="location.reload()">Reintentar</button>
                  </div>
                </body>
                </html>`,
                {
                  headers: { 'Content-Type': 'text/html' }
                }
              );
            }
            
            // Para otros tipos de recursos, retornar error 503
            return new Response('Service Unavailable', { status: 503 });
          });
      })
  );
});

// MENSAJES: Comunicación con la app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then((cacheNames) => {
          return Promise.all(
            cacheNames.map((cacheName) => caches.delete(cacheName))
          );
        })
        .then(() => {
          console.log('[SW] Caché limpiado exitosamente');
          return self.clients.matchAll();
        })
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({
              type: 'CACHE_CLEARED',
              message: 'Caché limpiado exitosamente'
            });
          });
        })
    );
  }
});

// SINCRONIZACIÓN EN BACKGROUND (Background Sync API)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-recordings') {
    console.log('[SW] Sincronizando grabaciones en background...');
    event.waitUntil(syncRecordings());
  }
});

async function syncRecordings() {
  // Placeholder para sincronización futura con servidor
  console.log('[SW] Función de sincronización ejecutándose');
  return Promise.resolve();
}

// NOTIFICACIONES PUSH (Push API) - Preparado para futuro
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Visual Mind AI';
  const options = {
    body: data.body || 'Nueva notificación',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'default',
    requireInteraction: data.requireInteraction || false,
    data: data.data || {}
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// CLICK EN NOTIFICACIÓN
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Si ya hay una ventana abierta, enfocarla
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        // Si no hay ventana abierta, abrir una nueva
        if (self.clients.openWindow) {
          return self.clients.openWindow('/');
        }
      })
  );
});

console.log('[SW] Service Worker cargado exitosamente');
