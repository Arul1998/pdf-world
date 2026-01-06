import { useState, useEffect, useCallback, useRef } from 'react';
import { EyeOff, Download, Loader2, Plus, Trash2 } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { redactPdf, downloadBlob, renderPdfPages, type PDFFile } from '@/lib/pdf-tools';

interface RedactionArea {
  id: string;
  pageIndex: number;
  x: number; // percentage
  y: number; // percentage
  width: number; // percentage
  height: number; // percentage
}

const RedactPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pages, setPages] = useState<{ dataUrl: string; width: number; height: number }[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [redactions, setRedactions] = useState<RedactionArea[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [tempRedaction, setTempRedaction] = useState<RedactionArea | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadPages = useCallback(async () => {
    if (files.length === 0) return;
    const renderedPages = await renderPdfPages(files[0].file, 1.5);
    setPages(renderedPages);
  }, [files]);

  useEffect(() => {
    if (files.length > 0) {
      loadPages();
      setCurrentPage(0);
      setRedactions([]);
    } else {
      setPages([]);
    }
  }, [files, loadPages]);

  const getMousePosition = (e: React.MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const pos = getMousePosition(e);
    setIsDrawing(true);
    setDrawStart(pos);
    setTempRedaction({
      id: `temp-${Date.now()}`,
      pageIndex: currentPage,
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing || !drawStart) return;
    const pos = getMousePosition(e);
    setTempRedaction({
      id: `temp-${Date.now()}`,
      pageIndex: currentPage,
      x: Math.min(drawStart.x, pos.x),
      y: Math.min(drawStart.y, pos.y),
      width: Math.abs(pos.x - drawStart.x),
      height: Math.abs(pos.y - drawStart.y),
    });
  };

  const handleMouseUp = () => {
    if (tempRedaction && tempRedaction.width > 1 && tempRedaction.height > 1) {
      setRedactions(prev => [...prev, { ...tempRedaction, id: `redact-${Date.now()}` }]);
    }
    setIsDrawing(false);
    setDrawStart(null);
    setTempRedaction(null);
  };

  const removeRedaction = (id: string) => {
    setRedactions(prev => prev.filter(r => r.id !== id));
  };

  const handleRedact = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    if (redactions.length === 0) {
      toast.error('Please draw at least one redaction area');
      return;
    }

    setIsProcessing(true);
    setProgress(30);

    try {
      const result = await redactPdf(files[0].file, redactions);
      setProgress(80);
      
      const filename = files[0].name.replace('.pdf', '_redacted.pdf');
      downloadBlob(result, filename);
      setProgress(100);
      
      toast.success('PDF redacted successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to redact PDF. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const currentPageRedactions = redactions.filter(r => r.pageIndex === currentPage);

  return (
    <ToolLayout
      title="Redact PDF"
      description="Permanently remove sensitive content by drawing black boxes over areas you want to hide."
      icon={EyeOff}
      category="security"
      categoryColor="security"
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

        {files.length > 0 && pages.length > 0 && (
          <div className="space-y-4">
            {/* Page preview with redaction drawing */}
            <div className="relative flex justify-center bg-muted/30 rounded-lg p-4">
              <div
                ref={containerRef}
                className="relative cursor-crosshair select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => isDrawing && handleMouseUp()}
              >
                <img
                  src={pages[currentPage].dataUrl}
                  alt={`Page ${currentPage + 1}`}
                  className="max-h-[500px] rounded shadow-sm pointer-events-none"
                  draggable={false}
                />
                
                {/* Existing redactions */}
                {currentPageRedactions.map((redaction) => (
                  <div
                    key={redaction.id}
                    className="absolute bg-black group"
                    style={{
                      left: `${redaction.x}%`,
                      top: `${redaction.y}%`,
                      width: `${redaction.width}%`,
                      height: `${redaction.height}%`,
                    }}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRedaction(redaction.id);
                      }}
                      className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                
                {/* Temporary redaction being drawn */}
                {tempRedaction && (
                  <div
                    className="absolute bg-black/70 border-2 border-dashed border-primary"
                    style={{
                      left: `${tempRedaction.x}%`,
                      top: `${tempRedaction.y}%`,
                      width: `${tempRedaction.width}%`,
                      height: `${tempRedaction.height}%`,
                    }}
                  />
                )}
              </div>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Click and drag to draw redaction areas. They will be permanently blacked out.
            </p>

            {/* Page navigation */}
            {pages.length > 1 && (
              <div className="flex items-center justify-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage + 1} of {pages.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))}
                  disabled={currentPage === pages.length - 1}
                >
                  Next
                </Button>
              </div>
            )}

            {/* Redaction count */}
            <div className="p-4 bg-muted/50 rounded-xl flex items-center justify-between">
              <div>
                <span className="font-medium">{redactions.length}</span>
                <span className="text-muted-foreground ml-1">redaction area(s) marked</span>
              </div>
              {redactions.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setRedactions([])}>
                  Clear All
                </Button>
              )}
            </div>
          </div>
        )}

        {isProcessing && <ProgressBar progress={progress} />}

        <Button
          onClick={handleRedact}
          disabled={files.length === 0 || redactions.length === 0 || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Redacting...
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Redact & Download
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default RedactPdf;
