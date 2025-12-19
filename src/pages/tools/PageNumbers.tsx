import { useState, useEffect } from 'react';
import { Hash, Download, Loader2, FileText, X } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { addPageNumbers, downloadBlob, getPdfPageCount, generatePdfThumbnail, formatFileSize, type PDFFile, type PageNumberOptions } from '@/lib/pdf-tools';

type Position = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
type TextFormat = 'number' | 'page-n' | 'page-n-of-p' | 'custom';

const TEXT_FORMAT_OPTIONS: { value: TextFormat; label: string; format: string }[] = [
  { value: 'number', label: 'Insert only page number (recommended)', format: '{n}' },
  { value: 'page-n', label: 'Page {n}', format: 'Page {n}' },
  { value: 'page-n-of-p', label: 'Page {n} of {p}', format: 'Page {n} of {p}' },
  { value: 'custom', label: 'Custom', format: '' },
];

interface PagePreviewProps {
  pageNumber: number;
  displayNumber: number;
  totalPages: number;
  position: Position;
  margin: 'small' | 'recommended' | 'big';
  format: string;
  isInRange: boolean;
}

const PagePreview = ({ 
  pageNumber, 
  displayNumber,
  totalPages,
  position, 
  margin, 
  format,
  isInRange 
}: PagePreviewProps) => {
  const marginSizes = { small: 4, recommended: 8, big: 12 };
  const marginPx = marginSizes[margin];
  
  const text = format
    .replace('{n}', String(displayNumber))
    .replace('{total}', String(totalPages))
    .replace('{p}', String(totalPages));

  const getPositionStyles = (): React.CSSProperties => {
    const styles: React.CSSProperties = {
      position: 'absolute',
      fontSize: '8px',
      color: 'hsl(var(--foreground))',
      fontWeight: 600,
      textShadow: '0 0 2px hsl(var(--background))',
    };

    if (position.includes('top')) {
      styles.top = marginPx;
    } else {
      styles.bottom = marginPx;
    }

    if (position.includes('left')) {
      styles.left = marginPx;
    } else if (position.includes('center')) {
      styles.left = '50%';
      styles.transform = 'translateX(-50%)';
    } else {
      styles.right = marginPx;
    }

    return styles;
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-16 h-22 bg-background rounded border border-border shadow-sm overflow-hidden">
        {/* Page lines decoration */}
        <div className="absolute inset-2 space-y-1">
          <div className="h-1 bg-muted-foreground/20 rounded w-3/4" />
          <div className="h-1 bg-muted-foreground/20 rounded w-full" />
          <div className="h-1 bg-muted-foreground/20 rounded w-5/6" />
          <div className="h-1 bg-muted-foreground/20 rounded w-2/3" />
        </div>
        
        {/* Page number overlay - only show if in range */}
        {isInRange && <span style={getPositionStyles()}>{text}</span>}
      </div>
      <span className="text-[10px] text-muted-foreground">Page {pageNumber}</span>
    </div>
  );
};

interface FileInfo {
  file: PDFFile;
  thumbnail: string | null;
  pageCount: number;
}

