export function ZoomControls({
  scale,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  const pct = Math.round(scale * 100);
  return (
    <div className="zoom-controls" role="toolbar" aria-label="zoom">
      <button
        type="button"
        className="zoom-btn"
        onClick={onZoomOut}
        title="Zoom out (Ctrl+-)"
        aria-label="zoom out"
      >
        −
      </button>
      <button
        type="button"
        className="zoom-pct"
        onClick={onFit}
        title="Fit (Ctrl+0)"
      >
        {pct}%
      </button>
      <button
        type="button"
        className="zoom-btn"
        onClick={onZoomIn}
        title="Zoom in (Ctrl+=)"
        aria-label="zoom in"
      >
        +
      </button>
    </div>
  );
}
