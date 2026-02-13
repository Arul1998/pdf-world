import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GitCompare, Loader2, ArrowLeftRight, Download, X,
  FileText, Layers, AlignLeft, Search, Minus, Plus, ChevronLeft, ChevronRight, Upload, FilePlus2
} from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  comparePdfs, downloadBlob, generatePdfPageThumbnails,
  comparePdfTexts, renderOverlayPage,
  type PDFFile, type CompareResult, type DiffChange,
} from '@/lib/pdf-tools';
import { PrivacyBadge } from '@/components/PrivacyBadge';
import { cn } from '@/lib/utils';

type CompareMode = 'semantic' | 'overlay';

const ComparePdf = () => {
  const [file1, setFile1] = useState<PDFFile[]>([]);
  const [file2, setFile2] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [thumbnails1, setThumbnails1] = useState<string[]>([]);
  const [thumbnails2, setThumbnails2] = useState<string[]>([]);
  const [overlayImages, setOverlayImages] = useState<Map<number, string>>(new Map());
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom1, setZoom1] = useState(100);
  const [zoom2, setZoom2] = useState(100);
  const [compareMode, setCompareMode] = useState<CompareMode>('semantic');
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [searchText, setSearchText] = useState('');
  const [scrollSync, setScrollSync] = useState(true);

  const viewer1Ref = useRef<HTMLDivElement>(null);
  const viewer2Ref = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const bothFilesLoaded = file1.length > 0 && file2.length > 0;

  // Load thumbnails
  const loadThumbnails = useCallback(async () => {
    const promises: Promise<void>[] = [];

    if (file1.length > 0) {
      promises.push(
        generatePdfPageThumbnails(file1[0].file, 0.5).then(t => setThumbnails1(t))
      );
    } else {
      setThumbnails1([]);
    }
    if (file2.length > 0) {
      promises.push(
        generatePdfPageThumbnails(file2[0].file, 0.5).then(t => setThumbnails2(t))
      );
    } else {
      setThumbnails2([]);
    }
    await Promise.all(promises);
  }, [file1, file2]);

  useEffect(() => {
    loadThumbnails();
    setCurrentPage(0);
    setCompareResult(null);
    setOverlayImages(new Map());
  }, [file1, file2, loadThumbnails]);

  // Auto-compare when both files loaded
  useEffect(() => {
    if (!bothFilesLoaded) return;
    runComparison();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file1, file2]);

  const runComparison = async () => {
    if (!bothFilesLoaded) return;
    setIsComparing(true);
    try {
      const result = await comparePdfTexts(file1[0].file, file2[0].file, setProgress);
      setCompareResult(result);
    } catch (e) {
      console.error(e);
      toast.error('Failed to compare text content');
    } finally {
      setIsComparing(false);
      setProgress(0);
    }
  };

  // Load overlay for current page
  useEffect(() => {
    if (compareMode !== 'overlay' || !bothFilesLoaded) return;
    if (overlayImages.has(currentPage)) return;

    let cancelled = false;
    renderOverlayPage(file1[0].file, file2[0].file, currentPage, 1.5).then(img => {
      if (!cancelled) {
        setOverlayImages(prev => new Map(prev).set(currentPage, img));
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, compareMode, bothFilesLoaded]);

  // Scroll sync
  const handleScroll = (source: 'left' | 'right') => {
    if (!scrollSync || syncing.current) return;
    syncing.current = true;
    const from = source === 'left' ? viewer1Ref.current : viewer2Ref.current;
    const to = source === 'left' ? viewer2Ref.current : viewer1Ref.current;
    if (from && to) {
      const pct = from.scrollTop / (from.scrollHeight - from.clientHeight || 1);
      to.scrollTop = pct * (to.scrollHeight - to.clientHeight);
    }
    requestAnimationFrame(() => { syncing.current = false; });
  };

  const handleDownloadReport = async () => {
    if (!bothFilesLoaded) return;
    setIsProcessing(true);
    setProgress(10);
    try {
      const result = await comparePdfs(file1[0].file, file2[0].file, p => setProgress(10 + p * 0.8));
      setProgress(95);
      downloadBlob(result, 'pdf_comparison_report.pdf');
      setProgress(100);
      toast.success('Report downloaded!');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate report');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleReset = () => {
    setFile1([]);
    setFile2([]);
    setThumbnails1([]);
    setThumbnails2([]);
    setCompareResult(null);
    setOverlayImages(new Map());
    setCurrentPage(0);
  };

  const maxPages = Math.max(thumbnails1.length, thumbnails2.length);

  // Filter changes by search
  const filteredPages = compareResult?.pages.filter(p => {
    if (!searchText) return p.addedCount + p.removedCount > 0;
    return p.changes.some(c =>
      c.type !== 'unchanged' && c.value.toLowerCase().includes(searchText.toLowerCase())
    );
  }) || [];

  // ─── Upload phase ─────────────────────────────────────────────────────────
  // iLovePDF style: first upload one file, then show a + button for the second
  if (!bothFilesLoaded) {
    const hasFirstFile = file1.length > 0;

    return (
      <ToolLayout
        title="Compare PDFs"
        description="Easily display the differences between two similar files."
        icon={GitCompare}
        category="security"
        categoryColor="security"
      >
        <div className="max-w-2xl mx-auto space-y-6">
          {!hasFirstFile ? (
            /* Step 1: Upload first file — big centered drop zone like iLovePDF */
            <div className="flex flex-col items-center gap-4 py-8">
              <FileDropZone
                accept={['.pdf']}
                files={file1}
                onFilesChange={f => setFile1(f.slice(0, 1))}
                multiple={false}
                hideFileList
                buttonText="Select PDF file"
                buttonTextWithFiles="Change File"
              />
            </div>
          ) : (
            /* Step 2: First file uploaded, show it and prompt for second */
            <div className="space-y-6">
              {/* First file card */}
              <div className="flex items-center gap-4 p-4 bg-card border border-border rounded-xl">
                <div className="w-14 h-18 bg-muted rounded-lg overflow-hidden shrink-0 flex items-center justify-center">
                  {file1[0].thumbnail ? (
                    <img src={file1[0].thumbnail} alt={file1[0].name} className="w-full h-full object-cover" />
                  ) : (
                    <FileText className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{file1[0].name}</p>
                  <p className="text-sm text-muted-foreground">
                    {file1[0].pageCount} page{file1[0].pageCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setFile1([])} className="text-muted-foreground hover:text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Second file drop zone */}
              <div className="text-center text-sm text-muted-foreground font-medium">
                Now select the second PDF to compare
              </div>
              <FileDropZone
                accept={['.pdf']}
                files={file2}
                onFilesChange={f => setFile2(f.slice(0, 1))}
                multiple={false}
                hideFileList
                buttonText="Select second PDF"
                buttonTextWithFiles="Change File"
              />
            </div>
          )}

          <PrivacyBadge />
        </div>
      </ToolLayout>
    );
  }

  // ─── Comparison view — full-width layout ───────────────────────────────────
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top toolbar */}
      <div className="bg-card border-b border-border px-4 py-2 flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={handleReset} className="gap-1">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>

        <div className="h-6 w-px bg-border" />

        {/* Scroll sync toggle */}
        <button
          onClick={() => setScrollSync(!scrollSync)}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors",
            scrollSync ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Scroll sync
        </button>

        <div className="flex-1" />

        {/* Page navigation in toolbar */}
        {maxPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {currentPage + 1} / {maxPages}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(maxPages - 1, p + 1))}
              disabled={currentPage >= maxPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main viewer area */}
        <div className="flex-1 flex">
          {compareMode === 'semantic' ? (
            <>
              {/* Left viewer - Original */}
              <div className="flex-1 flex flex-col border-r border-border relative">
                {/* Close button */}
                <button
                  onClick={() => { setFile1([]); handleReset(); }}
                  className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-foreground/80 text-background flex items-center justify-center hover:bg-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex-1 overflow-auto bg-muted/20 flex justify-center p-4"
                  ref={viewer1Ref}
                  onScroll={() => handleScroll('left')}
                >
                  <div style={{ transform: `scale(${zoom1 / 100})`, transformOrigin: 'top center' }}>
                    {thumbnails1[currentPage] ? (
                      <div className="relative">
                        <img
                          src={thumbnails1[currentPage]}
                          alt={`Original Page ${currentPage + 1}`}
                          className="shadow-lg rounded"
                        />
                        {compareResult?.pages[currentPage] && (
                          <DiffHighlights
                            changes={compareResult.pages[currentPage].changes}
                            type="removed"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="w-[400px] h-[560px] bg-card rounded-lg flex items-center justify-center text-muted-foreground">
                        No page
                      </div>
                    )}
                  </div>
                </div>
                {/* Bottom zoom bar */}
                <ZoomBar
                  zoom={zoom1}
                  onZoomChange={setZoom1}
                  fileName={file1[0]?.name || ''}
                  pageInfo={thumbnails1.length > 0 ? `Page ${currentPage + 1} of ${thumbnails1.length}` : undefined}
                />
              </div>

              {/* Divider handle */}
              <div className="w-px bg-border relative flex items-center justify-center">
                <div className="absolute z-10 w-6 h-10 bg-card border border-border rounded flex items-center justify-center">
                  <div className="flex flex-col gap-0.5">
                    <div className="w-0.5 h-0.5 bg-muted-foreground rounded-full" />
                    <div className="w-0.5 h-0.5 bg-muted-foreground rounded-full" />
                    <div className="w-0.5 h-0.5 bg-muted-foreground rounded-full" />
                  </div>
                </div>
              </div>

              {/* Right viewer - Modified */}
              <div className="flex-1 flex flex-col relative">
                {/* Close button */}
                <button
                  onClick={() => { setFile2([]); handleReset(); }}
                  className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-foreground/80 text-background flex items-center justify-center hover:bg-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
                <div className="flex-1 overflow-auto bg-muted/20 flex justify-center p-4"
                  ref={viewer2Ref}
                  onScroll={() => handleScroll('right')}
                >
                  <div style={{ transform: `scale(${zoom2 / 100})`, transformOrigin: 'top center' }}>
                    {thumbnails2[currentPage] ? (
                      <div className="relative">
                        <img
                          src={thumbnails2[currentPage]}
                          alt={`Modified Page ${currentPage + 1}`}
                          className="shadow-lg rounded"
                        />
                        {compareResult?.pages[currentPage] && (
                          <DiffHighlights
                            changes={compareResult.pages[currentPage].changes}
                            type="added"
                          />
                        )}
                      </div>
                    ) : (
                      <div className="w-[400px] h-[560px] bg-card rounded-lg flex items-center justify-center text-muted-foreground">
                        No page
                      </div>
                    )}
                  </div>
                </div>
                <ZoomBar
                  zoom={zoom2}
                  onZoomChange={setZoom2}
                  fileName={file2[0]?.name || ''}
                  pageInfo={thumbnails2.length > 0 ? `Page ${currentPage + 1} of ${thumbnails2.length}` : undefined}
                />
              </div>
            </>
          ) : (
            /* Overlay mode - single viewer */
            <div className="flex-1 flex flex-col">
              <div className="flex-1 overflow-auto bg-muted/20 flex justify-center p-4">
                <div style={{ transform: `scale(${zoom1 / 100})`, transformOrigin: 'top center' }}>
                  {overlayImages.get(currentPage) ? (
                    <img
                      src={overlayImages.get(currentPage)}
                      alt={`Overlay Page ${currentPage + 1}`}
                      className="shadow-lg rounded"
                    />
                  ) : (
                    <div className="w-[500px] h-[700px] bg-card rounded-lg flex items-center justify-center">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
              <ZoomBar
                zoom={zoom1}
                onZoomChange={setZoom1}
                fileName="Overlay View"
              />
            </div>
          )}
        </div>

        {/* Right sidebar - Compare controls */}
        <div className="w-[340px] border-l border-border bg-card flex flex-col shrink-0 hidden lg:flex">
          <div className="p-4 border-b border-border">
            <h2 className="text-lg font-semibold text-center">Compare PDF</h2>
          </div>

          {/* Mode tabs */}
          <div className="grid grid-cols-2 border-b border-border">
            <button
              onClick={() => setCompareMode('semantic')}
              className={cn(
                "flex flex-col items-center gap-1.5 p-4 text-xs transition-colors relative",
                compareMode === 'semantic'
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {compareMode === 'semantic' && (
                <span className="absolute top-2 right-2 w-5 h-5 bg-success text-success-foreground rounded-full flex items-center justify-center text-[10px] font-bold">✓</span>
              )}
              <AlignLeft className="h-7 w-7" />
              <span className="font-medium">Semantic Text</span>
            </button>
            <button
              onClick={() => setCompareMode('overlay')}
              className={cn(
                "flex flex-col items-center gap-1.5 p-4 text-xs transition-colors relative",
                compareMode === 'overlay'
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {compareMode === 'overlay' && (
                <span className="absolute top-2 right-2 w-5 h-5 bg-success text-success-foreground rounded-full flex items-center justify-center text-[10px] font-bold">✓</span>
              )}
              <Layers className="h-7 w-7" />
              <span className="font-medium">Content Overlay</span>
            </button>
          </div>

          {/* Mode description */}
          <div className="p-3 border-b border-border">
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm text-muted-foreground">
              {compareMode === 'semantic'
                ? 'Compare text changes between two PDFs.'
                : 'Overlay content from two files and display any changes in a separate color.'}
            </div>
          </div>

          {/* File thumbnails with page selectors */}
          <div className="p-3 space-y-2 border-b border-border">
            <FilePageSelector
              file={file1[0]}
              thumbnail={thumbnails1[0]}
              pageCount={thumbnails1.length}
              currentPage={currentPage + 1}
              onPageChange={p => setCurrentPage(p - 1)}
              onReplace={() => { setFile1([]); handleReset(); }}
            />
            <FilePageSelector
              file={file2[0]}
              thumbnail={thumbnails2[0]}
              pageCount={thumbnails2.length}
              currentPage={currentPage + 1}
              onPageChange={p => setCurrentPage(p - 1)}
              onReplace={() => { setFile2([]); handleReset(); }}
            />
          </div>

          {/* Search */}
          <div className="p-3 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Change report */}
          <div className="flex-1 overflow-auto p-3">
            {isComparing ? (
              <div className="flex items-center gap-2 py-4 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Analyzing...</span>
              </div>
            ) : compareResult ? (
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">
                  Change report ({compareResult.totalChanges})
                </h3>
                {filteredPages.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    {searchText ? 'No matching changes found.' : 'No differences detected.'}
                  </p>
                ) : (
                  filteredPages.map(page => (
                    <div key={page.pageIndex} className="space-y-1.5">
                      <button
                        onClick={() => setCurrentPage(page.pageIndex)}
                        className={cn(
                          "text-xs font-medium w-full text-left px-2 py-1.5 rounded transition-colors",
                          currentPage === page.pageIndex
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                        )}
                      >
                        Page {page.pageIndex + 1}
                      </button>
                      <div className="space-y-1.5 pl-2">
                        {page.changes
                          .filter(c => c.type !== 'unchanged')
                          .filter(c => !searchText || c.value.toLowerCase().includes(searchText.toLowerCase()))
                          .slice(0, 10)
                          .map((change, idx) => (
                            <ChangeItem key={idx} change={change} />
                          ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>

          {/* Download button */}
          <div className="p-3 border-t border-border">
            {isProcessing && <ProgressBar progress={progress} />}
            <Button
              onClick={handleDownloadReport}
              disabled={isProcessing}
              size="lg"
              className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2 text-base font-semibold"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Download report
                  <Download className="h-5 w-5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

/** Zoom control bar at the bottom of each viewer */
const ZoomBar = ({
  zoom,
  onZoomChange,
  fileName,
  pageInfo,
}: {
  zoom: number;
  onZoomChange: (z: number) => void;
  fileName: string;
  pageInfo?: string;
}) => (
  <div className="bg-card border-t border-border px-3 py-2 flex items-center gap-2">
    <select
      value={zoom}
      onChange={e => onZoomChange(Number(e.target.value))}
      className="bg-muted text-sm rounded px-2 py-1 border border-border"
    >
      {[25, 50, 75, 100, 125, 150, 200, 300].map(v => (
        <option key={v} value={v}>{v}%</option>
      ))}
    </select>
    <Button variant="ghost" size="sm" onClick={() => onZoomChange(Math.max(25, zoom - 25))}>
      <Minus className="h-3.5 w-3.5" />
    </Button>
    <Button variant="ghost" size="sm" onClick={() => onZoomChange(Math.min(300, zoom + 25))}>
      <Plus className="h-3.5 w-3.5" />
    </Button>
    <span className="ml-auto text-xs text-muted-foreground truncate max-w-[200px]">{fileName}</span>
    {pageInfo && (
      <span className="text-xs text-muted-foreground ml-2">{pageInfo}</span>
    )}
  </div>
);

/** File thumbnail + page selector in sidebar */
const FilePageSelector = ({
  file,
  thumbnail,
  pageCount,
  currentPage,
  onPageChange,
  onReplace,
}: {
  file: PDFFile;
  thumbnail?: string;
  pageCount: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  onReplace: () => void;
}) => (
  <div className="flex items-center gap-3 p-2 bg-muted/30 rounded-lg">
    <div className="w-12 h-16 bg-muted rounded overflow-hidden shrink-0 flex items-center justify-center border border-border">
      {thumbnail ? (
        <img src={thumbnail} alt={file.name} className="w-full h-full object-cover" />
      ) : (
        <FileText className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate" title={file.name}>{file.name}</p>
      <input
        type="number"
        min={1}
        max={pageCount || 1}
        value={Math.min(currentPage, pageCount || 1)}
        onChange={e => {
          const v = parseInt(e.target.value);
          if (v >= 1 && v <= (pageCount || 1)) onPageChange(v);
        }}
        className="w-16 mt-1 bg-background border border-border rounded px-2 py-0.5 text-sm"
      />
    </div>
    <Button variant="ghost" size="sm" onClick={onReplace} title="Replace file">
      <Upload className="h-4 w-4" />
    </Button>
  </div>
);

/** Single change item in the report */
const ChangeItem = ({ change }: { change: DiffChange }) => {
  if (change.type === 'unchanged') return null;
  const isAdded = change.type === 'added';
  const wordCount = change.value.split(/\s+/).filter(Boolean).length;
  return (
    <div className={cn(
      "text-xs px-2 py-1.5 rounded border-l-2",
      isAdded
        ? "bg-success/5 border-success"
        : "bg-destructive/5 border-destructive"
    )}>
      <div className="flex items-center justify-between">
        <span className={cn("font-semibold", isAdded ? "text-success" : "text-destructive")}>
          {isAdded ? 'New' : 'Old'}
        </span>
        <span className={cn("text-xs font-medium", isAdded ? "text-success" : "text-destructive")}>
          {isAdded ? `+${wordCount}` : `-${wordCount}`}
        </span>
      </div>
      <p className="mt-0.5 break-words text-foreground/70 line-clamp-3">{change.value}</p>
    </div>
  );
};

/** Visual diff highlight overlay on page images (decorative) */
const DiffHighlights = ({
  changes,
  type,
}: {
  changes: DiffChange[];
  type: 'added' | 'removed';
}) => {
  const relevantChanges = changes.filter(c => c.type === type);
  if (relevantChanges.length === 0) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      <div
        className={cn(
          "absolute top-2 right-2 px-2 py-1 rounded text-xs font-medium",
          type === 'removed'
            ? "bg-destructive/20 text-destructive"
            : "bg-success/20 text-success"
        )}
      >
        {relevantChanges.length} {type === 'removed' ? 'removed' : 'added'}
      </div>
    </div>
  );
};

export default ComparePdf;
