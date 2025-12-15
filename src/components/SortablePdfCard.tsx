import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatFileSize } from '@/lib/pdf-tools';
import type { PDFFile } from '@/lib/pdf-tools';

interface SortablePdfCardProps {
  file: PDFFile;
  index: number;
  onRemove: (id: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  isFirst: boolean;
  isLast: boolean;
}

export const SortablePdfCard = ({
  file,
  index,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}: SortablePdfCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative bg-card border border-border rounded-xl overflow-hidden
        transition-all duration-200
        ${isDragging ? 'z-50 shadow-2xl scale-105 ring-2 ring-primary/50' : 'shadow-sm hover:shadow-md'}
      `}
    >
      {/* Order Badge */}
      <div className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-sm">
        {index + 1}
      </div>

      {/* Remove Button */}
      <button
        onClick={() => onRemove(file.id)}
        className="absolute top-2 right-2 z-10 w-6 h-6 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive shadow-sm"
        aria-label="Remove file"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 p-2 rounded-lg bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-5 w-5 text-muted-foreground" />
      </div>

      {/* Thumbnail */}
      <div className="aspect-[3/4] bg-muted/30 flex items-center justify-center p-3">
        {file.thumbnail ? (
          <img
            src={file.thumbnail}
            alt={`Preview of ${file.name}`}
            className="max-w-full max-h-full object-contain rounded shadow-sm"
          />
        ) : (
          <FileText className="h-16 w-16 text-muted-foreground/50" />
        )}
      </div>

      {/* File Info */}
      <div className="p-3 border-t border-border/50 bg-muted/20">
        <p className="text-sm font-medium truncate text-foreground" title={file.name}>
          {file.name}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'}</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
          <span>{formatFileSize(file.size)}</span>
        </div>

        {/* Accessibility Controls */}
        <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMoveUp(index)}
            disabled={isFirst}
            className="flex-1 h-7 text-xs rounded-lg"
          >
            ↑ Up
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMoveDown(index)}
            disabled={isLast}
            className="flex-1 h-7 text-xs rounded-lg"
          >
            ↓ Down
          </Button>
        </div>
      </div>
    </div>
  );
};
