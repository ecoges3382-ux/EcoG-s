// Ce code s'exécute quand le téléphone reçoit une notification du serveur
self.addEventListener('push', function (event) {
  if (event.data) {
    // Un message mal formé ne doit pas empêcher la notification de s'afficher
    // (sinon le navigateur en affiche une générique à la place).
    let data;
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'EcoGès', body: event.data.text() };
    }

    const options = {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/badge-96x96.png',
      vibrate: [100, 50, 100],
      data: {
        dateOfArrival: Date.now(),
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'EcoGès', options)
    );
  }
});

// Ce code s'exécute quand l'utilisateur clique sur la notification
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  
  // On s'assure que l'URL de redirection est valide
  const target = (event.notification.data && event.notification.data.url) || '/';
  const urlToOpen = new URL(target, self.location.origin).href;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Si l'application est déjà ouverte, on la met au premier plan
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Sinon, on ouvre une nouvelle fenêtre
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
