import { useCallback, useState } from 'react';
import { Upload, FileText, X, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFileSize, generateId, getPdfPageCount, generatePdfThumbnail, type PDFFile } from '@/lib/pdf-tools';
import { Button } from '@/components/ui/button';

interface FileDropZoneProps {
  accept: string[];
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
  files: PDFFile[];
  onFilesChange: (files: PDFFile[]) => void;
  className?: string;
  hideFileList?: boolean;
  buttonText?: string;
  buttonTextWithFiles?: string;
  /** When false, skips PDF page count + thumbnail generation (faster for large PDFs). */
  processPdfMetadata?: boolean;
}

export const FileDropZone = ({
  accept,
  multiple = true,
  maxFiles = 50,
  maxSize = 100 * 1024 * 1024, // 100MB
  files,
  onFilesChange,
  className,
  hideFileList = false,
  buttonText = 'Select Files',
  buttonTextWithFiles = 'Add More Files',
  processPdfMetadata = true,
}: FileDropZoneProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingCount, setProcessingCount] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const processFiles = useCallback(async (newFiles: FileList | File[]) => {
    setError(null);
    const fileArray = Array.from(newFiles);
    
    // Validate file count
    if (!multiple && fileArray.length > 1) {
      setError('Only one file is allowed');
      return;
    }
    
    if (files.length + fileArray.length > maxFiles) {
      setError(`Maximum ${maxFiles} files allowed`);
      return;
    }

    setIsProcessing(true);
    setProcessingCount({ current: 0, total: fileArray.length });

    const processedFiles: PDFFile[] = [];
    
    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      setProcessingCount({ current: i + 1, total: fileArray.length });
      
      // Validate file size
      if (file.size > maxSize) {
        setError(`File "${file.name}" exceeds maximum size of ${formatFileSize(maxSize)}`);
        continue;
      }
      
      // Validate file type
      const extension = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!accept.includes(extension) && !accept.includes(file.type)) {
        setError(`File type "${extension}" is not supported`);
        continue;
      }

      const pdfFile: PDFFile = {
        id: generateId(),
        name: file.name,
        file,
        size: file.size,
      };

      // Get page count and thumbnail for PDFs
      if (extension === '.pdf' && processPdfMetadata) {
        try {
          pdfFile.pageCount = await getPdfPageCount(file);
          pdfFile.thumbnail = await generatePdfThumbnail(file);
        } catch {
          // File might be corrupted, still add it
        }
      }

      processedFiles.push(pdfFile);
    }

    setIsProcessing(false);
    setProcessingCount({ current: 0, total: 0 });

    if (multiple) {
      // New files added at the end, first selections stay first
      onFilesChange([...files, ...processedFiles]);
    } else {
      onFilesChange(processedFiles.slice(0, 1));
    }
  }, [accept, files, maxFiles, maxSize, multiple, onFilesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  }, [processFiles]);

  const removeFile = useCallback((id: string) => {
    onFilesChange(files.filter(f => f.id !== id));
  }, [files, onFilesChange]);

  const acceptString = accept.join(',');

  return (
    <div className={cn("space-y-4", className)}>
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "relative flex flex-col items-center justify-center gap-4 p-8 md:p-12",
          "border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer",
          "border-border bg-card hover:border-primary/50 hover:bg-primary-light/50",
          isDragging && "drop-zone-active scale-[1.02]"
        )}
      >
        <input
          type="file"
          accept={acceptString}
          multiple={multiple}
          onChange={handleInputChange}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className={cn(
          "flex h-16 w-16 items-center justify-center rounded-2xl transition-colors",
          "bg-primary/10 text-primary",
          isDragging && "bg-primary text-primary-foreground"
        )}>
          <Upload className="h-8 w-8" />
        </div>
        
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">
            {isDragging ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            or click to browse • {accept.join(', ')} • Max {formatFileSize(maxSize)}
          </p>
        </div>
        
        <Button variant="outline" className="pointer-events-none">
          {files.length > 0 ? buttonTextWithFiles : buttonText}
        </Button>
      </div>

      {/* Processing Indicator */}
      {isProcessing && (
        <div className="flex items-center justify-center gap-3 py-4 px-4 bg-primary/5 border border-primary/20 rounded-xl animate-fade-in">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm font-medium text-foreground">
            Processing file {processingCount.current} of {processingCount.total}...
          </span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg animate-fade-in">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* File List */}
      {!hideFileList && files.length > 0 && (
        <div className="space-y-2 animate-fade-in">
          <p className="text-sm font-medium text-muted-foreground">
            {files.length} file{files.length !== 1 ? 's' : ''} selected
          </p>
          <div className="grid gap-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl animate-scale-in"
              >
                {file.thumbnail ? (
                  <img
                    src={file.thumbnail}
                    alt={file.name}
                    className="h-12 w-10 object-cover rounded-lg border border-border"
                  />
                ) : (
                  <div className="flex h-12 w-10 items-center justify-center bg-muted rounded-lg">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                    {file.pageCount && ` • ${file.pageCount} page${file.pageCount !== 1 ? 's' : ''}`}
                  </p>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(file.id)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
