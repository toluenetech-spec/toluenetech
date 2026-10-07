import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Check, AlertCircle, Info, CheckCircle2 } from 'lucide-react';

/* ---------- Toast ---------- */
type ToastKind = 'success' | 'error' | 'info';
interface Toast { id: number; kind: ToastKind; title: string; body?: string; }
interface ToastCtx { push: (kind: ToastKind, title: string, body?: string) => void; }
const ToastContext = createContext<ToastCtx | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: ToastKind, title: string, body?: string) => {
    const id = Date.now() + Math.random();
    setItems(prev => [...prev, { id, kind, title, body }]);
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 3800);
  }, []);
  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="adm-toast-stack" role="region" aria-live="polite">
        <AnimatePresence>
          {items.map(t => (
            <motion.div key={t.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              className={`adm-toast ${t.kind}`}>
              {t.kind === 'success' ? <CheckCircle2 className="adm-toast-icon" /> :
               t.kind === 'error'   ? <AlertCircle className="adm-toast-icon" /> :
                                       <Info className="adm-toast-icon" />}
              <div>
                <div className="adm-toast-title">{t.title}</div>
                {t.body && <div className="adm-toast-body">{t.body}</div>}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

/* ---------- Modal ---------- */
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}
export function Modal({ open, onClose, title, children, footer, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="adm-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}>
          <motion.div className={`adm-modal ${wide ? 'wide' : ''}`} initial={{ opacity: 0, scale: 0.97, y: 4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97, y: 4 }}
            onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            {title && (
              <div className="adm-modal-header">
                <div className="adm-modal-title">{title}</div>
                <button className="adm-btn adm-btn-ghost adm-btn-icon" onClick={onClose} aria-label="Close"><X size={16}/></button>
              </div>
            )}
            {children && <div className="adm-modal-body">{children}</div>}
            {footer && <div className="adm-modal-footer">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Drawer (right-side) ---------- */
interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}
export function Drawer({ open, onClose, title, children, footer }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="adm-scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ zIndex: 55 }}/>
          <motion.aside className="adm-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}>
            {title && (
              <div className="adm-drawer-header">
                <div className="adm-modal-title">{title}</div>
                <button className="adm-btn adm-btn-ghost adm-btn-icon" onClick={onClose} aria-label="Close"><X size={16}/></button>
              </div>
            )}
            <div className="adm-drawer-body">{children}</div>
            {footer && <div className="adm-drawer-footer">{footer}</div>}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ---------- Confirm ---------- */
interface ConfirmOpts {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}
interface ConfirmCtx { confirm: (opts: ConfirmOpts) => Promise<boolean>; }
const ConfirmContext = createContext<ConfirmCtx | null>(null);
export function useConfirm() { const c = useContext(ConfirmContext); if (!c) throw new Error('useConfirm must be inside ConfirmProvider'); return c; }

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ opts: ConfirmOpts; resolve: (v: boolean) => void } | null>(null);
  const confirm = useMemo(() => (opts: ConfirmOpts) => new Promise<boolean>(resolve => setState({ opts, resolve })), []);
  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <Modal open={!!state} onClose={() => { state?.resolve(false); setState(null); }}
        title={state?.opts.title}>
        <div style={{ textAlign: 'center' }}>
          <div className="adm-confirm-icon"><AlertCircle size={20}/></div>
          <div style={{ fontSize: '0.88rem', color: 'var(--muted)' }}>{state?.opts.message}</div>
        </div>
        <div className="adm-modal-footer" style={{ justifyContent: 'center' }}>
          <button className="adm-btn" onClick={() => { state?.resolve(false); setState(null); }}>{state?.opts.cancelLabel || 'Cancel'}</button>
          <button className={`adm-btn ${state?.opts.danger ? 'adm-btn-danger' : 'adm-btn-primary'}`}
            onClick={() => { state?.resolve(true); setState(null); }}>
            <Check size={14}/>{state?.opts.confirmLabel || 'Confirm'}
          </button>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
}

/* ---------- Skeleton helpers ---------- */
export function SkeletonLine({ width = '100%', height = 12, style }: { width?: string | number; height?: number; style?: React.CSSProperties }) {
  return <div className="adm-skel adm-skel-line" style={{ width, height, ...style }}>&nbsp;</div>;
}
export function SkeletonCard() {
  return (
    <div className="adm-card">
      <SkeletonLine width="40%" height={14} style={{ marginBottom: 8 }}/>
      <SkeletonLine width="80%" />
      <SkeletonLine width="65%" />
    </div>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ElementType; title: string; body?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="adm-empty">
      <Icon className="adm-empty-icon" />
      <div className="adm-empty-title">{title}</div>
      {body && <div className="adm-empty-sub">{body}</div>}
      {action}
    </div>
  );
}

/* ---------- Badge ---------- */
export function Badge({ children, className = '', ...rest }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span className={`adm-badge ${className}`} {...rest}>{children}</span>;
}
export function StatusBadge({ status }: { status: string }) {
  const s = String(status).toLowerCase();
  return <span className={`adm-badge status-${s}`}>{s.replace(/_/g, ' ')}</span>;
}

/* ---------- Button shorthand ---------- */
type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'accent' | 'danger' | 'ghost' | 'secondary';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
};
export function Button({ variant = 'secondary', size = 'md', icon, className = '', children, ...rest }: BtnProps) {
  const cls = [
    'adm-btn',
    variant === 'primary' ? 'adm-btn-primary' :
    variant === 'accent' ? 'adm-btn-accent' :
    variant === 'danger' ? 'adm-btn-danger' :
    variant === 'ghost' ? 'adm-btn-ghost' : '',
    size === 'sm' ? 'adm-btn-sm' : '',
    className,
  ].filter(Boolean).join(' ');
  return (
    <button className={cls} {...rest}>
      {icon}{children}
    </button>
  );
}
