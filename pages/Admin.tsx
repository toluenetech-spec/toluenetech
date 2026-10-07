import React, { useEffect, useState } from 'react';
import AdminShell from '../components/admin/Shell';
import Login from '../components/admin/Login';
import '../index-admin.css';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

export default function Admin() {
  const { isAuthenticated, login, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  // After successful sign-in, route to dashboard if user is still on bare /admin.
  useEffect(() => {
    if (isAuthenticated && (loc.pathname === '/admin' || loc.pathname === '/admin/')) {
      nav('/admin/dashboard', { replace: true });
    }
  }, [isAuthenticated, loc.pathname, nav]);
  if (!ready) return null;
  if (!isAuthenticated) return <Login onLogin={login}/>;
  return <AdminShell onLogout={logout}/>;
}
