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
import { addPageNumbers, downloadBlob, getPdfPageCount, generatePdfThumbnail, generatePdfPageThumbnails, formatFileSize, type PDFFile, type PageNumberOptions } from '@/lib/pdf-tools';

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
  isSkipped: boolean;
  thumbnail: string;
  onClick?: () => void;
}

const PagePreview = ({ 
  pageNumber, 
  displayNumber,
  totalPages,
  position, 
  margin, 
  format,
  isInRange,
  isSkipped,
  thumbnail,
  onClick
}: PagePreviewProps) => {
  const marginSizes = { small: 6, recommended: 10, big: 14 };
  const marginPx = marginSizes[margin];
  
  const text = format
    .replace('{n}', String(displayNumber))
    .replace('{total}', String(totalPages))
    .replace('{p}', String(totalPages));

  const getPositionStyles = (): React.CSSProperties => {
    const styles: React.CSSProperties = {
      position: 'absolute',
      fontSize: '10px',
      color: '#333',
      fontWeight: 600,
      textShadow: '0 0 3px white, 0 0 3px white',
      backgroundColor: 'rgba(255,255,255,0.7)',
      padding: '1px 4px',
      borderRadius: '2px',
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

  const showNumber = isInRange && !isSkipped;

  return (
    <div 
      className="flex flex-col items-center gap-1.5 cursor-pointer group"
      onClick={onClick}
      title={isSkipped ? 'Click to include this page' : 'Click to skip this page'}
    >
      <div className={`relative w-20 h-28 bg-background rounded-lg border-2 shadow-sm overflow-hidden transition-all ${
        isSkipped ? 'border-destructive/50 opacity-60' : 'border-border group-hover:border-primary/50'
      }`}>
        {/* PDF page thumbnail */}
        {thumbnail ? (
          <img 
            src={thumbnail} 
            alt={`Page ${pageNumber}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-3 space-y-1.5">
            <div className="h-1.5 bg-muted-foreground/15 rounded w-3/4" />
            <div className="h-1.5 bg-muted-foreground/15 rounded w-full" />
            <div className="h-1.5 bg-muted-foreground/15 rounded w-5/6" />
            <div className="h-1.5 bg-muted-foreground/15 rounded w-2/3" />
            <div className="h-1.5 bg-muted-foreground/15 rounded w-4/5" />
          </div>
        )}
        
        {/* Skip indicator */}
        {isSkipped && (
          <div className="absolute inset-0 flex items-center justify-center bg-destructive/10">
            <X className="h-6 w-6 text-destructive" />
          </div>
        )}
        
        {/* Page number overlay */}
        {showNumber && <span style={getPositionStyles()}>{text}</span>}
      </div>
      <span className={`text-xs font-medium ${isSkipped ? 'text-destructive' : 'text-muted-foreground'}`}>
        {pageNumber}
      </span>
    </div>
  );
};

interface FileInfo {
  file: PDFFile;
  thumbnail: string | null;
  pageCount: number;
  pageThumbnails: string[];
}

const PageNumbers = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [fileInfos, setFileInfos] = useState<FileInfo[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [skippedPages, setSkippedPages] = useState<Set<number>>(new Set());
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

  // Persist last selected position as default
  useEffect(() => {
    const saved = localStorage.getItem('pageNumbers.position');
    if (
      saved === 'top-left' ||
      saved === 'top-center' ||
      saved === 'top-right' ||
      saved === 'bottom-left' ||
      saved === 'bottom-center' ||
      saved === 'bottom-right'
    ) {
      setPosition(saved);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('pageNumbers.position', position);
  }, [position]);

  useEffect(() => {
    const loadFileInfos = async () => {
      const infos: FileInfo[] = await Promise.all(
        files.map(async (file) => {
          const pageCount = await getPdfPageCount(file.file);
          const thumbnail = await generatePdfThumbnail(file.file);
          const pageThumbnails = await generatePdfPageThumbnails(file.file, 0.3);
          return { file, thumbnail, pageCount, pageThumbnails };
        })
      );
      setFileInfos(infos);
      
      // Set default toPage based on first file
      if (infos.length > 0 && selectedFileIndex === 0) {
        setToPage(infos[0].pageCount);
      }
    };
    
    if (files.length > 0) {
      loadFileInfos();
    } else {
      setFileInfos([]);
    }
  }, [files]);

  // Update page range when selected file changes
  useEffect(() => {
    if (fileInfos[selectedFileIndex]) {
      setFromPage(1);
      setToPage(fileInfos[selectedFileIndex].pageCount);
      setSkippedPages(new Set());
    }
  }, [selectedFileIndex, fileInfos.length]);

  const getFormat = () => {
    if (textFormat === 'custom') return customFormat;
    return TEXT_FORMAT_OPTIONS.find(opt => opt.value === textFormat)?.format || '{n}';
  };

  const selectedFile = fileInfos[selectedFileIndex];
  const previewTotalPages = toPage - fromPage + 1 - skippedPages.size;

  const toggleSkipPage = (pageNum: number) => {
    setSkippedPages(prev => {
      const next = new Set(prev);
      if (next.has(pageNum)) {
        next.delete(pageNum);
      } else {
        next.add(pageNum);
      }
      return next;
    });
  };

  const handleRemoveFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setSkippedPages(new Set()); // Reset skipped pages when file changes
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
                <div>
                  <Label className="text-base font-semibold">Page Preview</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Click on a page to skip numbering</p>
                </div>
                {files.length > 1 && (
                  <Select 
                    value={String(selectedFileIndex)} 
                    onValueChange={(v) => {
                      setSelectedFileIndex(parseInt(v));
                      setSkippedPages(new Set());
                    }}
                  >
                    <SelectTrigger className="w-[220px] bg-background">
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

              {/* Scrollable page previews - bigger */}
              {selectedFile && selectedFile.pageThumbnails && (
                <div className="h-80 overflow-y-auto bg-muted rounded-xl p-4 border border-border">
                  {pageMode === 'facing' ? (
                    // Facing pages mode - show pages in pairs
                    <div className="flex flex-wrap gap-6 justify-center">
                      {Array.from({ length: Math.ceil(selectedFile.pageCount / 2) }, (_, pairIndex) => {
                        const leftPageNum = pairIndex * 2 + 1;
                        const rightPageNum = pairIndex * 2 + 2;
                        const hasRightPage = rightPageNum <= selectedFile.pageCount;
                        
                        return (
                          <div key={pairIndex} className="flex gap-1 bg-background rounded-xl p-3 shadow-sm border border-border">
                            {/* Left page */}
                            {(() => {
                              const pageNum = leftPageNum;
                              const isInRange = pageNum >= fromPage && pageNum <= toPage;
                              const isSkipped = skippedPages.has(pageNum);
                              let displayNumber = 0;
                              if (isInRange && !isSkipped) {
                                let skippedBefore = 0;
                                for (let p = fromPage; p < pageNum; p++) {
                                  if (skippedPages.has(p)) skippedBefore++;
                                }
                                displayNumber = firstNumber + (pageNum - fromPage) - skippedBefore;
                              }
                              // For facing pages, odd pages get left position, even get right
                              const effectivePosition = position.includes('left') ? position : 
                                position.includes('right') ? position.replace('right', 'left') as Position : position;
                              return (
                                <PagePreview
                                  pageNumber={pageNum}
                                  displayNumber={displayNumber}
                                  totalPages={previewTotalPages}
                                  position={effectivePosition}
                                  margin={margin}
                                  format={getFormat()}
                                  isInRange={isInRange}
                                  isSkipped={isSkipped}
                                  thumbnail={selectedFile.pageThumbnails?.[pageNum - 1] || ''}
                                  onClick={() => toggleSkipPage(pageNum)}
                                />
                              );
                            })()}
                            {/* Right page */}
                            {hasRightPage && (() => {
                              const pageNum = rightPageNum;
                              const isInRange = pageNum >= fromPage && pageNum <= toPage;
                              const isSkipped = skippedPages.has(pageNum);
                              let displayNumber = 0;
                              if (isInRange && !isSkipped) {
                                let skippedBefore = 0;
                                for (let p = fromPage; p < pageNum; p++) {
                                  if (skippedPages.has(p)) skippedBefore++;
                                }
                                displayNumber = firstNumber + (pageNum - fromPage) - skippedBefore;
                              }
                              // For facing pages, even pages get right position, odd get left
                              const effectivePosition = position.includes('right') ? position : 
                                position.includes('left') ? position.replace('left', 'right') as Position : position;
                              return (
                                <PagePreview
                                  pageNumber={pageNum}
                                  displayNumber={displayNumber}
                                  totalPages={previewTotalPages}
                                  position={effectivePosition}
                                  margin={margin}
                                  format={getFormat()}
                                  isInRange={isInRange}
                                  isSkipped={isSkipped}
                                  thumbnail={selectedFile.pageThumbnails?.[pageNum - 1] || ''}
                                  onClick={() => toggleSkipPage(pageNum)}
                                />
                              );
                            })()}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // Single page mode
                    <div className="flex flex-wrap gap-4 justify-center">
                      {Array.from({ length: selectedFile.pageCount }, (_, i) => {
                        const pageNum = i + 1;
                        const isInRange = pageNum >= fromPage && pageNum <= toPage;
                        const isSkipped = skippedPages.has(pageNum);
                        
                        // Calculate display number accounting for skipped pages
                        let displayNumber = 0;
                        if (isInRange && !isSkipped) {
                          let skippedBefore = 0;
                          for (let p = fromPage; p < pageNum; p++) {
                            if (skippedPages.has(p)) skippedBefore++;
                          }
                          displayNumber = firstNumber + (pageNum - fromPage) - skippedBefore;
                        }
                        
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
                            isSkipped={isSkipped}
                            thumbnail={selectedFile.pageThumbnails?.[i] || ''}
                            onClick={() => toggleSkipPage(pageNum)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              
              {skippedPages.size > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Skipped pages: {Array.from(skippedPages).sort((a, b) => a - b).join(', ')}
                  </span>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSkippedPages(new Set())}
                    className="text-xs"
                  >
                    Clear all
                  </Button>
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
                {pageMode === 'facing' ? (
                  // Facing pages position selector - shows two pages side by side with dots
                  <div className="flex gap-0.5 border border-border rounded-lg p-1.5 bg-background w-fit">
                    {/* Left page */}
                    <div className="grid grid-cols-3 gap-0.5 w-14 h-20 border border-dashed border-border rounded p-0.5 bg-muted/30">
                      {positionOptions.map((opt) => {
                        // For left page in facing mode, show left positions
                        const showDot = (position.includes('left') && opt.value === position) ||
                          (position.includes('right') && opt.value === position.replace('right', 'left')) ||
                          (position.includes('center') && opt.value === position);
                        return (
                          <button
                            key={`left-${opt.value}`}
                            onClick={() => {
                              // Convert to the actual position
                              if (opt.value.includes('left')) setPosition(opt.value as Position);
                              else if (opt.value.includes('right')) setPosition(opt.value.replace('right', 'left') as Position);
                              else setPosition(opt.value as Position);
                            }}
                            className={`rounded-full transition-all flex items-center justify-center ${
                              showDot
                                ? 'bg-destructive'
                                : 'hover:bg-muted-foreground/20'
                            }`}
                          >
                            {showDot && <div className="w-2.5 h-2.5 rounded-full bg-destructive" />}
                          </button>
                        );
                      })}
                    </div>
                    {/* Right page */}
                    <div className="grid grid-cols-3 gap-0.5 w-14 h-20 border border-dashed border-border rounded p-0.5 bg-muted/30">
                      {positionOptions.map((opt) => {
                        // For right page in facing mode, show right positions (mirrored)
                        const showDot = (position.includes('right') && opt.value === position) ||
                          (position.includes('left') && opt.value === position.replace('left', 'right')) ||
                          (position.includes('center') && opt.value === position);
                        return (
                          <button
                            key={`right-${opt.value}`}
                            onClick={() => {
                              // Convert to the actual position
                              if (opt.value.includes('right')) setPosition(opt.value as Position);
                              else if (opt.value.includes('left')) setPosition(opt.value.replace('left', 'right') as Position);
                              else setPosition(opt.value as Position);
                            }}
                            className={`rounded-full transition-all flex items-center justify-center ${
                              showDot
                                ? 'bg-destructive'
                                : 'hover:bg-muted-foreground/20'
                            }`}
                          >
                            {showDot && <div className="w-2.5 h-2.5 rounded-full bg-destructive" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  // Single page position selector with red dot
                  <div className="grid grid-cols-3 gap-1 w-24 h-16 border border-border rounded-lg p-1 bg-background">
                    {positionOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setPosition(opt.value as Position)}
                        className={`rounded-full transition-all flex items-center justify-center ${
                          position === opt.value
                            ? 'bg-destructive'
                            : 'bg-muted hover:bg-muted-foreground/20 border border-dashed border-border'
                        }`}
                      >
                        {position === opt.value && <div className="w-2 h-2 rounded-full bg-destructive" />}
                      </button>
                    ))}
                  </div>
                )}
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
