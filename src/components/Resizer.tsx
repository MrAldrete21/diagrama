import { useState } from 'react';

export function Resizer({
  onResize,
}: {
  onResize: (clientX: number, totalWidth: number) => void;
}) {
  const [resizing, setResizing] = useState(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    const main = (e.currentTarget.parentElement as HTMLElement) ?? null;
    if (!main) return;
    const totalW = main.clientWidth;
    setResizing(true);

    const onMove = (ev: PointerEvent) => {
      onResize(ev.clientX - main.getBoundingClientRect().left, totalW);
    };
    const onUp = () => {
      setResizing(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div
      className={resizing ? 'resizer resizing' : 'resizer'}
      onPointerDown={onPointerDown}
    />
  );
}
