import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ProjectProvider } from './context/ProjectContext';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import About from './pages/About';
import Services from './pages/Services';
import Portfolio from './pages/Portfolio';
import ProjectDetail from './pages/ProjectDetail';
import Downloads from './pages/Downloads';
import Contact from './pages/Contact';
import Admin from './pages/Admin';
import PageLoader from './components/PageLoader';

// Wrapper for Admin route to exclude standard Layout
const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

// Smooth animated wrapper for each routed page
const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

// One-time premium intro loader on first mount
const IntroLoader: React.FC = () => {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setDone(true), 1400);
    return () => clearTimeout(timer);
  }, []);
  return <AnimatePresence>{!done && <PageLoader />}</AnimatePresence>;
};

const AnimatedRoutes: React.FC = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <React.Fragment key={location.pathname}>
        <Routes location={location}>
          <Route path="/" element={<Layout><PageTransition><Home /></PageTransition></Layout>} />
          <Route path="/about" element={<Layout><PageTransition><About /></PageTransition></Layout>} />
          <Route path="/services" element={<Layout><PageTransition><Services /></PageTransition></Layout>} />
          <Route path="/portfolio" element={<Layout><PageTransition><Portfolio /></PageTransition></Layout>} />
          <Route path="/project/:id" element={<Layout><PageTransition><ProjectDetail /></PageTransition></Layout>} />
          <Route path="/downloads" element={<Layout><PageTransition><Downloads /></PageTransition></Layout>} />
          <Route path="/contact" element={<Layout><PageTransition><Contact /></PageTransition></Layout>} />

          {/* Admin Route (No Header/Footer) */}
          <Route path="/admin" element={<AdminLayout><Admin /></AdminLayout>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </React.Fragment>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProjectProvider>
          <Router>
            <IntroLoader />
            <AnimatedRoutes />
          </Router>
        </ProjectProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