const PageNumbers = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [fileInfos, setFileInfos] = useState<FileInfo[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [pageMode, setPageMode] = useState<'single' | 'facing'>('single');
  const [position, setPosition] = useState<Position>('bottom-left');
  const [margin, setMargin] = useState<'small' | 'recommended' | 'big'>('recommended');
  const [firstNumber, setFirstNumber] = useState(1);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(1);
  const [textFormat, setTextFormat] = useState<TextFormat>('number');
  const [customFormat, setCustomFormat] = useState('Page {n} of {p}');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const loadFileInfos = async () => {
      const infos: FileInfo[] = await Promise.all(
        files.map(async (file) => {
          const pageCount = await getPdfPageCount(file.file);
          const thumbnail = await generatePdfThumbnail(file.file);
          return { file, thumbnail, pageCount };
        })
      );
      setFileInfos(infos);
      
      // Set default toPage based on first file
      if (infos.length > 0) {
        setToPage(infos[0].pageCount);
      }
    };
    
    if (files.length > 0) {
      loadFileInfos();
    } else {
      setFileInfos([]);
    }
  }, [files]);

  const getFormat = () => {
    if (textFormat === 'custom') return customFormat;
    return TEXT_FORMAT_OPTIONS.find(opt => opt.value === textFormat)?.format || '{n}';
  };

  const selectedFile = fileInfos[selectedFileIndex];
  const previewTotalPages = toPage - fromPage + 1;

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    // Adjust selected index if needed
    if (selectedFileIndex >= files.length - 1 && selectedFileIndex > 0) {
      setSelectedFileIndex(selectedFileIndex - 1);
    }
  };

  const handleAddNumbers = async () => {
    if (files.length === 0) {
      toast.error('Please add PDF files');
      return;
    }

    setIsProcessing(true);
    setProgress(10);

    try {
      const options: PageNumberOptions = {
        position,
        format: getFormat(),
        margin,
        firstNumber,
        fromPage,
        toPage,
        pageMode,
      };

      if (files.length === 1) {
        const result = await addPageNumbers(files[0].file, options);
        setProgress(80);
        
        const filename = files[0].name.replace('.pdf', '_numbered.pdf');
        downloadBlob(result, filename);
      } else {
        // Multiple files - zip them
        const zip = new JSZip();
        const date = new Date().toISOString().split('T')[0];

        for (let i = 0; i < files.length; i++) {
          const result = await addPageNumbers(files[i].file, options);
          const filename = files[i].name.replace('.pdf', '_numbered.pdf');
          zip.file(filename, result);
          setProgress(10 + (70 * (i + 1) / files.length));
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `numbered_pdfs_${date}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      setProgress(100);
      toast.success('Page numbers added successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to add page numbers. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const positionOptions = [
    { value: 'top-left', row: 0, col: 0 },
    { value: 'top-center', row: 0, col: 1 },
    { value: 'top-right', row: 0, col: 2 },
    { value: 'bottom-left', row: 1, col: 0 },
    { value: 'bottom-center', row: 1, col: 1 },
    { value: 'bottom-right', row: 1, col: 2 },
  ];

  return (
    <ToolLayout
      title="Add Page Numbers"
      description="Insert page numbers on each page of your PDF."
      icon={Hash}
      category="edit"
      categoryColor="edit"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={setFiles}
          multiple={true}
          hideFileList
          buttonText="Select Files"
          buttonTextWithFiles="Add More Files"
        />

        {files.length > 0 && (
          <div className="space-y-6 p-4 bg-muted/50 rounded-xl">
            {/* PDF Selector and Preview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Page Preview</Label>
                {files.length > 1 && (
                  <Select 
                    value={String(selectedFileIndex)} 
                    onValueChange={(v) => setSelectedFileIndex(parseInt(v))}
                  >
                    <SelectTrigger className="w-[200px] bg-background">
                      <SelectValue placeholder="Select PDF" />
                    </SelectTrigger>
                    <SelectContent>
                      {fileInfos.map((info, index) => (
                        <SelectItem key={info.file.id} value={String(index)}>
                          {info.file.name} ({info.pageCount} pages)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              
              {/* File info bar */}
              <div className="flex items-center gap-2 p-2 bg-background rounded-lg border border-border">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium truncate flex-1">
                  {selectedFile?.file.name || 'No file selected'}
                </span>
                {selectedFile && (
                  <>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(selectedFile.file.file.size)} • {selectedFile.pageCount} pages
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveFile(selectedFileIndex)}
                      className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                )}
              </div>

              {/* Scrollable page previews */}
              {selectedFile && (
                <div className="h-48 overflow-y-auto bg-muted rounded-lg p-4 border border-border">
                  <div className="flex flex-wrap gap-3 justify-center">
                    {Array.from({ length: selectedFile.pageCount }, (_, i) => {
                      const pageNum = i + 1;
                      const isInRange = pageNum >= fromPage && pageNum <= toPage;
                      const displayNumber = isInRange ? firstNumber + (pageNum - fromPage) : 0;
                      
                      return (
                        <PagePreview
                          key={i}
                          pageNumber={pageNum}
                          displayNumber={displayNumber}
                          totalPages={previewTotalPages}
                          position={position}
                          margin={margin}
                          format={getFormat()}
                          isInRange={isInRange}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Page Mode */}
            <div className="space-y-3">
              <Label>Page mode</Label>
              <RadioGroup 
                value={pageMode} 
                onValueChange={(v) => setPageMode(v as 'single' | 'facing')}
                className="flex gap-6"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="single" />
                  <span>Single page</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <RadioGroupItem value="facing" />
                  <span>Facing pages</span>
                </label>
              </RadioGroup>
            </div>

            {/* Position and Margin */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label>Position:</Label>
                <div className="grid grid-cols-3 gap-1 w-24 h-16 border border-border rounded-lg p-1 bg-background">
                  {positionOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setPosition(opt.value as Position)}
                      className={`rounded transition-colors ${
                        position === opt.value
                          ? 'bg-destructive'
                          : 'bg-muted hover:bg-muted-foreground/20 border border-dashed border-border'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Margin:</Label>
                <Select value={margin} onValueChange={(v) => setMargin(v as typeof margin)}>
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="recommended">Recommended</SelectItem>
                    <SelectItem value="big">Big</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Pages Section */}
            <div className="space-y-4">
              <Label>Pages</Label>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground whitespace-nowrap">First number:</span>
                <Input
                  type="number"
                  value={firstNumber}
                  onChange={(e) => setFirstNumber(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-20 bg-background"
                  min={1}
                />
              </div>
            </div>

            {/* Page Range */}
            <div className="space-y-3">
              <Label>Which pages do you want to number?</Label>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">from page</span>
                <Input
                  type="number"
                  value={fromPage}
                  onChange={(e) => setFromPage(Math.max(1, Math.min(toPage, parseInt(e.target.value) || 1)))}
                  className="w-20 bg-background"
                  min={1}
                  max={toPage}
                />
                <span className="text-sm text-muted-foreground">to</span>
                <Input
                  type="number"
                  value={toPage}
                  onChange={(e) => setToPage(Math.max(fromPage, parseInt(e.target.value) || 1))}
                  className="w-20 bg-background"
                  min={fromPage}
                />
              </div>
            </div>

            {/* Text Format */}
            <div className="space-y-3">
              <Label>Text:</Label>
              <Select value={textFormat} onValueChange={(v) => setTextFormat(v as TextFormat)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEXT_FORMAT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {textFormat === 'custom' && (
                <div className="space-y-2">
                  <Input
                    value={customFormat}
                    onChange={(e) => setCustomFormat(e.target.value)}
                    placeholder="Page {n} of {p}"
                    className="bg-background"
                  />
                  <p className="text-xs text-muted-foreground">
                    Use {'{n}'} for current page, {'{p}'} or {'{total}'} for total pages
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {isProcessing && (
          <ProgressBar progress={progress} />
        )}

        <Button
          onClick={handleAddNumbers}
          disabled={files.length === 0 || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Add Page Numbers {files.length > 1 && `(${files.length} files)`}
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default PageNumbers;
