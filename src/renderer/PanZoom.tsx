import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';

export type PanZoomHandle = {
  reset: () => void;
  zoomBy: (factor: number) => void;
  getScale: () => number;
  clientToWorld: (clientX: number, clientY: number) => { x: number; y: number };
  worldToClient: (worldX: number, worldY: number) => { x: number; y: number };
  getContainerRect: () => DOMRect | null;
  centerOn: (worldX: number, worldY: number, opts?: { animate?: boolean }) => void;
};

export type Transform = { tx: number; ty: number; scale: number };

const CLICK_THRESHOLD = 4;

export type MarqueeRect = { x: number; y: number; w: number; h: number };

type PanZoomProps = {
  contentWidth: number;
  contentHeight: number;
  children: React.ReactNode;
  onCanvasClick?: (worldX: number, worldY: number) => void;
  onTransformChange?: (t: Transform) => void;
  onMarquee?: (rect: MarqueeRect, additive: boolean) => void;
  cursor?: string;
};

export const PanZoom = forwardRef<PanZoomHandle, PanZoomProps>(
  ({ contentWidth, contentHeight, children, onCanvasClick, onTransformChange, onMarquee, cursor }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [t, setT] = useState<Transform>({ tx: 0, ty: 0, scale: 1 });
    const [isPanning, setIsPanning] = useState(false);
    const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
    const tRef = useRef(t);
    tRef.current = t;
    const onTransformRef = useRef(onTransformChange);
    onTransformRef.current = onTransformChange;

    const applyT = (next: Transform) => {
      tRef.current = next;
      setT(next);
      onTransformRef.current?.(next);
    };

    const fit = () => {
      const el = containerRef.current;
      if (!el || contentWidth === 0 || contentHeight === 0) return;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const padding = 40;
      const scale = Math.min(
        (cw - padding * 2) / contentWidth,
        (ch - padding * 2) / contentHeight,
        1,
      );
      const tx = (cw - contentWidth * scale) / 2;
      const ty = (ch - contentHeight * scale) / 2;
      applyT({ tx, ty, scale });
    };

    // Only auto-fit ONCE per content-source change. After that, resizing or
    // dragging nodes (which grows contentWidth/Height) must NOT re-center
    // the viewport - that's what made "everything move" during resize.
    const fittedRef = useRef(false);
    useEffect(() => {
      if (fittedRef.current) return;
      if (contentWidth === 0 || contentHeight === 0) return;
      fittedRef.current = true;
      fit();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [contentWidth, contentHeight]);

    useImperativeHandle(ref, () => ({
      reset: fit,
      zoomBy: (factor) => {
        const el = containerRef.current;
        if (!el) return;
        const cw = el.clientWidth;
        const ch = el.clientHeight;
        const cur = tRef.current;
        const newScale = clamp(cur.scale * factor, 0.1, 8);
        const wx = (cw / 2 - cur.tx) / cur.scale;
        const wy = (ch / 2 - cur.ty) / cur.scale;
        applyT({
          scale: newScale,
          tx: cw / 2 - wx * newScale,
          ty: ch / 2 - wy * newScale,
        });
      },
      getScale: () => tRef.current.scale,
      clientToWorld: (clientX, clientY) => {
        const el = containerRef.current;
        if (!el) return { x: 0, y: 0 };
        const rect = el.getBoundingClientRect();
        const px = clientX - rect.left;
        const py = clientY - rect.top;
        const cur = tRef.current;
        return {
          x: (px - cur.tx) / cur.scale,
          y: (py - cur.ty) / cur.scale,
        };
      },
      worldToClient: (worldX, worldY) => {
        const el = containerRef.current;
        if (!el) return { x: 0, y: 0 };
        const rect = el.getBoundingClientRect();
        const cur = tRef.current;
        return {
          x: rect.left + worldX * cur.scale + cur.tx,
          y: rect.top + worldY * cur.scale + cur.ty,
        };
      },
      getContainerRect: () => containerRef.current?.getBoundingClientRect() ?? null,
      centerOn: (worldX, worldY, opts) => {
        const el = containerRef.current;
        if (!el) return;
        const cw = el.clientWidth;
        const ch = el.clientHeight;
        const cur = tRef.current;
        const targetTx = cw / 2 - worldX * cur.scale;
        const targetTy = ch / 2 - worldY * cur.scale;
        if (opts?.animate === false) {
          applyT({ scale: cur.scale, tx: targetTx, ty: targetTy });
          return;
        }
        // Smooth animation with cubic ease-out
        const start = { ...cur };
        const duration = 220;
        const t0 = performance.now();
        const step = (now: number) => {
          const elapsed = now - t0;
          const t = Math.min(1, elapsed / duration);
          const eased = 1 - Math.pow(1 - t, 3);
          const next: Transform = {
            scale: start.scale,
            tx: start.tx + (targetTx - start.tx) * eased,
            ty: start.ty + (targetTy - start.ty) * eased,
          };
          applyT(next);
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      },
    }));

    useEffect(() => {
      const el = containerRef.current;
      if (!el) return;
      let raf = 0;
      let pending: Transform | null = null;
      const flush = () => {
        raf = 0;
        if (pending) {
          applyT(pending);
          pending = null;
        }
      };
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const cur = tRef.current;
        const dyRaw = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        const dxRaw = e.deltaMode === 1 ? e.deltaX * 16 : e.deltaX;

        // Clasificacion:
        //   1. ctrlKey/metaKey wheel  -> PINCH (pinch estandar de Chromium, o
        //      Ctrl+wheel manual = zoom explicito)
        //   2. dx chico o |dyRaw|<50  -> PAN de 2 dedos del trackpad
        //   3. dyRaw grande, sin mods -> zoom de rueda del mouse
        const isPinch = e.ctrlKey || e.metaKey;
        const looksLikeTrackpadScroll =
          !isPinch && (Math.abs(dxRaw) > 0.5 || Math.abs(dyRaw) < 50);

        let next: Transform;
        if (looksLikeTrackpadScroll) {
          next = {
            scale: cur.scale,
            tx: cur.tx - dxRaw,
            ty: cur.ty - dyRaw,
          };
        } else {
          const rect = el.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const zoomDelta = dyRaw;
          const sensitivity = isPinch ? 0.03 : 0.005;
          const factor = Math.exp(-zoomDelta * sensitivity);
          const newScale = clamp(cur.scale * factor, 0.1, 8);
          const wx = (mx - cur.tx) / cur.scale;
          const wy = (my - cur.ty) / cur.scale;
          next = {
            scale: newScale,
            tx: mx - wx * newScale,
            ty: my - wy * newScale,
          };
        }
        tRef.current = next;
        pending = next;
        if (!raf) raf = requestAnimationFrame(flush);
      };
      el.addEventListener('wheel', onWheel, { passive: false });

      // Native touch pinch (touchscreens; also some trackpads that don't
      // synthesize ctrlKey+wheel events for pinch gestures).
      let pinchStartDist = 0;
      let pinchStartScale = 1;
      let pinchCenterX = 0;
      let pinchCenterY = 0;
      const onTouchStart = (ev: TouchEvent) => {
        if (ev.touches.length !== 2) return;
        const a = ev.touches[0];
        const b = ev.touches[1];
        pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        pinchStartScale = tRef.current.scale;
        const rect = el.getBoundingClientRect();
        pinchCenterX = (a.clientX + b.clientX) / 2 - rect.left;
        pinchCenterY = (a.clientY + b.clientY) / 2 - rect.top;
      };
      const onTouchMove = (ev: TouchEvent) => {
        if (ev.touches.length !== 2 || pinchStartDist === 0) return;
        ev.preventDefault();
        const a = ev.touches[0];
        const b = ev.touches[1];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const factor = d / pinchStartDist;
        const cur = tRef.current;
        const newScale = clamp(pinchStartScale * factor, 0.1, 8);
        // Keep the pinch center fixed in world space
        const wx = (pinchCenterX - cur.tx) / cur.scale;
        const wy = (pinchCenterY - cur.ty) / cur.scale;
        const next: Transform = {
          scale: newScale,
          tx: pinchCenterX - wx * newScale,
          ty: pinchCenterY - wy * newScale,
        };
        tRef.current = next;
        pending = next;
        if (!raf) raf = requestAnimationFrame(flush);
      };
      const onTouchEnd = () => {
        pinchStartDist = 0;
      };
      el.addEventListener('touchstart', onTouchStart, { passive: true });
      el.addEventListener('touchmove', onTouchMove, { passive: false });
      el.addEventListener('touchend', onTouchEnd, { passive: true });
      el.addEventListener('touchcancel', onTouchEnd, { passive: true });

      return () => {
        el.removeEventListener('wheel', onWheel);
        el.removeEventListener('touchstart', onTouchStart);
        el.removeEventListener('touchmove', onTouchMove);
        el.removeEventListener('touchend', onTouchEnd);
        el.removeEventListener('touchcancel', onTouchEnd);
        if (raf) cancelAnimationFrame(raf);
      };
    }, []);

    const onPointerDown = (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const target = e.target as Element;
      if (target.closest('[data-node]')) return;
      if (target.closest('[data-resize-handle]')) return;

      const isMarquee = e.shiftKey && !!onMarquee;
      const additive = e.ctrlKey || e.metaKey;
      const containerEl = containerRef.current;
      const containerRect = containerEl?.getBoundingClientRect();

      const startX = e.clientX;
      const startY = e.clientY;
      const start = tRef.current;
      let moved = false;

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        if (!moved && Math.abs(dx) + Math.abs(dy) >= CLICK_THRESHOLD) {
          moved = true;
          if (!isMarquee) setIsPanning(true);
        }
        if (!moved) return;
        if (isMarquee && containerRect) {
          // Screen-space rect relative to the container
          const x0 = startX - containerRect.left;
          const y0 = startY - containerRect.top;
          const x1 = ev.clientX - containerRect.left;
          const y1 = ev.clientY - containerRect.top;
          setMarquee({
            x: Math.min(x0, x1),
            y: Math.min(y0, y1),
            w: Math.abs(x1 - x0),
            h: Math.abs(y1 - y0),
          });
          return;
        }
        applyT({ scale: start.scale, tx: start.tx + dx, ty: start.ty + dy });
      };
      const onUp = (ev: PointerEvent) => {
        setIsPanning(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        if (isMarquee && moved && containerRect && onMarquee) {
          // Convert screen rect → world rect
          const cur = tRef.current;
          const sx0 = startX - containerRect.left;
          const sy0 = startY - containerRect.top;
          const sx1 = ev.clientX - containerRect.left;
          const sy1 = ev.clientY - containerRect.top;
          const x0w = (Math.min(sx0, sx1) - cur.tx) / cur.scale;
          const y0w = (Math.min(sy0, sy1) - cur.ty) / cur.scale;
          const x1w = (Math.max(sx0, sx1) - cur.tx) / cur.scale;
          const y1w = (Math.max(sy0, sy1) - cur.ty) / cur.scale;
          onMarquee(
            { x: x0w, y: y0w, w: x1w - x0w, h: y1w - y0w },
            additive,
          );
          setMarquee(null);
          return;
        }
        setMarquee(null);
        if (!moved && onCanvasClick) {
          const el = containerRef.current;
          if (el) {
            const rect = el.getBoundingClientRect();
            const cur = tRef.current;
            const wx = (ev.clientX - rect.left - cur.tx) / cur.scale;
            const wy = (ev.clientY - rect.top - cur.ty) / cur.scale;
            onCanvasClick(wx, wy);
          }
        }
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };

    return (
      <div
        ref={containerRef}
        className="panzoom"
        onPointerDown={onPointerDown}
        style={{
          cursor: cursor ?? (isPanning ? 'grabbing' : 'grab'),
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          position: 'relative',
          touchAction: 'none',
        }}
      >
        <div
          style={{
            transform: `translate(${t.tx}px, ${t.ty}px) scale(${t.scale})`,
            transformOrigin: '0 0',
            width: contentWidth,
            height: contentHeight,
            position: 'absolute',
            left: 0,
            top: 0,
          }}
        >
          {children}
        </div>
        {marquee && (
          <div
            className="marquee"
            style={{
              position: 'absolute',
              left: marquee.x,
              top: marquee.y,
              width: marquee.w,
              height: marquee.h,
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    );
  },
);

PanZoom.displayName = 'PanZoom';

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
