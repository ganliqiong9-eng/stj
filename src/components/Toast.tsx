import { useEffect, useState } from 'react';

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
