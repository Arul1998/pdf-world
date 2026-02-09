import { FileText, X } from 'lucide-react';
import { formatFileSize, type PDFFile } from '@/lib/pdf-tools';
import { cn } from '@/lib/utils';

interface PdfFileCardProps {
  file: PDFFile;
  onRemove?: (id: string) => void;
  /** Optional rotation preview in degrees */
  rotation?: number;
  /** Extra info line below file size (e.g. "PDF • 2.1 MB") */
  extraInfo?: string;
  className?: string;
}

/**
 * Reusable file thumbnail card with consistent UX across all tool pages.
 * Remove button is always visible on mobile (touch), hover-only on desktop.
 */
export const PdfFileCard = ({ file, onRemove, rotation, extraInfo, className }: PdfFileCardProps) => {
  return (
    <div
      className={cn(
        "relative group bg-card border border-border rounded-xl p-3 flex flex-col items-center",
        className
      )}
    >
      {/* Remove button - always visible on mobile, hover on desktop */}
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(file.id);
          }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10"
          aria-label={`Remove ${file.name}`}
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Thumbnail */}
      <div className="w-full aspect-[3/4] bg-muted rounded-lg overflow-hidden mb-2 flex items-center justify-center">
        <div
          className={cn("transition-transform duration-300 ease-out", rotation !== undefined && rotation !== 0 && "w-full h-full flex items-center justify-center")}
          style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
        >
          {file.thumbnail ? (
            <img
              src={file.thumbnail}
              alt={file.name}
              className={cn(
                "object-cover",
                rotation ? "max-w-full max-h-full object-contain" : "w-full h-full"
              )}
              loading="lazy"
            />
          ) : (
            <FileText className="w-10 h-10 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* File info */}
      <p
        className="text-xs font-medium text-foreground truncate w-full text-center"
        title={file.name}
      >
        {file.name}
      </p>
      <p className="text-xs text-muted-foreground">
        {file.pageCount != null && `${file.pageCount} ${file.pageCount === 1 ? 'page' : 'pages'} • `}
        {formatFileSize(file.size)}
        {extraInfo && ` • ${extraInfo}`}
      </p>
    </div>
  );
};
