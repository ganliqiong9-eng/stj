import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastData {
  msg: string;
  type: ToastType;
}

export default function Toast({ toast, onClose }: { toast: ToastData | null; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) {
      setVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 220);
    }, 2600);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [toast, onClose]);

  if (!toast) return null;

  const colors: Record<ToastType, string> = {
    success: '#00b365',
    error: '#f53f3f',
    info: '#3370ff',
  };

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      left: '50%',
      transform: `translateX(-50%) ${visible ? 'translateY(0)' : 'translateY(-12px)'}`,
      opacity: visible ? 1 : 0,
      zIndex: 9999,
      background: colors[toast.type],
      color: '#fff',
      padding: '10px 18px',
      borderRadius: 8,
      fontSize: 13,
      fontWeight: 600,
      fontFamily: 'var(--font)',
      boxShadow: '0 6px 20px rgba(0,0,0,.18)',
      transition: 'all .22s var(--ease-out)',
      maxWidth: 'calc(100vw - 40px)',
      textAlign: 'center',
    }}>
      {toast.msg}
    </div>
  );
}

type ToastItem = { id: number; message: string; type: ToastType };

type ConfirmOptions = {
  title?: string;
  danger?: boolean;
  confirmText?: string;
  cancelText?: string;
};

type ToastContextValue = {
  success: (msg: string) => void;
  error: (msg: string) => void;
  info: (msg: string) => void;
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
};

const ToastContext = createContext<ToastContextValue>({
  success: () => {},
  error: () => {},
  info: () => {},
  confirm: async () => false,
});

export const useToast = () => useContext(ToastContext);

const toastStyle = `
@keyframes stj-toast-in {
  from { opacity: 0; transform: translateX(24px); }
  to { opacity: 1; transform: translateX(0); }
}
@keyframes stj-modal-in {
  from { opacity: 0; transform: translateY(8px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
`;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmData, setConfirmData] = useState<{ message: string; options: ConfirmOptions } | null>(null);
  const counter = useRef(0);
  const confirmResolveRef = useRef<((value: boolean) => void) | null>(null);

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback((message: string, type: ToastType) => {
    const id = ++counter.current;
    setToasts(prev => [{ id, message, type }, ...prev]);
    const timeout = type === 'error' ? 5000 : 3000;
    window.setTimeout(() => remove(id), timeout);
  }, [remove]);

  const confirm = useCallback((message: string, options: ConfirmOptions = {}) => {
    return new Promise<boolean>(resolve => {
      confirmResolveRef.current = resolve;
      setConfirmData({ message, options });
    });
  }, []);

  const closeConfirm = useCallback((value: boolean) => {
    confirmResolveRef.current?.(value);
    confirmResolveRef.current = null;
    setConfirmData(null);
  }, []);

  useEffect(() => {
    if (!confirmData) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeConfirm(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirmData, closeConfirm]);

  const value: ToastContextValue = {
    success: m => add(m, 'success'),
    error: m => add(m, 'error'),
    info: m => add(m, 'info'),
    confirm,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 'min(360px, calc(100vw - 40px))', pointerEvents: 'none' }}>
        {toasts.map(t => <ToastItem key={t.id} toast={t} onClose={() => remove(t.id)} />)}
      </div>

      {confirmData && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }}
          onClick={e => e.target === e.currentTarget && closeConfirm(false)}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 24, width: 420, maxWidth: '100%', boxShadow: '0 8px 24px rgba(0,0,0,.18)', animation: 'stj-modal-in 160ms var(--ease-out)' }}>
            {confirmData.options.title && (
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12, color: 'var(--text)' }}>{confirmData.options.title}</h3>
            )}
            <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{confirmData.message}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => closeConfirm(false)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', fontSize: 13, cursor: 'pointer', color: 'var(--text)', fontFamily: 'var(--font)' }}>
                {confirmData.options.cancelText || '取消'}
              </button>
              <button onClick={() => closeConfirm(true)}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: confirmData.options.danger ? 'var(--danger)' : 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)' }}>
                {confirmData.options.confirmText || '确定'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{toastStyle}</style>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  const map = {
    success: { icon: CheckCircle, color: 'var(--success)', bg: 'var(--success-light)' },
    error: { icon: XCircle, color: 'var(--danger)', bg: 'var(--danger-light)' },
    info: { icon: Info, color: 'var(--primary)', bg: 'var(--primary-light)' },
  }[toast.type];
  const Icon = map.icon;

  return (
    <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'flex-start', gap: 10, background: map.bg, border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 12px', boxShadow: '0 4px 12px rgba(0,0,0,.15)', maxWidth: 360, animation: 'stj-toast-in 180ms var(--ease-out)' }}>
      <Icon size={18} style={{ color: map.color, flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, fontSize: 13, color: 'var(--text)', lineHeight: 1.5, wordBreak: 'break-word' }}>{toast.message}</div>
      <button onClick={onClose} title="关闭"
        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, flexShrink: 0, display: 'flex' }}>
        <X size={14} />
      </button>
    </div>
  );
}
