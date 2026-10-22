import React, { useState, useEffect } from 'react';
import ClientEventPage from './pages/ClientEventPage';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import { adminApi } from './services/api';

export default function App() {
  // Routes: 'CLIENT' | 'ADMIN'
  const [route, setRoute] = useState('CLIENT');
  const [eventSlug, setEventSlug] = useState('sample-event');
  const [adminUser, setAdminUser] = useState(null);

  // Sync route with URL path
  useEffect(() => {
    const handleLocation = () => {
      const path = window.location.pathname;
      if (path.startsWith('/admin')) {
        setRoute('ADMIN');
        const token = adminApi.getToken();
        if (token) {
          setAdminUser({ role: 'ADMIN' });
        }
      } else if (path.startsWith('/event/')) {
        const slug = path.split('/event/')[1];
        if (slug) {
          setEventSlug(slug);
          setRoute('CLIENT');
        }
      } else {
        setRoute('CLIENT');
      }
    };

    handleLocation();
    window.addEventListener('popstate', handleLocation);
    return () => window.removeEventListener('popstate', handleLocation);
  }, []);

  const navigateToClient = (slug) => {
    const targetSlug = slug || eventSlug;
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
