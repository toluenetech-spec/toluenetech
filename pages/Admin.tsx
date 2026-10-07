import React, { useEffect, useState } from 'react';
import AdminShell from '../components/admin/Shell';
import Login from '../components/admin/Login';
import '../index-admin.css';
import { useAuth } from '../context/AuthContext';

export default function Admin() {
  const { isAuthenticated, login, logout } = useAuth();
  // Avoid hydration flicker
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);
  if (!ready) return null;
  if (!isAuthenticated) return <Login onLogin={login}/>;
  return <AdminShell onLogout={logout}/>;
}
