import React, { useEffect, useState } from 'react';
import AdminShell from '../components/admin/Shell';
import Login from '../components/admin/Login';
import '../index-admin.css';
import { useAuth } from '../context/AuthContext';

export default function Admin() {
  const { isAuthenticated, logout } = useAuth();
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  if (!ready) return null;
  if (isAuthenticated) {
    const here = window.location.hash.replace(/^#/, '') || '/';
    if (here === '/admin' || here === '/admin/') {
      queueMicrotask(() => { window.location.hash = '#/admin/dashboard'; });
    }
    return <AdminShell onLogout={logout}/>;
  }
  return <Login/>;
}
