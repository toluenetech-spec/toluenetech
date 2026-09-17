import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { DataProvider } from './context/DataContext';
import { AuthProvider } from './context/AuthContext';
import { ClientAuthProvider } from './context/ClientAuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import About from './pages/About';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import Solutions from './pages/Solutions';
import Portfolio from './pages/Portfolio';
import ProjectDetail from './pages/ProjectDetail';
import Process from './pages/Process';
import Technology from './pages/Technology';
import Pricing from './pages/Pricing';
import Testimonials from './pages/Testimonials';
import FAQ from './pages/FAQ';
import Products from './pages/Products';
import Labs from './pages/Labs';
import AILab from './pages/AILab';
import Insights from './pages/Insights';
import InsightDetail from './pages/InsightDetail';
import Downloads from './pages/Downloads';
import Contact from './pages/Contact';
import StartProject from './pages/StartProject';
import Estimate from './pages/Estimate';
import NotFound from './pages/NotFound';
import Admin from './pages/Admin';
import PortalLogin from './pages/portal/Login';
import Portal from './pages/portal/Portal';
import PageLoader from './components/PageLoader';

const AdminLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;
const PortalLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => <>{children}</>;

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

const IntroLoader: React.FC = () => {
  const [done, setDone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDone(true), 1200);
    return () => clearTimeout(t);
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
          <Route path="/process" element={<Layout><PageTransition><Process /></PageTransition></Layout>} />
          <Route path="/technology" element={<Layout><PageTransition><Technology /></PageTransition></Layout>} />
          <Route path="/services" element={<Layout><PageTransition><Services /></PageTransition></Layout>} />
          <Route path="/services/:slug" element={<Layout><PageTransition><ServiceDetail /></PageTransition></Layout>} />
          <Route path="/solutions" element={<Layout><PageTransition><Solutions /></PageTransition></Layout>} />
          <Route path="/portfolio" element={<Layout><PageTransition><Portfolio /></PageTransition></Layout>} />
          <Route path="/project/:id" element={<Layout><PageTransition><ProjectDetail /></PageTransition></Layout>} />
          <Route path="/products" element={<Layout><PageTransition><Products /></PageTransition></Layout>} />
          <Route path="/labs" element={<Layout><PageTransition><Labs /></PageTransition></Layout>} />
          <Route path="/ai-lab" element={<Layout><PageTransition><AILab /></PageTransition></Layout>} />
          <Route path="/testimonials" element={<Layout><PageTransition><Testimonials /></PageTransition></Layout>} />
          <Route path="/pricing" element={<Layout><PageTransition><Pricing /></PageTransition></Layout>} />
          <Route path="/faq" element={<Layout><PageTransition><FAQ /></PageTransition></Layout>} />
          <Route path="/insights" element={<Layout><PageTransition><Insights /></PageTransition></Layout>} />
          <Route path="/insights/:slug" element={<Layout><PageTransition><InsightDetail /></PageTransition></Layout>} />
          <Route path="/estimate" element={<Layout><PageTransition><Estimate /></PageTransition></Layout>} />
          <Route path="/start-project" element={<Layout><PageTransition><StartProject /></PageTransition></Layout>} />
          <Route path="/downloads" element={<Layout><PageTransition><Downloads /></PageTransition></Layout>} />
          <Route path="/contact" element={<Layout><PageTransition><Contact /></PageTransition></Layout>} />

          {/* Admin (no standard chrome) */}
          <Route path="/admin" element={<AdminLayout><Admin /></AdminLayout>} />

          {/* Client Portal */}
          <Route path="/portal" element={<PortalLayout><PortalLogin /></PortalLayout>} />
          <Route path="/portal/dashboard" element={<PortalLayout><Portal /></PortalLayout>} />

          <Route path="*" element={<Layout><PageTransition><NotFound /></PageTransition></Layout>} />
        </Routes>
      </React.Fragment>
    </AnimatePresence>
  );
};

const App: React.FC = () => (
  <ThemeProvider>
    <AuthProvider>
      <DataProvider>
        <ClientAuthProvider>
          <Router>
            <IntroLoader />
            <AnimatedRoutes />
          </Router>
        </ClientAuthProvider>
      </DataProvider>
    </AuthProvider>
  </ThemeProvider>
);

export default App;
