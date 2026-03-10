'use client';

import { useEffect, useState, useCallback, createContext, useContext, useRef } from 'react';

// ============================================================
// Types
// ============================================================
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = manual close only
}

interface ToastContextType {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
}

// ============================================================
// Context
// ============================================================
const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

// ============================================================
// Single Toast Item
// ============================================================
const ICONS: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'bg-emerald-900/90', border: 'border-emerald-500/40', icon: 'text-emerald-400' },
  error:   { bg: 'bg-red-900/90',     border: 'border-red-500/40',     icon: 'text-red-400'     },
  warning: { bg: 'bg-amber-900/90',   border: 'border-amber-500/40',   icon: 'text-amber-400'   },
  info:    { bg: 'bg-blue-900/90',    border: 'border-blue-500/40',    icon: 'text-blue-400'    },
};

function ToastItem({ toast, onClose }: { toast: ToastMessage; onClose: () => void }) {
  const [exiting, setExiting] = useState(false);
  const c = COLORS[toast.type];

  useEffect(() => {
    if (!toast.duration && toast.duration !== 0) toast.duration = 5000;
    if (toast.duration === 0) return;

    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onClose, 300);
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.duration, onClose]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(onClose, 300);
  };

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg
        ${c.bg} ${c.border}
        transition-all duration-300 ease-in-out
        ${exiting ? 'opacity-0 translate-x-full' : 'opacity-100 translate-x-0'}
      `}
      role="alert"
    >
      <span className={`${c.icon} text-lg font-bold mt-0.5 shrink-0`}>{ICONS[toast.type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-100">{toast.title}</p>
        {toast.message && <p className="text-xs text-gray-300 mt-0.5 break-words">{toast.message}</p>}
      </div>
      <button
        onClick={handleClose}
        className="text-gray-400 hover:text-gray-200 text-lg leading-none shrink-0 mt-0.5"
      >
        ×
      </button>
    </div>
  );
}

// ============================================================
// Toast Container + Provider
// ============================================================
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counterRef = useRef(0);

  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    counterRef.current += 1;
    const id = `toast-${counterRef.current}-${Date.now()}`;
    setToasts((prev) => [...prev.slice(-4), { ...toast, id }]); // Max 5 toasts
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-[380px] max-w-[90vw] pointer-events-auto">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
