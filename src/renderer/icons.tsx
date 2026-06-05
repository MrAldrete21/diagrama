/* eslint-disable react-refresh/only-export-components */
// Shared icon set. Each entry returns a <g> with paths drawn at the origin in a
// 24x24 viewBox. Consumers wrap it with a transform to position / scale.
// Strokes use currentColor so they pick up the node-icon CSS color.
// (El archivo exporta tanto componentes como helpers/constantes de iconos; el
// fast-refresh no aplica aca, por eso se desactiva la regla.)

export type IconKey =
  | 'user'
  | 'users'
  | 'database'
  | 'server'
  | 'cloud'
  | 'globe'
  | 'lock'
  | 'key'
  | 'api'
  | 'code'
  | 'file'
  | 'folder'
  | 'mail'
  | 'bell'
  | 'terminal'
  | 'gear'
  | 'bug'
  | 'clock'
  | 'alert'
  | 'check'
  | 'star'
  | 'heart'
  | 'chart'
  | 'flag'
  | 'aws-ec2'
  | 'aws-rds'
  | 'aws-s3'
  | 'aws-lambda'
  | 'home'
  | 'search'
  | 'edit'
  | 'trash'
  | 'image'
  | 'video'
  | 'music'
  | 'phone'
  | 'send'
  | 'download'
  | 'upload'
  | 'link'
  | 'tag'
  | 'shield'
  | 'eye'
  | 'calendar'
  | 'info'
  | 'help'
  | 'plus'
  | 'minus';

export const ICON_KEYS: IconKey[] = [
  'user',
  'users',
  'database',
  'server',
  'cloud',
  'globe',
  'lock',
  'key',
  'api',
  'code',
  'file',
  'folder',
  'mail',
  'bell',
  'terminal',
  'gear',
  'bug',
  'clock',
  'alert',
  'check',
  'star',
  'heart',
  'chart',
  'flag',
  'home',
  'search',
  'edit',
  'trash',
  'image',
  'video',
  'music',
  'phone',
  'send',
  'download',
  'upload',
  'link',
  'tag',
  'shield',
  'eye',
  'calendar',
  'info',
  'help',
  'plus',
  'minus',
  'aws-ec2',
  'aws-rds',
  'aws-s3',
  'aws-lambda',
];

export function isIconKey(s: string | undefined): s is IconKey {
  return !!s && (ICON_KEYS as string[]).includes(s);
}

