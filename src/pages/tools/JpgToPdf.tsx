import { useState, useMemo } from 'react';
import { Image, Download, Loader2, RectangleVertical, RectangleHorizontal, ImageIcon, Square } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { SortableImageCard } from '@/components/SortableImageCard';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { imageToPdf, downloadBlob, generateId, PAGE_SIZES, type PageSize, type PageOrientation, type PageMargin } from '@/lib/pdf-tools';
import { cn } from '@/lib/utils';

// PDF Preview Component
const PdfPreview = ({ 
  thumbnail, 
  orientation, 
  pageSize, 
  margin 
}: { 
  thumbnail: string; 
  orientation: PageOrientation; 
  pageSize: PageSize; 
  margin: PageMargin;
}) => {
  const marginValues = { none: 0, small: 8, big: 16 };
  const marginPx = marginValues[margin];
  
  // Calculate aspect ratio based on page size and orientation
  const getPageDimensions = () => {
    const size = PAGE_SIZES[pageSize];
    if (pageSize === 'fit') {
      return orientation === 'portrait' ? { width: 150, height: 200 } : { width: 200, height: 150 };
    }
    const ratio = size.width / size.height;
    const baseHeight = 200;
    if (orientation === 'portrait') {
      return { width: baseHeight * ratio, height: baseHeight };
    } else {
      return { width: baseHeight, height: baseHeight * ratio };
    }
  };
  
  const { width, height } = getPageDimensions();

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs font-medium text-muted-foreground">Preview</span>
      <div 
        className="bg-background border-2 border-border rounded shadow-lg flex items-center justify-center transition-all duration-300"
        style={{ 
          width: `${width}px`, 
          height: `${height}px`,
          padding: `${marginPx}px`
        }}
      >
        <img 
          src={thumbnail} 
          alt="Preview" 
          className="max-w-full max-h-full object-contain rounded-sm"
          style={{
            maxWidth: `calc(100% - ${marginPx * 2}px)`,
            maxHeight: `calc(100% - ${marginPx * 2}px)`
          }}
        />
      </div>
      <span className="text-xs text-muted-foreground">
        {PAGE_SIZES[pageSize].label} • {orientation === 'portrait' ? 'Portrait' : 'Landscape'}
      </span>
    </div>
  );
};

interface ImageFile {
  id: string;
  name: string;
  file: File;
  size: number;
  thumbnail?: string;
}

const JpgToPdf = () => {
  const [files, setFiles] = useState<ImageFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Options
  const [orientation, setOrientation] = useState<PageOrientation>('portrait');
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [margin, setMargin] = useState<PageMargin>('none');
  const [mergeAll, setMergeAll] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Generate thumbnails for uploaded files
  const handleFilesChange = async (pdfFiles: any[]) => {
    const imageFiles: ImageFile[] = await Promise.all(
      pdfFiles.map(async (f) => {
        const thumbnail = await generateImageThumbnail(f.file);
        return {
          id: f.id || generateId(),
          name: f.name,
          file: f.file,
          size: f.size,
          thumbnail,
        };
      })
    );
    setFiles(imageFiles);
  };

  const generateImageThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        resolve(e.target?.result as string);
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleRemove = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      toast.error('Please add at least one image');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      setProgress(30);
      const imageFiles = files.map(f => f.file);
      
      if (mergeAll || files.length === 1) {
        const pdf = await imageToPdf(imageFiles, { pageSize, orientation, margin });
        setProgress(80);
        
        const filename = files.length === 1 
          ? files[0].name.replace(/\.(jpg|jpeg|png)$/i, '.pdf')
          : `images_${new Date().toISOString().split('T')[0]}.pdf`;
        
        downloadBlob(pdf, filename);
      } else {
        for (let i = 0; i < imageFiles.length; i++) {
          const pdf = await imageToPdf([imageFiles[i]], { pageSize, orientation, margin });
          const filename = files[i].name.replace(/\.(jpg|jpeg|png)$/i, '.pdf');
          downloadBlob(pdf, filename);
          setProgress(30 + (50 * (i + 1) / imageFiles.length));
        }
      }
      
      setProgress(100);
      toast.success('Images converted to PDF!');
      setFiles([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to convert images. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="JPG to PDF"
      description="Convert JPG and PNG images to a PDF document."
      icon={Image}
      category="convert to pdf"
      categoryColor="convert-to"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.jpg', '.jpeg', '.png']}
          files={files.map(f => ({ id: f.id, name: f.name, file: f.file, size: f.size, pageCount: 1 }))}
          onFilesChange={handleFilesChange}
          multiple
          hideFileList
        />

        {/* Image Cards Grid with Drag & Drop */}
        {files.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={files.map(f => f.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {files.map((file, index) => (
                  <SortableImageCard
                    key={file.id}
                    file={file}
                    index={index}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {files.length > 1 && (
          <p className="text-xs text-muted-foreground text-center">
            Drag to reorder images
          </p>
        )}

        {files.length > 0 && (
          <div className="flex flex-col lg:flex-row gap-6 p-6 bg-muted/30 rounded-xl border">
            {/* Options Grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Page Orientation */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Page orientation</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setOrientation('portrait')}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                      orientation === 'portrait'
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <RectangleVertical className="h-8 w-8" />
                    <span className="text-xs font-medium">Portrait</span>
                  </button>
                  <button
                    onClick={() => setOrientation('landscape')}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all",
                      orientation === 'landscape'
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <RectangleHorizontal className="h-8 w-8" />
                    <span className="text-xs font-medium">Landscape</span>
                  </button>
                </div>
              </div>

              {/* Page Size */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Page size</Label>
                <Select value={pageSize} onValueChange={(v) => setPageSize(v as PageSize)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAGE_SIZES).map(([key, { label }]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Margin */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Margin</Label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMargin('none')}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                      margin === 'none'
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <ImageIcon className="h-6 w-6" />
                    <span className="text-xs font-medium">No margin</span>
                  </button>
                  <button
                    onClick={() => setMargin('small')}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                      margin === 'small'
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="h-6 w-6 border-2 border-current rounded flex items-center justify-center">
                      <Square className="h-4 w-4" />
                    </div>
                    <span className="text-xs font-medium">Small</span>
                  </button>
                  <button
                    onClick={() => setMargin('big')}
                    className={cn(
                      "flex-1 flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all",
                      margin === 'big'
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="h-6 w-6 border-2 border-current rounded flex items-center justify-center">
                      <Square className="h-3 w-3" />
                    </div>
                    <span className="text-xs font-medium">Big</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Live Preview */}
            {files[0]?.thumbnail && (
              <div className="flex-shrink-0 flex justify-center lg:border-l lg:pl-6 pt-6 lg:pt-0 border-t lg:border-t-0">
                <PdfPreview 
                  thumbnail={files[0].thumbnail} 
                  orientation={orientation} 
                  pageSize={pageSize} 
                  margin={margin} 
                />
              </div>
            )}
          </div>
        )}

        {files.length > 1 && (
          <div className="flex items-center gap-2 px-2">
            <Checkbox
              id="merge-all"
              checked={mergeAll}
              onCheckedChange={(checked) => setMergeAll(checked as boolean)}
            />
            <Label htmlFor="merge-all" className="text-sm cursor-pointer">
              Merge all images in one PDF file
            </Label>
          </div>
        )}

        {isProcessing && (
          <ProgressBar progress={progress} />
        )}

        <Button
          onClick={handleConvert}
          disabled={files.length === 0 || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Converting...
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Convert to PDF
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default JpgToPdf;
