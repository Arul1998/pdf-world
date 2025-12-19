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
  position: Position;
  margin: 'small' | 'recommended' | 'big';
  format: string;
  pageNumber: number;
  totalPages: number;
  isEvenPage?: boolean;
  pageMode: 'single' | 'facing';
}

const PagePreview = ({ position, margin, format, pageNumber, totalPages, isEvenPage = false, pageMode }: PagePreviewProps) => {
  const marginSizes = { small: 6, recommended: 12, big: 18 };
  const marginPx = marginSizes[margin];
  
  const text = format
    .replace('{n}', String(pageNumber))
    .replace('{total}', String(totalPages))
    .replace('{p}', String(totalPages));

  // For facing pages mode, alternate left/right positions on even pages
  let effectivePosition = position;
  if (pageMode === 'facing' && isEvenPage) {
    if (position.includes('left')) {
      effectivePosition = position.replace('left', 'right') as Position;
    } else if (position.includes('right')) {
      effectivePosition = position.replace('right', 'left') as Position;
    }
  }

  const getPositionStyles = (): React.CSSProperties => {
    const styles: React.CSSProperties = {
      position: 'absolute',
      fontSize: '8px',
      color: 'hsl(var(--muted-foreground))',
    };

    if (effectivePosition.includes('top')) {
      styles.top = marginPx;
    } else {
      styles.bottom = marginPx;
    }

    if (effectivePosition.includes('left')) {
      styles.left = marginPx;
    } else if (effectivePosition.includes('center')) {
      styles.left = '50%';
      styles.transform = 'translateX(-50%)';
    } else {
      styles.right = marginPx;
    }

    return styles;
  };

  return (
    <div 
      className="relative bg-background border border-border rounded shadow-sm"
      style={{ width: 80, height: 110, padding: 4 }}
    >
      {/* Page content lines */}
      <div className="space-y-1 pt-2">
        {[...Array(6)].map((_, i) => (
          <div 
            key={i} 
            className="h-1 bg-muted rounded-full"
            style={{ width: `${70 - i * 8}%` }}
          />
        ))}
      </div>
      
      {/* Page number */}
      <span style={getPositionStyles()}>{text}</span>
    </div>
  );
};

const PageNumbers = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [pageMode, setPageMode] = useState<'single' | 'facing'>('single');
  const [position, setPosition] = useState<Position>('bottom-left');
  const [margin, setMargin] = useState<'small' | 'recommended' | 'big'>('recommended');
  const [firstNumber, setFirstNumber] = useState(1);
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [textFormat, setTextFormat] = useState<TextFormat>('number');
  const [customFormat, setCustomFormat] = useState('Page {n} of {p}');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const loadPdfInfo = async () => {
      if (files.length > 0) {
        const count = await getPdfPageCount(files[0].file);
        setTotalPages(count);
        setToPage(count);
        
        // Generate thumbnail
        const thumb = await generatePdfThumbnail(files[0].file);
        setThumbnail(thumb);
      } else {
        setThumbnail(null);
      }
    };
    loadPdfInfo();
  }, [files]);

  const getFormat = () => {
    if (textFormat === 'custom') return customFormat;
    return TEXT_FORMAT_OPTIONS.find(opt => opt.value === textFormat)?.format || '{n}';
  };

  const previewTotalPages = toPage - fromPage + 1;

  const handleAddNumbers = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    setIsProcessing(true);
    setProgress(30);

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
      
      const result = await addPageNumbers(files[0].file, options);
      setProgress(80);
      
      const filename = files[0].name.replace('.pdf', '_numbered.pdf');
      downloadBlob(result, filename);
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
          onFilesChange={(newFiles) => setFiles(newFiles.slice(0, 1))}
          multiple={false}
          hideFileList
          buttonText="Select File"
          buttonTextWithFiles="Change File"
        />

        {files.length > 0 && (
          <div className="space-y-6 p-4 bg-muted/50 rounded-xl">
            {/* Uploaded PDF Preview */}
            <div className="space-y-3">
              <Label>Uploaded PDF</Label>
              <div className="flex items-center gap-4 p-3 bg-background border border-border rounded-lg">
                {thumbnail ? (
                  <img 
                    src={thumbnail} 
                    alt="PDF preview" 
                    className="w-16 h-20 object-cover rounded border border-border shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-20 flex items-center justify-center bg-muted rounded border border-border">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{files[0].name}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatFileSize(files[0].file.size)} • {totalPages} {totalPages === 1 ? 'page' : 'pages'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setFiles([])}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Live Preview */}
            {/* Live Preview */}
            <div className="space-y-3">
              <Label>Preview</Label>
              <div className="flex justify-center gap-4 p-4 bg-muted rounded-lg">
                {pageMode === 'single' ? (
                  <PagePreview
                    position={position}
                    margin={margin}
                    format={getFormat()}
                    pageNumber={firstNumber}
                    totalPages={previewTotalPages}
                    pageMode={pageMode}
                  />
                ) : (
                  <>
                    <PagePreview
                      position={position}
                      margin={margin}
                      format={getFormat()}
                      pageNumber={firstNumber}
                      totalPages={previewTotalPages}
                      isEvenPage={false}
                      pageMode={pageMode}
                    />
                    <PagePreview
                      position={position}
                      margin={margin}
                      format={getFormat()}
                      pageNumber={firstNumber + 1}
                      totalPages={previewTotalPages}
                      isEvenPage={true}
                      pageMode={pageMode}
                    />
                  </>
                )}
              </div>
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
                  onChange={(e) => setToPage(Math.max(fromPage, Math.min(totalPages, parseInt(e.target.value) || totalPages)))}
                  className="w-20 bg-background"
                  min={fromPage}
                  max={totalPages}
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
              Add Page Numbers
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default PageNumbers;
