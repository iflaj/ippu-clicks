import React, { useState, useEffect } from 'react';
import ClientEventPage from './pages/ClientEventPage';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import { adminApi } from './services/api';

/**
 * Parses the current browser pathname to determine the active route and event slug.
 * Handles trailing slashes, query parameters, and URL encoding cleanly.
 */
function parseCurrentLocation() {
  if (typeof window === 'undefined') {
    return { route: 'CLIENT', eventSlug: 'sample-event' };
  }

  const pathname = window.location.pathname || '/';

  if (pathname.startsWith('/admin')) {
    return { route: 'ADMIN', eventSlug: '' };
  }

  if (pathname.startsWith('/event/')) {
    // Extract everything after /event/ and before any subsequent slash, query param, or hash
    const rawSlug = pathname.replace(/^\/event\/?/, '').split('/')[0].split('?')[0].split('#')[0];
    const cleanSlug = decodeURIComponent(rawSlug || '').trim();
    return {
      route: 'CLIENT',
      eventSlug: cleanSlug || 'sample-event'
    };
  }

  return { route: 'CLIENT', eventSlug: 'sample-event' };
}

export default function App() {
  const initial = parseCurrentLocation();

  // Routes: 'CLIENT' | 'ADMIN'
  const [route, setRoute] = useState(initial.route);
  const [eventSlug, setEventSlug] = useState(initial.eventSlug);
  const [adminUser, setAdminUser] = useState(() => {
    if (initial.route === 'ADMIN' && adminApi.getToken()) {
      return { role: 'ADMIN' };
    }
    return null;
  });

  // Sync route with URL path on back/forward browser navigation
  useEffect(() => {
    const handleLocation = () => {
      const loc = parseCurrentLocation();
      setRoute(loc.route);

      if (loc.eventSlug) {
        setEventSlug(loc.eventSlug);
      }

      if (loc.route === 'ADMIN') {
        const token = adminApi.getToken();
        if (token) {
          setAdminUser({ role: 'ADMIN' });
        }
      }
    };

    window.addEventListener('popstate', handleLocation);
    return () => window.removeEventListener('popstate', handleLocation);
  }, []);

  const navigateToClient = (slug) => {
    const targetSlug = (slug || eventSlug || 'sample-event').toString().trim().replace(/\/+$/, '');
    setEventSlug(targetSlug);
    window.history.pushState({}, '', `/event/${targetSlug}`);
    setRoute('CLIENT');
  };

  const handleAdminLogout = () => {
    adminApi.logout();
    setAdminUser(null);
    window.history.pushState({}, '', '/');
    setRoute('CLIENT');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0c]">
      {route === 'ADMIN' ? (
        !adminUser ? (
          <AdminLogin onLoginSuccess={(user) => setAdminUser(user)} />
        ) : (
          <AdminDashboard
            onLogout={handleAdminLogout}
            onNavigateToEvent={(slug) => navigateToClient(slug)}
          />
        )
      ) : (
        <ClientEventPage slug={eventSlug} />
      )}
    </div>
  );
}

