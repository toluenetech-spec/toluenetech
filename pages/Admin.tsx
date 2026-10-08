import React, { useEffect, useState } from 'react';
import AdminShell from '../components/admin/Shell';
import Login from '../components/admin/Login';
import '../index-admin.css';
import { useAuth } from '../context/AuthContext';

export default function Admin() {
  const { isAuthenticated, login, logout } = useAuth();
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  if (!ready) return null;
  // When authed but URL is exactly '/admin' (no subpath), push dashboard.
  // The Login component handles nav('/admin/dashboard') after a successful
  // submit; this useEffect is a safety net for people who land on /admin
  // directly with an existing session.
  if (isAuthenticated) {
    const here = window.location.hash.replace(/^#/, '') || '/';
    if (here === '/admin' || here === '/admin/') {
      // Use replaceState to avoid adding to history; do it outside render.
      queueMicrotask(() => { window.location.hash = '#/admin/dashboard'; });
    }
    return <AdminShell onLogout={logout}/>;
  }
  return <Login onLogin={login}/>;
}
