import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, useScroll } from 'framer-motion';
import { Menu, X, Linkedin, Twitter, Instagram, Facebook, Mail, MessageCircle, Sun, Moon, Bell, ArrowUpRight, BrainCircuit } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useData } from '../context/DataContext';

// Custom TT Logo Component
const Logo: React.FC<{ className?: string }> = ({ className = 'h-8 w-auto' }) => (
  <svg viewBox="0 0 120 80" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ttgrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#4f9bff" />
        <stop offset="100%" stopColor="#a78bfa" />
      </linearGradient>
    </defs>
    <rect x="10" y="10" width="40" height="12" fill="url(#ttgrad)" />
    <rect x="24" y="22" width="12" height="48" fill="url(#ttgrad)" />
    <rect x="55" y="10" width="40" height="12" fill="url(#ttgrad)" />
    <rect x="69" y="22" width="12" height="30" fill="url(#ttgrad)" />
    <path d="M75 52 L 75 58 L 95 72" stroke="#22d3ee" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="95" cy="72" r="5" fill="#22d3ee" />
  </svg>
);

// Cursor-following glow (desktop only)
const CursorGlow: React.FC = () => {
  const [pos, setPos] = useState({ x: -500, y: -500 });
  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;
    const move = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', move);
    return () => window.removeEventListener('mousemove', move);
  }, []);
  return (
    <div
      className="tt-cursor-glow hidden md:block"
      style={{ transform: `translate(${pos.x}px, ${pos.y}px) translate(-50%, -50%)` }}
    />
  );
};

