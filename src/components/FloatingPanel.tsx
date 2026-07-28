import { useState, useRef, useEffect, type ReactNode } from 'react';

interface Position { x: number; y: number; }

interface FloatingPanelProps {
  /** Content displayed inside the floating button (mini preview) */
  buttonContent: ReactNode;
  /** Content displayed inside the expanded panel */
  children: ReactNode;
  /** Size of the floating button (default: 46) */
  buttonSize?: number;
  /** Max width of the expanded panel (default: 380) */
  panelWidth?: number;
  /** Max height of the expanded panel, as CSS value (default: 'min(50vh, 420px)') */
  panelMaxHeight?: string;
  /** Distance from viewport edge to trigger snap (default: 10) */
  snapThreshold?: number;
  /** Horizontal swipe distance to close panel (default: 60) */
  swipeThreshold?: number;
  /** Vertical drag distance to keep panel at new position (default: 5) */
  dragThreshold?: number;
  /** Milliseconds of inactivity before button fades (default: 2000, 0 = disable) */
  idleTimeout?: number;
  /** Opacity when idle (default: 0.45) */
  idleOpacity?: number;
  /** Called when panel opens */
  onOpen?: () => void;
  /** Called when panel closes */
  onClose?: () => void;
  /** Initial button position (default: bottom-right) */
  initialPosition?: Position;
}

// 模块级拖拽状态，替代 window.__swipeRef，供子组件通过 startPanelSwipe 激活拖拽
interface SwipeState { active: boolean; startX: number; startY: number; dx: number; dy: number; }
const panelSwipe: SwipeState = { active: false, startX: 0, startY: 0, dx: 0, dy: 0 };
export function startPanelSwipe(x: number, y: number) {
  panelSwipe.active = true; panelSwipe.startX = x; panelSwipe.startY = y; panelSwipe.dx = 0; panelSwipe.dy = 0;
}

const BTN_SIZE = 46;

