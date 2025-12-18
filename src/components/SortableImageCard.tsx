import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X, ImageIcon } from 'lucide-react';
import { formatFileSize, PAGE_SIZES, type PageSize, type PageOrientation, type PageMargin } from '@/lib/pdf-tools';

interface ImageFile {
  id: string;
  name: string;
  file: File;
  size: number;
  thumbnail?: string;
}

interface SortableImageCardProps {
  file: ImageFile;
  index: number;
  onRemove: (id: string) => void;
  orientation?: PageOrientation;
  pageSize?: PageSize;
  margin?: PageMargin;
}

export const SortableImageCard = ({
  file,
  index,
  onRemove,
  orientation = 'portrait',
  pageSize = 'a4',
  margin = 'none',
}: SortableImageCardProps) => {
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

  // Calculate margin for preview
  const marginValues = { none: 0, small: 6, big: 12 };
  const marginPx = marginValues[margin];

  // Calculate aspect ratio for PDF page preview
  const getAspectRatio = () => {
    const size = PAGE_SIZES[pageSize];
    if (pageSize === 'fit') {
      return orientation === 'portrait' ? '3/4' : '4/3';
    }
    const ratio = size.width / size.height;
    return orientation === 'portrait' ? `${ratio}` : `${1/ratio}`;
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
          ? 'z-50 shadow-2xl scale-105 border-primary ring-4 ring-primary/20 rotate-1' 
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

      {/* Drag Indicator */}
      <div className={`absolute bottom-16 left-1/2 -translate-x-1/2 z-10 transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        <div className="px-2 py-1 rounded-full bg-background/90 shadow-lg border border-border/50">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* PDF Page Preview */}
      <div className="bg-muted/30 flex items-center justify-center p-3">
        <div 
          className="bg-background border border-border shadow-md flex items-center justify-center transition-all duration-300"
          style={{ 
            aspectRatio: getAspectRatio(),
            width: orientation === 'portrait' ? '80%' : '95%',
            padding: `${marginPx}px`
          }}
        >
          {file.thumbnail ? (
            <img
              src={file.thumbnail}
              alt={`Preview of ${file.name}`}
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
          ) : (
            <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
          )}
        </div>
      </div>

      {/* File Info */}
      <div className="px-3 py-2.5 border-t border-border/50 bg-muted/20">
        <p className="text-xs font-medium truncate text-foreground" title={file.name}>
          {file.name}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {formatFileSize(file.size)}
        </p>
      </div>
    </div>
  );
};
