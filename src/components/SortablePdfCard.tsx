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
      {...attributes}
      {...listeners}
      className={`
        group relative bg-card border-2 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing
        transition-all duration-200 select-none
        ${isDragging 
          ? 'z-50 shadow-2xl scale-105 border-primary ring-4 ring-primary/20 rotate-2' 
          : 'border-border shadow-sm hover:shadow-lg hover:border-primary/40 hover:-translate-y-1'
        }
      `}
    >
      {/* Order Badge */}
      <div className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center shadow-md">
        {index + 1}
      </div>

      {/* Remove Button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(file.id);
        }}
        className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:scale-110 shadow-md"
        aria-label="Remove file"
      >
        <X className="h-4 w-4" />
      </button>

      {/* Drag Indicator Overlay */}
      <div className={`absolute inset-0 z-5 flex items-center justify-center bg-primary/5 backdrop-blur-[1px] transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <div className="p-3 rounded-full bg-background/90 shadow-lg">
          <GripVertical className="h-6 w-6 text-primary" />
        </div>
      </div>

      {/* Thumbnail */}
      <div className="aspect-[3/4] bg-muted/20 flex items-center justify-center p-4">
        {file.thumbnail ? (
          <img
            src={file.thumbnail}
            alt={`Preview of ${file.name}`}
            className="max-w-full max-h-full object-contain rounded-lg shadow-md border border-border/50"
            draggable={false}
          />
        ) : (
          <FileText className="h-16 w-16 text-muted-foreground/40" />
        )}
      </div>

      {/* File Info */}
      <div className="p-3 border-t border-border/50 bg-muted/30">
        <p className="text-sm font-medium truncate text-foreground" title={file.name}>
          {file.name}
        </p>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>{file.pageCount || '?'} {file.pageCount === 1 ? 'page' : 'pages'}</span>
          <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
          <span>{formatFileSize(file.size)}</span>
        </div>

        {/* Accessibility Controls */}
        <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onMoveUp(index);
            }}
            disabled={isFirst}
            className="flex-1 h-7 text-xs rounded-lg"
          >
            ↑
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onMoveDown(index);
            }}
            disabled={isLast}
            className="flex-1 h-7 text-xs rounded-lg"
          >
            ↓
          </Button>
        </div>
      </div>
    </div>
  );
};