export default function FloatingPanel({
  buttonContent, children,
  buttonSize = BTN_SIZE, panelWidth = 380, panelMaxHeight = 'min(50vh, 420px)',
  snapThreshold = 10, swipeThreshold = 60, dragThreshold = 5,
  idleTimeout = 2000, idleOpacity = 0.45,
  onOpen, onClose,
  initialPosition,
}: FloatingPanelProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Position>(initialPosition || { x: 0, y: 0 });
  const [snapped, setSnapped] = useState(false);
  const [swipeDx, setSwipeDx] = useState(0);
  const [swipeDy, setSwipeDy] = useState(0);
  const [swipeScale, setSwipeScale] = useState(1);
  const [isExiting, setIsExiting] = useState(false);
  const [modalY, setModalY] = useState(0);
  const [cardOpacity, setCardOpacity] = useState(1);
  const [isIdle, setIsIdle] = useState(false);
  const [active, setActive] = useState(false);
  const [lastActive, setLastActive] = useState(Date.now());

  // Refs
  const posRef = useRef(pos);
  const drag = useRef(false);
  const start = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const wasSnapped = useRef(false);
  const swipeRef = useRef({ active: false, startX: 0, startY: 0, dx: 0, dy: 0 });

  useEffect(() => { posRef.current = pos; }, [pos]);

  // Initialize position
  useEffect(() => {
    setPos(initialPosition || { x: window.innerWidth - buttonSize - 16, y: window.innerHeight - 160 });
  }, []);

  // Idle detection
  useEffect(() => {
    if (idleTimeout <= 0) return;
    const t = setInterval(() => setIsIdle(Date.now() - lastActive > idleTimeout), 500);
    return () => clearInterval(t);
  }, [lastActive, idleTimeout]);

  const resetIdle = () => { setLastActive(Date.now()); setIsIdle(false); };

  // Panel position calculation
  const modalW = Math.min(panelWidth, window.innerWidth - 24);
  const spaceBelow = window.innerHeight - pos.y - 8;
  const modalH = Math.max(200, Math.min(Math.min(window.innerHeight * 0.5, 420), spaceBelow));
  const modalTop = spaceBelow >= modalH ? pos.y : Math.max(8, pos.y - modalH - 8);
  const modalLeft = Math.max(8, (window.innerWidth - modalW) / 2);

  // Animate close to bottom-right
  const animateClose = () => {
    const tx = window.innerWidth - buttonSize - 16;
    const ty = window.innerHeight - 160;
    const w = window.innerWidth;
    const snapX = tx + buttonSize > w / 2 ? w - 14 : -14;
    // 按钮直接滑向最近边缘 + 同步 snapped 过渡（CSS transition 同时执行）
    setPos({ x: snapX, y: ty });
    setSnapped(true);
    setIsExiting(true);
    setSwipeScale(0);
    setCardOpacity(0);
    setTimeout(() => {
      setOpen(false); setSwipeScale(1);
      setIsExiting(false); setCardOpacity(1);
      onClose?.();
    }, 380);
  };

  // Drag handlers
  const onDown = (cx: number, cy: number) => {
    drag.current = true;
    wasSnapped.current = snapped;
    start.current = { mx: cx, my: cy, px: posRef.current.x, py: posRef.current.y };
    if (snapped) setActive(true);
    resetIdle();
  };

  // Global event listeners
  useEffect(() => {
    const move = (cx: number, cy: number) => {
      // 检查内部拖拽和子组件通过模块级 panelSwipe 激活的拖拽
      const activeSwipe = swipeRef.current.active ? swipeRef.current : (panelSwipe.active ? panelSwipe : null);
      if (activeSwipe) {
        const dx = cx - activeSwipe.startX;
        const dy = cy - activeSwipe.startY;
        activeSwipe.dx = dx; activeSwipe.dy = dy;
        setSwipeDx(dx); setSwipeDy(dy);
        return;
      }
      if (!drag.current) return;
      const nx = start.current.px + cx - start.current.mx;
      const ny = Math.max(40, Math.min(window.innerHeight - 120, start.current.py + cy - start.current.my));
      posRef.current = { x: nx, y: ny };
      setPos({ x: nx, y: ny });
    };

    const up = (clientY?: number) => {
      const activeSwipe = swipeRef.current.active ? swipeRef.current : (panelSwipe.active ? panelSwipe : null);
      if (activeSwipe) {
        activeSwipe.active = false;
        const hDx = Math.abs(activeSwipe.dx);
        const hDy = Math.abs(activeSwipe.dy);
        if (hDx > swipeThreshold && hDx > hDy) {
          const w = window.innerWidth;
          const targetX = activeSwipe.dx > 0 ? w - 14 : -6;
          // 按钮滑向边缘 + 同步 snapped 过渡
          setPos({ x: targetX, y: clientY !== undefined ? Math.max(40, Math.min(window.innerHeight - 60, clientY - 23)) : window.innerHeight - 160 });
          setSnapped(true);
          setSwipeDx(activeSwipe.dx > 0 ? w * 1.2 : -w * 0.5);
          setSwipeScale(0.1);
          setIsExiting(true);
          setTimeout(() => {
            setOpen(false); setSwipeScale(1); setSwipeDx(0);
            setIsExiting(false); setModalY(0);
            onClose?.();
          }, 380);
        } else if (Math.abs(activeSwipe.dy) > dragThreshold) {
          setModalY(m => m + activeSwipe.dy);
        }
        setSwipeDx(0); setSwipeDy(0);
        return;
      }
      if (!drag.current) return;
      drag.current = false;
      const p = posRef.current;
      const w = window.innerWidth;
      if (wasSnapped.current) {
        wasSnapped.current = false;
        const wasLeft = start.current.px < w / 2;
        const dragDist = wasLeft ? p.x - start.current.px : start.current.px - p.x;
        if (dragDist > 15) {
          setActive(false);
          setOpen(true);
          onOpen?.();
          return;
        } else {
          const snapX = wasLeft ? -14 : w - 18;
          setPos({ x: snapX, y: p.y });
          setActive(false);
          return;
        }
      }
      if (p.x <= snapThreshold) { setPos({ x: -14, y: p.y }); setSnapped(true); }
      else if (p.x + buttonSize >= w - snapThreshold) { setPos({ x: w - 18, y: p.y }); setSnapped(true); }
    };

    const mm = (e: MouseEvent) => move(e.clientX, e.clientY);
    const mu = (e: MouseEvent) => up(e.clientY);
    const tm = (e: TouchEvent) => move(e.touches[0].clientX, e.touches[0].clientY);
    const te = (e: TouchEvent) => up(e.changedTouches[0].clientY);
    document.addEventListener('mousemove', mm);
    document.addEventListener('mouseup', mu);
    document.addEventListener('touchmove', tm);
    document.addEventListener('touchend', te);
    return () => { document.removeEventListener('mousemove', mm); document.removeEventListener('mouseup', mu); document.removeEventListener('touchmove', tm); document.removeEventListener('touchend', te); };
  }, []);

  // iOS keyboard fix
  useEffect(() => {
    if (!open) return;
    const orig = { overflowB: document.body.style.overflow, overflowH: document.documentElement.style.overflow };
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    const nav = document.querySelector('#app-root nav') as HTMLElement;
    const origNavBottom = nav?.style.bottom || '';
    const upd = () => {
      const vv = window.visualViewport;
      if (!vv) return;
      const kb = window.innerHeight - vv.height;
      if (nav) nav.style.bottom = kb > 0 ? '-' + kb + 'px' : origNavBottom;
    };
    window.visualViewport?.addEventListener('resize', upd);
    upd();
    return () => {
      document.body.style.overflow = orig.overflowB;
      document.documentElement.style.overflow = orig.overflowH;
      window.visualViewport?.removeEventListener('resize', upd);
      if (nav) nav.style.bottom = origNavBottom;
    };
  }, [open]);

  return (
    <>
      {/* Floating button */}
      <button onMouseDown={e => { resetIdle(); onDown(e.clientX, e.clientY); }}
        onTouchStart={e => { resetIdle(); onDown(e.touches[0].clientX, e.touches[0].clientY); }}
        onMouseEnter={() => { resetIdle(); if (snapped) setActive(true); }}
        onMouseLeave={() => { setActive(false); }}
        onClick={() => { resetIdle(); if (!drag.current) { setOpen(true); onOpen?.(); } }}
        style={{
          position: 'fixed', zIndex: 1001,
          left: snapped ? (pos.x + buttonSize > window.innerWidth / 2
            ? (active ? window.innerWidth - 18 : window.innerWidth - 6)
            : (active ? -6 : -6)) : pos.x,
          top: pos.y,
          width: snapped ? (active ? 24 : 10) : buttonSize,
          height: snapped ? (active ? buttonSize : 80) : buttonSize,
          border: 'none',
          borderWidth: snapped && !active ? '0 20px' : 0,
          borderStyle: snapped && !active ? 'solid' : 'none',
          borderColor: 'transparent',
          backgroundClip: snapped && !active ? 'padding-box' : 'border-box',
          borderRadius: snapped ? (pos.x > window.innerWidth / 2
            ? (active ? '8px 0 0 8px' : '6px 0 0 6px')
            : (active ? '0 8px 8px 0' : '0 6px 6px 0')) : 14,
          background: snapped ? (active ? 'linear-gradient(135deg,#89b4fa,#b4befe)' : 'rgba(30,30,46,0.45)') : 'rgba(30,30,46,0.3)',
          color: 'rgba(255,255,255,0.65)',
          opacity: snapped ? 1 : (isIdle ? idleOpacity : 1),
          cursor: snapped ? 'pointer' : 'grab',
          boxShadow: snapped ? (active ? '0 4px 20px rgba(0,0,0,.2)' : '0 2px 8px rgba(0,0,0,.15)') : '0 4px 20px rgba(0,0,0,.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: drag.current ? 'none' : 'left .4s cubic-bezier(.22,1,.36,1), width .25s ease, border-radius .25s ease, background .25s ease, box-shadow .25s ease, opacity .5s ease',
          touchAction: 'none', overflow: 'hidden',
          backdropFilter: snapped && !active ? 'none' : 'blur(24px)',
          WebkitBackdropFilter: snapped && !active ? 'none' : 'blur(24px)',
        }}>
        {snapped && !active ? null : buttonContent}
      </button>

      {/* Panel */}
      {open && (
        <div onClick={animateClose}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'transparent' }}>
          <div onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', left: modalLeft, top: modalTop,
              background: '#1e1e2e', borderRadius: 24, overflow: 'hidden',
              width: modalW, maxWidth: modalW, maxHeight: panelMaxHeight,
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 12px 48px rgba(0,0,0,.4)',
              opacity: cardOpacity,
              transform: 'translate(' + swipeDx + 'px,' + (swipeDy + modalY) + 'px) scale(' + swipeScale + ')',
              transition: isExiting ? 'transform .38s cubic-bezier(.32,.72,0,1), opacity .25s ease' : (swipeDx ? 'none' : 'transform .3s cubic-bezier(.22,1,.36,1)'),
            }}>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
