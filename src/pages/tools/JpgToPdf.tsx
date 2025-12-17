import { useState } from 'react';
import { Image, Download, Loader2, RectangleVertical, RectangleHorizontal, ImageIcon, Square, Maximize } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { imageToPdf, downloadBlob, type PDFFile, PAGE_SIZES, type PageSize, type PageOrientation, type PageMargin } from '@/lib/pdf-tools';
import { cn } from '@/lib/utils';

const JpgToPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Options
  const [orientation, setOrientation] = useState<PageOrientation>('portrait');
  const [pageSize, setPageSize] = useState<PageSize>('a4');
  const [margin, setMargin] = useState<PageMargin>('none');
  const [mergeAll, setMergeAll] = useState(true);

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
        // Create separate PDFs for each image
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
          files={files}
          onFilesChange={setFiles}
          multiple
        />

        {files.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6 bg-muted/30 rounded-xl border">
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
