import { useState, useCallback } from 'react';
import { ArrowDownUp, Download, Loader2, GripVertical, RotateCw, Trash2 } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PDFDocument, degrees } from 'pdf-lib';
import { readFileAsArrayBuffer, downloadBlob, generatePdfThumbnail, type PDFFile } from '@/lib/pdf-tools';
import * as pdfjsLib from 'pdfjs-dist';

interface PageInfo {
  index: number;
  rotation: number;
  removed: boolean;
  thumbnail?: string;
}

const OrganizePages = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const loadPages = useCallback(async (file: File) => {
    setIsLoading(true);
    try {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const pageInfos: PageInfo[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 0.3;
        const viewport = page.getViewport({ scale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          
          pageInfos.push({
            index: i - 1,
            rotation: 0,
            removed: false,
            thumbnail: canvas.toDataURL('image/jpeg', 0.6),
          });
        }
      }

      setPages(pageInfos);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load PDF pages');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleFilesChange = useCallback((newFiles: PDFFile[]) => {
    setFiles(newFiles.slice(0, 1));
    if (newFiles.length > 0) {
      loadPages(newFiles[0].file);
    } else {
      setPages([]);
    }
  }, [loadPages]);

  const rotatePage = (pageIndex: number) => {
    setPages(prev => prev.map((p, i) => 
      i === pageIndex ? { ...p, rotation: (p.rotation + 90) % 360 } : p
    ));
  };

  const toggleRemove = (pageIndex: number) => {
    const activePages = pages.filter(p => !p.removed).length;
    const isRemoving = !pages[pageIndex].removed;
    
    if (isRemoving && activePages <= 1) {
      toast.error('Cannot remove all pages');
      return;
    }

    setPages(prev => prev.map((p, i) => 
      i === pageIndex ? { ...p, removed: !p.removed } : p
    ));
  };

  const movePage = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= pages.length) return;
    
    const newPages = [...pages];
    [newPages[fromIndex], newPages[toIndex]] = [newPages[toIndex], newPages[fromIndex]];
    setPages(newPages);
  };

  const handleSave = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      const arrayBuffer = await readFileAsArrayBuffer(files[0].file);
      const sourcePdf = await PDFDocument.load(arrayBuffer);
      const newPdf = await PDFDocument.create();

      const activePages = pages.filter(p => !p.removed);
      
      for (let i = 0; i < activePages.length; i++) {
        const pageInfo = activePages[i];
        const [copiedPage] = await newPdf.copyPages(sourcePdf, [pageInfo.index]);
        
        if (pageInfo.rotation !== 0) {
          const currentRotation = copiedPage.getRotation().angle;
          copiedPage.setRotation(degrees(currentRotation + pageInfo.rotation));
        }
        
        newPdf.addPage(copiedPage);
        setProgress(((i + 1) / activePages.length) * 80);
      }

      const result = await newPdf.save();
      const filename = files[0].name.replace('.pdf', '_organized.pdf');
      downloadBlob(result, filename);
      setProgress(100);
      
      toast.success('PDF organized successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to save PDF. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="Organize Pages"
      description="Reorder, rotate, and delete pages in your PDF visually."
      icon={ArrowDownUp}
      category="organize"
      categoryColor="organize"
    >
      <div className="space-y-6">
        {pages.length === 0 && (
          <FileDropZone
            accept={['.pdf']}
            files={files}
            onFilesChange={handleFilesChange}
            multiple={false}
          />
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading pages...</span>
          </div>
        )}

        {pages.length > 0 && !isLoading && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {pages.filter(p => !p.removed).length} of {pages.length} pages selected
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setFiles([]);
                  setPages([]);
                }}
              >
                Choose Different PDF
              </Button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {pages.map((page, index) => (
                <div
                  key={index}
                  className={`relative group rounded-xl border-2 overflow-hidden transition-all ${
                    page.removed 
                      ? 'opacity-40 border-destructive/50' 
                      : 'border-border hover:border-primary'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-[3/4] bg-muted flex items-center justify-center">
                    {page.thumbnail ? (
                      <img
                        src={page.thumbnail}
                        alt={`Page ${index + 1}`}
                        className="w-full h-full object-contain"
                        style={{ transform: `rotate(${page.rotation}deg)` }}
                      />
                    ) : (
                      <span className="text-muted-foreground">Page {index + 1}</span>
                    )}
                  </div>

                  {/* Page Number */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-foreground/80 to-transparent p-2">
                    <span className="text-xs font-medium text-background">{index + 1}</span>
                  </div>

                  {/* Controls */}
                  <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      onClick={() => movePage(index, 'up')}
                      disabled={index === 0}
                    >
                      <GripVertical className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-7 w-7"
                      onClick={() => rotatePage(index)}
                    >
                      <RotateCw className="h-3 w-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant={page.removed ? 'default' : 'secondary'}
                      className="h-7 w-7"
                      onClick={() => toggleRemove(index)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {isProcessing && (
          <ProgressBar progress={progress} />
        )}

        {pages.length > 0 && !isLoading && (
          <Button
            onClick={handleSave}
            disabled={isProcessing || pages.filter(p => !p.removed).length === 0}
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
                Save & Download
              </>
            )}
          </Button>
        )}
      </div>
    </ToolLayout>
  );
};

export default OrganizePages;
