import { forwardRef } from 'react';
import type { LayoutEdge, LayoutNode, LayoutResult } from '../layout/layout';
import { Flowchart } from './Flowchart';
import type { Direction, EdgeKey } from './Flowchart';
import { SequenceDiagram } from './Sequence';
import { ErDiagram } from './ErView';
import type { ResizeCorner } from './Node';

export type { Direction, EdgeKey };

type DiagramProps = {
  layout: LayoutResult;
  onNodePointerDown?: (id: string, e: React.PointerEvent) => void;
  onNodeDoubleClick?: (id: string, e: React.MouseEvent) => void;
  onNodeResizeStart?: (id: string, corner: ResizeCorner, e: React.PointerEvent) => void;
  onAddConnected?: (id: string, direction: Direction) => void;
  onToggleProgress?: (id: string) => void;
  onEdgePointerDown?: (edge: LayoutEdge, e: React.PointerEvent) => void;
  draggingNodeId?: string | null;
  highlightedNodeIds?: ReadonlySet<string>;
  selectedNodeIds?: ReadonlySet<string>;
  selectedEdgeKey?: EdgeKey | null;
  connectFromId?: string | null;
  editingNode?: LayoutNode | null;
  editingValue?: string;
  onEditingValueChange?: (v: string) => void;
  onEditingCommit?: () => void;
  onEditingCancel?: () => void;
  guidesX?: ReadonlyArray<number>;
  guidesY?: ReadonlyArray<number>;
};

export const Diagram = forwardRef<SVGSVGElement, DiagramProps>((props, ref) => {
  const { layout, ...rest } = props;
  if (layout.kind === 'flowchart') {
    return <Flowchart ref={ref} layout={layout} {...rest} />;
  }
  if (layout.kind === 'sequence') {
    return (
      <SequenceDiagram
        ref={ref}
        layout={layout}
        highlightedNodeIds={rest.highlightedNodeIds}
      />
    );
  }
  if (layout.kind === 'er') {
    return (
      <ErDiagram
        ref={ref}
        layout={layout}
        highlightedNodeIds={rest.highlightedNodeIds}
        onTablePointerDown={rest.onNodePointerDown}
        draggingNodeId={rest.draggingNodeId}
      />
    );
  }
  return null;
});

Diagram.displayName = 'Diagram';
