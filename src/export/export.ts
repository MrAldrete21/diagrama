const VISUAL_PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-anchor',
  'dominant-baseline',
  'paint-order',
] as const;

function inlineComputedStyles(
  original: SVGSVGElement,
  cloned: SVGSVGElement,
): void {
  const originals = original.querySelectorAll<SVGElement>('*');
  const clones = cloned.querySelectorAll<SVGElement>('*');
  const count = Math.min(originals.length, clones.length);
  for (let i = 0; i < count; i++) {
    const og = originals[i];
    const cl = clones[i];
    const cs = window.getComputedStyle(og);
    for (const prop of VISUAL_PROPS) {
      const v = cs.getPropertyValue(prop);
      if (!v) continue;
      // Skip defaults that bloat the output
      if (prop === 'fill-opacity' && v === '1') continue;
      if (prop === 'opacity' && v === '1') continue;
      cl.setAttribute(prop, v.trim());
    }
    // Strip className so the standalone SVG ignores any external CSS that
    // would otherwise resolve to undefined variables.
    cl.removeAttribute('class');
  }
}

function getThemeBackground(): string {
  if (typeof document === 'undefined') return '#ffffff';
  const cs = window.getComputedStyle(document.documentElement);
  return cs.getPropertyValue('--preview-bg').trim() || '#ffffff';
}

function buildPortableSvgString(svgEl: SVGSVGElement): string {
  const cloned = svgEl.cloneNode(true) as SVGSVGElement;
  cloned.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  cloned.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  const vb = svgEl.viewBox.baseVal;
  const w = vb.width || svgEl.clientWidth || 800;
  const h = vb.height || svgEl.clientHeight || 600;
  cloned.setAttribute('width', String(w));
  cloned.setAttribute('height', String(h));
  cloned.setAttribute('viewBox', `0 0 ${w} ${h}`);

  inlineComputedStyles(svgEl, cloned);

  // Add a background rect behind everything so dark-mode exports stay legible
  const bg = getThemeBackground();
  const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bgRect.setAttribute('x', '0');
  bgRect.setAttribute('y', '0');
  bgRect.setAttribute('width', String(w));
  bgRect.setAttribute('height', String(h));
  bgRect.setAttribute('fill', bg);
  cloned.insertBefore(bgRect, cloned.firstChild);

  return new XMLSerializer().serializeToString(cloned);
}

export function exportSvg(svgEl: SVGSVGElement, filename = 'diagrama.svg'): void {
  const xml = buildPortableSvgString(svgEl);
  const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(URL.createObjectURL(blob), filename);
}

export async function exportPng(
  svgEl: SVGSVGElement,
  filename = 'diagrama.png',
  scale = 2,
): Promise<void> {
  const xml = buildPortableSvgString(svgEl);
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('No se pudo cargar el SVG'));
    img.src = svgUrl;
  });

  const vb = svgEl.viewBox.baseVal;
  const baseW = vb.width || svgEl.clientWidth || 800;
  const baseH = vb.height || svgEl.clientHeight || 600;

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(baseW * scale);
  canvas.height = Math.ceil(baseH * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    URL.revokeObjectURL(svgUrl);
    throw new Error('No hay contexto 2d');
  }
  // The portable SVG already paints its background; this keeps PNG transparent
  // areas filled in case of any rendering glitch.
  ctx.fillStyle = getThemeBackground();
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(svgUrl);

  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) triggerDownload(URL.createObjectURL(blob), filename);
      resolve();
    }, 'image/png');
  });
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