// Each path is drawn inside 24x24, stroke 1.6, currentColor.
const COMMON = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconGlyph({ name }: { name: IconKey }) {
  switch (name) {
    case 'user':
      return (
        <g {...COMMON}>
          <circle cx={12} cy={8} r={4} />
          <path d="M 4 21 C 5 16 9 14 12 14 C 15 14 19 16 20 21" />
        </g>
      );
    case 'users':
      return (
        <g {...COMMON}>
          <circle cx={9} cy={9} r={3.2} />
          <circle cx={17} cy={10} r={2.6} />
          <path d="M 3 20 C 4 16 7 14 9 14 C 11 14 14 16 15 20" />
          <path d="M 15 20 C 16 17 19 16 21 17" />
        </g>
      );
    case 'database':
      return (
        <g {...COMMON}>
          <ellipse cx={12} cy={5} rx={7} ry={2.5} />
          <path d="M 5 5 V 12 C 5 13.4 8.1 14.5 12 14.5 C 15.9 14.5 19 13.4 19 12 V 5" />
          <path d="M 5 12 V 19 C 5 20.4 8.1 21.5 12 21.5 C 15.9 21.5 19 20.4 19 19 V 12" />
        </g>
      );
    case 'server':
      return (
        <g {...COMMON}>
          <rect x={3} y={4} width={18} height={6} rx={1.5} />
          <rect x={3} y={14} width={18} height={6} rx={1.5} />
          <circle cx={7} cy={7} r={0.6} fill="currentColor" />
          <circle cx={7} cy={17} r={0.6} fill="currentColor" />
          <path d="M 11 7 H 17" />
          <path d="M 11 17 H 17" />
        </g>
      );
    case 'cloud':
      return (
        <g {...COMMON}>
          <path d="M 7 18 H 17 A 4 4 0 0 0 17 10 A 5 5 0 0 0 7 10 A 4 4 0 0 0 7 18 Z" />
        </g>
      );
    case 'globe':
      return (
        <g {...COMMON}>
          <circle cx={12} cy={12} r={9} />
          <path d="M 3 12 H 21" />
          <path d="M 12 3 C 15 7 15 17 12 21 C 9 17 9 7 12 3 Z" />
        </g>
      );
    case 'lock':
      return (
        <g {...COMMON}>
          <rect x={5} y={11} width={14} height={10} rx={2} />
          <path d="M 8 11 V 8 A 4 4 0 0 1 16 8 V 11" />
        </g>
      );
    case 'key':
      return (
        <g {...COMMON}>
          <circle cx={8} cy={15} r={3.5} />
          <path d="M 11 13 L 21 4" />
          <path d="M 17 8 L 19 10" />
          <path d="M 15 10 L 17 12" />
        </g>
      );
    case 'api':
      return (
        <g {...COMMON}>
          <path d="M 3 6 L 8 12 L 3 18" />
          <path d="M 21 6 L 16 12 L 21 18" />
          <path d="M 14 4 L 10 20" />
        </g>
      );
    case 'code':
      return (
        <g {...COMMON}>
          <path d="M 8 8 L 3 12 L 8 16" />
          <path d="M 16 8 L 21 12 L 16 16" />
          <path d="M 14 5 L 10 19" />
        </g>
      );
    case 'file':
      return (
        <g {...COMMON}>
          <path d="M 6 3 H 14 L 19 8 V 21 H 6 Z" />
          <path d="M 14 3 V 8 H 19" />
        </g>
      );
    case 'folder':
      return (
        <g {...COMMON}>
          <path d="M 3 7 V 19 H 21 V 9 H 12 L 10 7 H 3 Z" />
        </g>
      );
    case 'mail':
      return (
        <g {...COMMON}>
          <rect x={3} y={5} width={18} height={14} rx={1.5} />
          <path d="M 3 7 L 12 13 L 21 7" />
        </g>
      );
    case 'bell':
      return (
        <g {...COMMON}>
          <path d="M 6 17 V 11 A 6 6 0 0 1 18 11 V 17 L 20 19 H 4 Z" />
          <path d="M 10 19 A 2 2 0 0 0 14 19" />
        </g>
      );
    case 'terminal':
      return (
        <g {...COMMON}>
          <rect x={3} y={5} width={18} height={14} rx={1.5} />
          <path d="M 7 10 L 10 12 L 7 14" />
          <path d="M 12 15 H 16" />
        </g>
      );
    case 'gear':
      return (
        <g {...COMMON}>
          <circle cx={12} cy={12} r={3} />
          <path d="M 12 2 V 5 M 12 19 V 22 M 2 12 H 5 M 19 12 H 22 M 5 5 L 7.5 7.5 M 16.5 16.5 L 19 19 M 5 19 L 7.5 16.5 M 16.5 7.5 L 19 5" />
        </g>
      );
    case 'bug':
      return (
        <g {...COMMON}>
          <rect x={7} y={8} width={10} height={11} rx={5} />
          <path d="M 9 6 L 10 8 M 15 6 L 14 8" />
          <path d="M 3 13 H 7 M 17 13 H 21" />
          <path d="M 4 19 L 7 17 M 17 17 L 20 19" />
          <path d="M 4 8 L 7 10 M 17 10 L 20 8" />
        </g>
      );
    case 'clock':
      return (
        <g {...COMMON}>
          <circle cx={12} cy={12} r={9} />
          <path d="M 12 7 V 12 L 15 14" />
        </g>
      );
    case 'alert':
      return (
        <g {...COMMON}>
          <path d="M 12 3 L 22 20 H 2 Z" />
          <path d="M 12 10 V 14" />
          <circle cx={12} cy={17} r={0.6} fill="currentColor" />
        </g>
      );
    case 'check':
      return (
        <g {...COMMON}>
          <circle cx={12} cy={12} r={9} />
          <path d="M 7 12 L 11 16 L 17 9" />
        </g>
      );
    case 'star':
      return (
        <g {...COMMON}>
          <path d="M 12 3 L 14.6 9 L 21 9.7 L 16.3 14 L 17.6 20.3 L 12 17 L 6.4 20.3 L 7.7 14 L 3 9.7 L 9.4 9 Z" />
        </g>
      );
    case 'heart':
      return (
        <g {...COMMON}>
          <path d="M 12 20 C 4 14 4 6 8.5 6 C 10.5 6 12 7.5 12 9 C 12 7.5 13.5 6 15.5 6 C 20 6 20 14 12 20 Z" />
        </g>
      );
    case 'chart':
      return (
        <g {...COMMON}>
          <path d="M 3 20 H 21" />
          <rect x={5} y={12} width={3} height={7} />
          <rect x={10.5} y={8} width={3} height={11} />
          <rect x={16} y={4} width={3} height={15} />
        </g>
      );
    case 'flag':
      return (
        <g {...COMMON}>
          <path d="M 5 21 V 4" />
          <path d="M 5 4 H 17 L 14 8 L 17 12 H 5" />
        </g>
      );
    case 'aws-ec2':
      return (
        <g {...COMMON}>
          <rect x={4} y={4} width={16} height={16} rx={1.5} />
          <rect x={8} y={8} width={8} height={8} rx={1} />
          <path d="M 4 8 H 8 M 4 12 H 8 M 4 16 H 8" />
          <path d="M 16 8 H 20 M 16 12 H 20 M 16 16 H 20" />
        </g>
      );
    case 'aws-rds':
      return (
        <g {...COMMON}>
          <ellipse cx={12} cy={6} rx={7} ry={2.5} />
          <path d="M 5 6 V 18 C 5 19.4 8.1 20.5 12 20.5 C 15.9 20.5 19 19.4 19 18 V 6" />
          <path d="M 5 12 C 5 13.4 8.1 14.5 12 14.5 C 15.9 14.5 19 13.4 19 12" />
        </g>
      );
    case 'aws-s3':
      return (
        <g {...COMMON}>
          <path d="M 4 6 L 12 3 L 20 6 L 19 19 L 12 21 L 5 19 Z" />
          <path d="M 4 6 L 12 9 L 20 6" />
          <path d="M 12 9 V 21" />
        </g>
      );
    case 'aws-lambda':
      return (
        <g {...COMMON}>
          <path d="M 4 20 L 11 4 H 15 L 22 20 H 17 L 14 13 L 11 20 Z" />
        </g>
      );
    case 'home':
      return (
        <g {...COMMON}>
          <path d="M 3 11 L 12 3 L 21 11 V 21 H 14 V 14 H 10 V 21 H 3 Z" />
        </g>
      );
    case 'search':
      return (
        <g {...COMMON}>
          <circle cx={10} cy={10} r={6} />
          <path d="M 14.5 14.5 L 20 20" />
        </g>
      );
    case 'edit':
      return (
        <g {...COMMON}>
          <path d="M 4 20 L 4 16 L 16 4 L 20 8 L 8 20 Z" />
          <path d="M 14 6 L 18 10" />
        </g>
      );
    case 'trash':
      return (
        <g {...COMMON}>
          <path d="M 5 7 H 19" />
          <path d="M 9 7 V 5 H 15 V 7" />
          <path d="M 7 7 L 8 21 H 16 L 17 7" />
          <path d="M 10 11 V 17 M 14 11 V 17" />
        </g>
      );
    case 'image':
      return (
        <g {...COMMON}>
          <rect x={3} y={5} width={18} height={14} rx={1.5} />
          <circle cx={9} cy={10} r={1.5} />
          <path d="M 3 17 L 9 12 L 14 16 L 17 13 L 21 17" />
        </g>
      );
    case 'video':
      return (
        <g {...COMMON}>
          <rect x={3} y={6} width={13} height={12} rx={1.5} />
          <path d="M 16 10 L 21 7 V 17 L 16 14 Z" />
        </g>
      );
    case 'music':
      return (
        <g {...COMMON}>
          <path d="M 9 17 V 5 L 20 4 V 16" />
          <circle cx={7} cy={17} r={2.5} />
          <circle cx={18} cy={16} r={2.5} />
        </g>
      );
    case 'phone':
      return (
        <g {...COMMON}>
          <path d="M 5 4 H 9 L 11 9 L 8.5 11 C 9.5 14 10 14.5 13 15.5 L 15 13 L 20 15 V 19 C 20 20 19 21 18 21 C 11 20 4 13 3 6 C 3 5 4 4 5 4 Z" />
        </g>
      );
    case 'send':
      return (
        <g {...COMMON}>
          <path d="M 3 12 L 21 4 L 14 21 L 11 13 Z" />
          <path d="M 11 13 L 21 4" />
        </g>
      );
    case 'download':
      return (
        <g {...COMMON}>
          <path d="M 12 4 V 15" />
          <path d="M 7 11 L 12 16 L 17 11" />
          <path d="M 4 20 H 20" />
        </g>
      );
    case 'upload':
      return (
        <g {...COMMON}>
          <path d="M 12 20 V 9" />
          <path d="M 7 13 L 12 8 L 17 13" />
          <path d="M 4 4 H 20" />
        </g>
      );
    case 'link':
      return (
        <g {...COMMON}>
          <path d="M 10 14 A 4 4 0 0 1 10 8 L 13 5 A 4 4 0 0 1 19 11 L 17 13" />
          <path d="M 14 10 A 4 4 0 0 1 14 16 L 11 19 A 4 4 0 0 1 5 13 L 7 11" />
        </g>
      );
    case 'tag':
      return (
        <g {...COMMON}>
          <path d="M 3 12 L 12 3 H 20 V 11 L 11 20 Z" />
          <circle cx={16} cy={8} r={1.2} fill="currentColor" />
        </g>
      );
    case 'shield':
      return (
        <g {...COMMON}>
          <path d="M 12 3 L 20 6 V 12 C 20 17 16 20 12 21 C 8 20 4 17 4 12 V 6 Z" />
        </g>
      );
    case 'eye':
      return (
        <g {...COMMON}>
          <path d="M 2 12 C 5 7 8 5 12 5 C 16 5 19 7 22 12 C 19 17 16 19 12 19 C 8 19 5 17 2 12 Z" />
          <circle cx={12} cy={12} r={3} />
        </g>
      );
    case 'calendar':
      return (
        <g {...COMMON}>
          <rect x={3} y={5} width={18} height={16} rx={1.5} />
          <path d="M 3 10 H 21" />
          <path d="M 8 3 V 7 M 16 3 V 7" />
        </g>
      );
    case 'info':
      return (
        <g {...COMMON}>
          <circle cx={12} cy={12} r={9} />
          <path d="M 12 11 V 17" />
          <circle cx={12} cy={8} r={0.6} fill="currentColor" />
        </g>
      );
    case 'help':
      return (
        <g {...COMMON}>
          <circle cx={12} cy={12} r={9} />
          <path d="M 9 9 A 3 3 0 0 1 15 9 C 15 11 12 11 12 14" />
          <circle cx={12} cy={17} r={0.6} fill="currentColor" />
        </g>
      );
    case 'plus':
      return (
        <g {...COMMON}>
          <circle cx={12} cy={12} r={9} />
          <path d="M 12 7 V 17 M 7 12 H 17" />
        </g>
      );
    case 'minus':
      return (
        <g {...COMMON}>
          <circle cx={12} cy={12} r={9} />
          <path d="M 7 12 H 17" />
        </g>
      );
  }
}

// Render an icon scaled into `size` pixels (square), centered at (cx, cy).
export function IconAt({
  name,
  cx,
  cy,
  size,
}: {
  name: IconKey;
  cx: number;
  cy: number;
  size: number;
}) {
  const scale = size / 24;
  const tx = cx - size / 2;
  const ty = cy - size / 2;
  return (
    <g transform={`translate(${tx}, ${ty}) scale(${scale})`} className="node-icon-svg">
      <IconGlyph name={name} />
    </g>
  );
}
