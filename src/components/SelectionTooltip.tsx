import { useEffect, useRef, useState } from 'react';

export default function SelectionTooltip() {
  const [show, setShow] = useState(false);
  const [text, setText] = useState('');
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handler = () => {
      const sel = window.getSelection();
      const t = sel?.toString().trim() || '';
      if (t.length > 2) {
        setText(t);
        const range = sel?.getRangeAt(0);
        const rect = range?.getBoundingClientRect();
        if (rect) {
          setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
          setShow(true);
          return;
        }
      }
      setShow(false);
    };
    // Delay to let the browser's selection UI show first
    let timer: ReturnType<typeof setTimeout>;
    const delayed = () => { clearTimeout(timer); timer = setTimeout(handler, 100); };
    const onMouseDown = () => setShow(false);
    const onScroll = () => setShow(false);
    document.addEventListener('selectionchange', delayed);
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', delayed);
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, []);

  const ask = () => {
    setShow(false);
    window.dispatchEvent(new CustomEvent('ask-ai', { detail: { text } }));
  };

  if (!show) return null;

  return (
    <button ref={btnRef} onClick={ask}
      style={{
        position: 'fixed', zIndex: 2000,
        left: pos.x - 50, top: pos.y - 38,
        padding: '6px 12px', border: 'none', borderRadius: 8,
        background: 'linear-gradient(135deg,var(--primary),var(--primary-dark))',
        color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer',
        boxShadow: '0 2px 10px rgba(124,58,237,.4)',
        fontFamily: 'var(--font)',
        whiteSpace: 'nowrap',
      }}>
      问助手
    </button>
  );
}