const NotificationBanner: React.FC = () => {
  const { siteNotification } = useData();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(siteNotification.isActive);
  }, [siteNotification.isActive]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          className="fixed top-28 left-4 z-40 w-full max-w-sm"
        >
          <div className="tt-glass relative flex items-start gap-3 overflow-hidden rounded-2xl p-4 shadow-card">
            <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-brand-500 to-brand-300" />
            <button onClick={() => setIsVisible(false)} className="absolute right-2 top-2 text-slate-400 hover:text-slate-200">
              <X className="h-4 w-4" />
            </button>
            <div className="shrink-0 rounded-full bg-brand-500/15 p-2">
              <Bell className="h-5 w-5 animate-pulse text-brand-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">New Update</h4>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{siteNotification.message}</p>
              {siteNotification.link && (
                <Link to={siteNotification.link} className="mt-2 inline-block text-xs font-bold text-brand-500 hover:underline dark:text-brand-300">
                  {siteNotification.linkText || 'Check it out'} &rarr;
                </Link>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { socialLinks } = useData();
  const location = useLocation();
  const { scrollYProgress } = useScroll();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMenuOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
    { name: 'Solutions', path: '/solutions' },
    { name: 'Work', path: '/portfolio' },
    { name: 'Process', path: '/process' },
    { name: 'AI Lab', path: '/ai-lab' },
    { name: 'Contact', path: '/contact' },
  ];

  const whatsappFloatingMsg = encodeURIComponent("Hello Toluene Tech, I'm browsing your website and have a question.");
  const whatsappFooterMsg = encodeURIComponent('Hello, I found your contact in the footer and would like to get in touch.');
  const whatsappFloatingLink = `https://wa.me/${socialLinks.whatsapp}?text=${whatsappFloatingMsg}`;
  const whatsappFooterLink = `https://wa.me/${socialLinks.whatsapp}?text=${whatsappFooterMsg}`;

  const socialList = [
    { key: 'facebook', href: socialLinks.facebook, Icon: Facebook },
    { key: 'twitter', href: socialLinks.twitter, Icon: Twitter },
    { key: 'instagram', href: socialLinks.instagram, Icon: Instagram },
    { key: 'linkedin', href: socialLinks.linkedin, Icon: Linkedin },
  ].filter(s => s.href);

  return (
    <div className="relative flex min-h-screen flex-col bg-white text-slate-900 transition-colors duration-500 dark:bg-ink-950 dark:text-slate-100">
      <CursorGlow />
      <div className="tt-grain" />

      {/* Scroll progress bar */}
      <motion.div
        className="fixed left-0 top-0 z-[60] h-0.5 w-full origin-left bg-gradient-to-r from-brand-500 via-cyan-400 to-brand-400"
        style={{ scaleX: scrollYProgress }}
      />

      {/* Header */}
      <header className={`fixed z-50 w-full transition-all duration-500 ${isScrolled ? 'py-2' : 'py-4'}`}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className={`flex items-center justify-between rounded-2xl px-4 transition-all duration-500 ${isScrolled ? 'tt-glass py-2.5 shadow-card' : 'py-2'}`}>
            <Link to="/" className="group flex items-center gap-2.5">
              <Logo className="h-9 w-auto transition-transform duration-300 group-hover:scale-110" />
              <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                Toluene<span className="tt-gradient-text">Tech</span>
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map(link => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    location.pathname === link.path
                      ? 'text-brand-600 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {location.pathname === link.path && (
                    <motion.span
                      layoutId="nav-pill"
                      className="absolute inset-0 -z-10 rounded-full bg-brand-500/10 ring-1 ring-brand-400/20"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  {link.name}
                </Link>
              ))}

              <div className="mx-2 h-5 w-px bg-slate-300/50 dark:bg-white/10" />

              <button
                onClick={toggleTheme}
                className="rounded-full p-2 text-slate-600 transition-colors hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Toggle Dark Mode"
              >
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>

              <Link
                to="/start-project"
                className="group ml-1 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-brand-600 to-brand-400 px-5 py-2.5 text-sm font-semibold text-white shadow-glow transition-all hover:shadow-glow-lg"
              >
                Start Project <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
            </nav>

            <div className="flex items-center gap-2 md:hidden">
              <button onClick={toggleTheme} className="rounded-full p-2 text-slate-600 dark:text-slate-300">
                {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </button>
              <button className="rounded-full p-2 text-slate-600 dark:text-slate-300" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                {isMenuOpen ? <X /> : <Menu />}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-4 mt-2 md:hidden"
            >
              <div className="tt-glass rounded-2xl p-4 shadow-card">
                <div className="flex flex-col gap-1">
                  {navLinks.map(link => (
                    <Link
                      key={link.path}
                      to={link.path}
                      onClick={() => setIsMenuOpen(false)}
                      className={`rounded-xl px-4 py-3 text-base font-medium transition-colors ${
                        location.pathname === link.path
                          ? 'bg-brand-500/10 text-brand-600 dark:text-white'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {link.name}
                    </Link>
                  ))}
                  <Link
                    to="/start-project"
                    onClick={() => setIsMenuOpen(false)}
                    className="mt-2 rounded-xl bg-gradient-to-r from-brand-600 to-brand-400 py-3 text-center font-semibold text-white"
                  >
                    Start a Project
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <NotificationBanner />

      <main className="relative z-10 flex-grow pt-24">{children}</main>

      {/* Floating WhatsApp Button */}
      <motion.a
        href={whatsappFloatingLink}
        target="_blank"
        rel="noopener noreferrer"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, type: 'spring' }}
        className="group fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-glow transition-all hover:scale-110 hover:bg-green-600"
        aria-label="Chat on WhatsApp"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-green-500 opacity-20" />
        <MessageCircle className="h-7 w-7" />
      </motion.a>

      {/* Footer */}
      <footer className="relative z-10 mt-24 overflow-hidden border-t border-slate-200 bg-slate-50 dark:border-white/5 dark:bg-ink-900">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          {/* CTA */}
          <div className="tt-glass mb-16 grid gap-6 rounded-3xl p-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Have an idea? Start a project.</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Tell us what you're building — from websites and apps to AI-powered products. We reply within 2 hours.
              </p>
            </div>
            <div className="flex gap-3">
              <Link to="/start-project" className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-600 to-brand-400 px-6 py-3 text-sm font-semibold text-white shadow-glow transition-all hover:shadow-glow-lg">
                Start a Project <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-2 text-white">
                <Logo className="h-8 w-auto" />
                <span className="font-display text-lg font-bold text-slate-900 dark:text-white">Toluene<span className="tt-gradient-text">Tech</span></span>
              </div>
              <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                Digital products, design, development, AI and automation — built for ambitious businesses.
              </p>
              <div className="flex gap-3 pt-2">
                {socialList.map(({ key, href, Icon }) => (
                  <a key={key} href={href} target="_blank" rel="noopener noreferrer"
                    className="rounded-full bg-slate-200/60 p-2.5 text-slate-500 transition-all hover:-translate-y-1 hover:bg-brand-500 hover:text-white dark:bg-white/5 dark:text-slate-400">
                    <Icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Explore</h3>
              <ul className="space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
                <li><Link to="/" className="hover:text-brand-500">Home</Link></li>
                <li><Link to="/services" className="hover:text-brand-500">Services</Link></li>
                <li><Link to="/solutions" className="hover:text-brand-500">Solutions</Link></li>
                <li><Link to="/portfolio" className="hover:text-brand-500">Work</Link></li>
                <li><Link to="/ai-lab" className="inline-flex items-center gap-1 hover:text-brand-500">AI Lab <BrainCircuit className="h-3 w-3" /></Link></li>
                <li><Link to="/products" className="hover:text-brand-500">Products</Link></li>
                <li><Link to="/insights" className="hover:text-brand-500">Insights</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Services</h3>
              <ul className="space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
                <li><Link to="/services/web-design" className="hover:text-brand-500">Web</Link></li>
                <li><Link to="/services/app-development" className="hover:text-brand-500">Apps</Link></li>
                <li><Link to="/services/ui-ux-design" className="hover:text-brand-500">UI/UX</Link></li>
                <li><Link to="/services/graphic-design" className="hover:text-brand-500">Design</Link></li>
                <li><Link to="/services/video-editing" className="hover:text-brand-500">Video</Link></li>
                <li><Link to="/services/ai-integration" className="hover:text-brand-500">AI &amp; Automation</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Company</h3>
              <ul className="space-y-2.5 text-sm text-slate-500 dark:text-slate-400">
                <li><Link to="/about" className="hover:text-brand-500">About</Link></li>
                <li><Link to="/process" className="hover:text-brand-500">Process</Link></li>
                <li><Link to="/technology" className="hover:text-brand-500">Technology</Link></li>
                <li><Link to="/pricing" className="hover:text-brand-500">Pricing</Link></li>
                <li><Link to="/testimonials" className="hover:text-brand-500">Testimonials</Link></li>
                <li><Link to="/faq" className="hover:text-brand-500">FAQ</Link></li>
                <li><Link to="/estimate" className="hover:text-brand-500">Estimate</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="mb-4 font-semibold text-slate-900 dark:text-white">Contact</h3>
              <ul className="space-y-3 text-sm text-slate-500 dark:text-slate-400">
                <li className="flex items-center gap-2"><Mail className="h-4 w-4 text-brand-500" /><a href={`mailto:${socialLinks.email}`} className="hover:text-brand-500">{socialLinks.email}</a></li>
                <li className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-brand-500" /><a href={whatsappFooterLink} target="_blank" rel="noreferrer" className="hover:text-brand-500">+{socialLinks.whatsapp}</a></li>
                <li><Link to="/portal" className="text-xs font-bold uppercase tracking-wider text-brand-500 hover:text-brand-400">Client Portal</Link></li>
                <li><Link to="/admin" className="text-xs font-bold uppercase tracking-wider text-brand-500 hover:text-brand-400">Admin</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-slate-200 pt-8 text-sm text-slate-500 dark:border-white/5 sm:flex-row">
            <span>&copy; {new Date().getFullYear()} Toluene Tech. All rights reserved.</span>
            <div className="flex items-center gap-4 text-xs">
              <Link to="/contact" className="hover:text-brand-500">Contact</Link>
              <Link to="/faq" className="hover:text-brand-500">FAQ</Link>
              <span className="text-brand-500/70">Web • Apps • AI • Design</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
