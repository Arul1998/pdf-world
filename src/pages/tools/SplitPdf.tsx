import { useState, useEffect, useCallback } from 'react';
import { Scissors, Download, Loader2, Plus, Trash2, FileArchive, Check } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { splitPdf, downloadBlob, type PDFFile, readFileAsArrayBuffer, extractPages, compressPdf } from '@/lib/pdf-tools';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { cn } from '@/lib/utils';

interface PageThumbnail {
  pageNum: number;
  thumbnail: string;
}

interface Range {
  id: string;
  from: number;
  to: number;
}

const SplitPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  
  // Thumbnails
  const [thumbnails, setThumbnails] = useState<PageThumbnail[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [thumbnailProgress, setThumbnailProgress] = useState({ current: 0, total: 0 });
  
  // Split mode
  const [splitMode, setSplitMode] = useState<'range' | 'pages' | 'size'>('range');
  
  // Range mode
  const [ranges, setRanges] = useState<Range[]>([{ id: '1', from: 1, to: 1 }]);
  const [mergeRanges, setMergeRanges] = useState(false);
  
  // Pages mode
  const [extractAll, setExtractAll] = useState(true);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  
  // Size mode
  const [maxSize, setMaxSize] = useState(5);
  const [sizeUnit, setSizeUnit] = useState<'KB' | 'MB'>('MB');
  const [allowCompression, setAllowCompression] = useState(false);

  const pageCount = files[0]?.pageCount || 0;

  // Generate thumbnails for all pages
  const generateAllThumbnails = useCallback(async (file: File, totalPages: number) => {
    setLoadingThumbnails(true);
    setThumbnailProgress({ current: 0, total: totalPages });
    const newThumbnails: PageThumbnail[] = [];

    try {
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      for (let i = 1; i <= totalPages; i++) {
        setThumbnailProgress({ current: i, total: totalPages });
        
        try {
          const page = await pdf.getPage(i);
          const scale = 0.3;
          const viewport = page.getViewport({ scale });
          
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;
          
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          await page.render({ canvasContext: context, viewport, canvas }).promise;
          
          newThumbnails.push({
            pageNum: i,
            thumbnail: canvas.toDataURL('image/jpeg', 0.6),
          });
        } catch (err) {
          console.error(`Failed to generate thumbnail for page ${i}:`, err);
          newThumbnails.push({ pageNum: i, thumbnail: '' });
        }
      }
    } catch (error) {
      console.error('Failed to load PDF for thumbnails:', error);
    }

    setThumbnails(newThumbnails);
    setLoadingThumbnails(false);
    setThumbnailProgress({ current: 0, total: 0 });
  }, []);

  // When file changes, generate thumbnails
  useEffect(() => {
    if (files.length > 0 && files[0].pageCount) {
      generateAllThumbnails(files[0].file, files[0].pageCount);
      setRanges([{ id: '1', from: 1, to: files[0].pageCount }]);
    } else {
      setThumbnails([]);
      setRanges([{ id: '1', from: 1, to: 1 }]);
      setSelectedPages(new Set());
    }
  }, [files, generateAllThumbnails]);

  // Range helpers
  const addRange = () => {
    const newId = String(Date.now());
    setRanges([...ranges, { id: newId, from: 1, to: pageCount || 1 }]);
  };

  const removeRange = (id: string) => {
    if (ranges.length > 1) {
      setRanges(ranges.filter(r => r.id !== id));
    }
  };

  const updateRange = (id: string, field: 'from' | 'to', value: number) => {
    setRanges(ranges.map(r => 
      r.id === id ? { ...r, [field]: Math.max(1, Math.min(value, pageCount)) } : r
    ));
  };

  // Page selection helpers
  const togglePage = (pageNum: number) => {
    const newSelected = new Set(selectedPages);
    if (newSelected.has(pageNum)) {
      newSelected.delete(pageNum);
    } else {
      newSelected.add(pageNum);
    }
    setSelectedPages(newSelected);
  };

  const selectAllPages = () => {
    const allPages = new Set<number>();
    for (let i = 1; i <= pageCount; i++) {
      allPages.add(i);
    }
    setSelectedPages(allPages);
  };

  const clearSelection = () => {
    setSelectedPages(new Set());
  };

  // Get pages in range for highlighting
  const getPagesInRanges = (): Set<number> => {
    const pagesInRange = new Set<number>();
    for (const range of ranges) {
      for (let i = range.from; i <= range.to; i++) {
        pagesInRange.add(i);
      }
    }
    return pagesInRange;
  };

  // Calculate output count
  const getOutputCount = (): number => {
    if (splitMode === 'range') {
      return mergeRanges ? 1 : ranges.length;
    } else if (splitMode === 'pages') {
      if (extractAll) return pageCount;
      return selectedPages.size;
    }
    return 0; // Size mode calculates dynamically
  };

  // Handle split
  const handleSplit = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const results: { data: Uint8Array; name: string }[] = [];
      const baseName = files[0].name.replace('.pdf', '');

      if (splitMode === 'range') {
        // Validate ranges
        for (const range of ranges) {
          if (range.from < 1 || range.to > pageCount || range.from > range.to) {
            toast.error(`Invalid range: ${range.from}-${range.to}`);
            setIsProcessing(false);
            return;
          }
        }

        setProgressText('Splitting by ranges...');
        
        if (mergeRanges) {
          // Merge all ranges into one PDF
          const allPages = new Set<number>();
          for (const range of ranges) {
            for (let i = range.from; i <= range.to; i++) {
              allPages.add(i);
            }
          }
          const sortedPages = Array.from(allPages).sort((a, b) => a - b);
          const result = await extractPages(files[0].file, sortedPages);
          results.push({ data: result, name: `${baseName}_merged.pdf` });
        } else {
          const splitResults = await splitPdf(
            files[0].file,
            ranges.map(r => ({ start: r.from, end: r.to }))
          );
          
          splitResults.forEach((result, i) => {
            const range = ranges[i];
            results.push({ 
              data: result, 
              name: `${baseName}_${range.from}-${range.to}.pdf` 
            });
            setProgress(((i + 1) / splitResults.length) * 80);
          });
        }
      } else if (splitMode === 'pages') {
        setProgressText('Extracting pages...');
        
        const pagesToExtract = extractAll 
          ? Array.from({ length: pageCount }, (_, i) => i + 1)
          : Array.from(selectedPages).sort((a, b) => a - b);

        if (pagesToExtract.length === 0) {
          toast.error('Please select at least one page');
          setIsProcessing(false);
          return;
        }

        for (let i = 0; i < pagesToExtract.length; i++) {
          const pageNum = pagesToExtract[i];
          const result = await extractPages(files[0].file, [pageNum]);
          results.push({ data: result, name: `${baseName}_page${pageNum}.pdf` });
          setProgress(((i + 1) / pagesToExtract.length) * 80);
        }
      } else if (splitMode === 'size') {
        setProgressText('Splitting by size...');
        
        const maxBytes = maxSize * (sizeUnit === 'MB' ? 1024 * 1024 : 1024);
        let currentPages: number[] = [];
        let partIndex = 1;

        for (let i = 1; i <= pageCount; i++) {
          currentPages.push(i);
          
          // Check size of current batch
          const testResult = await extractPages(files[0].file, currentPages);
          let finalResult = testResult;
          
          if (allowCompression) {
            const tempFile = new File([testResult.buffer.slice(testResult.byteOffset, testResult.byteOffset + testResult.byteLength) as ArrayBuffer], 'temp.pdf', { type: 'application/pdf' });
            finalResult = await compressPdf(tempFile);
          }

          if (finalResult.length > maxBytes && currentPages.length > 1) {
            // Remove last page and save
            currentPages.pop();
            const result = await extractPages(files[0].file, currentPages);
            let compressedResult = result;
            
            if (allowCompression) {
              const tempFile = new File([result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength) as ArrayBuffer], 'temp.pdf', { type: 'application/pdf' });
              compressedResult = await compressPdf(tempFile);
            }
            
            results.push({ 
              data: compressedResult, 
              name: `${baseName}_part${partIndex}.pdf` 
            });
            partIndex++;
            currentPages = [i];
          }
          
          setProgress((i / pageCount) * 80);
        }

        // Save remaining pages
        if (currentPages.length > 0) {
          const result = await extractPages(files[0].file, currentPages);
          let compressedResult = result;
          
          if (allowCompression) {
            const tempFile = new File([result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength) as ArrayBuffer], 'temp.pdf', { type: 'application/pdf' });
            compressedResult = await compressPdf(tempFile);
          }
          
          results.push({ 
            data: compressedResult, 
            name: `${baseName}_part${partIndex}.pdf` 
          });
        }
      }

      setProgress(85);
      setProgressText('Preparing download...');

      // Download as ZIP if multiple files, otherwise single download
      if (results.length > 1) {
        const zip = new JSZip();
        results.forEach(({ data, name }) => {
          zip.file(name, new Uint8Array(data));
        });
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseName}_split.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (results.length === 1) {
        downloadBlob(results[0].data, results[0].name);
      }

      setProgress(100);
      toast.success(`Split into ${results.length} file(s)!`);
    } catch (error) {
      console.error(error);
      toast.error('Failed to split PDF. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setProgressText('');
    }
  };

  const pagesInRanges = splitMode === 'range' ? getPagesInRanges() : new Set<number>();

  return (
    <ToolLayout
      title="Split PDF"
      description="Separate a PDF into multiple documents by ranges, pages, or file size."
      icon={Scissors}
      category="organize"
      categoryColor="organize"
    >
      <div className="space-y-6">
        {/* File Upload */}
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={(newFiles) => setFiles(newFiles.slice(0, 1))}
          multiple={false}
        />

        {files.length > 0 && pageCount > 0 && (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Side - Thumbnails */}
            <div className="flex-1 min-w-0">
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground">
                    Pages ({pageCount})
                  </h3>
                  {splitMode === 'pages' && !extractAll && (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={selectAllPages}>
                        Select All
                      </Button>
                      <Button variant="ghost" size="sm" onClick={clearSelection}>
                        Clear
                      </Button>
                    </div>
                  )}
                </div>

                {/* Loading indicator */}
                {loadingThumbnails && (
                  <div className="flex items-center justify-center gap-3 py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Loading page {thumbnailProgress.current} of {thumbnailProgress.total}...
                    </span>
                  </div>
                )}

                {/* Thumbnail Grid */}
                {!loadingThumbnails && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-3 max-h-[500px] overflow-y-auto pr-1">
                    {thumbnails.map(({ pageNum, thumbnail }) => {
                      const isInRange = pagesInRanges.has(pageNum);
                      const isSelected = selectedPages.has(pageNum);
                      const isHighlighted = splitMode === 'range' ? isInRange : (splitMode === 'pages' && !extractAll ? isSelected : true);
                      const isClickable = splitMode === 'pages' && !extractAll;

                      return (
                        <div
                          key={pageNum}
                          onClick={() => isClickable && togglePage(pageNum)}
                          className={cn(
                            "relative rounded-lg overflow-hidden border-2 transition-all",
                            isClickable && "cursor-pointer hover:scale-105",
                            isHighlighted 
                              ? "border-primary shadow-md ring-2 ring-primary/20" 
                              : "border-border/50 opacity-50",
                          )}
                        >
                          {thumbnail ? (
                            <img
                              src={thumbnail}
                              alt={`Page ${pageNum}`}
                              className="w-full aspect-[3/4] object-cover bg-white"
                            />
                          ) : (
                            <div className="w-full aspect-[3/4] bg-muted flex items-center justify-center">
                              <span className="text-xs text-muted-foreground">No preview</span>
                            </div>
                          )}
                          
                          {/* Page number badge */}
                          <div className={cn(
                            "absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded text-xs font-medium",
                            isHighlighted ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            {pageNum}
                          </div>

                          {/* Selection checkmark */}
                          {splitMode === 'pages' && !extractAll && isSelected && (
                            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-3 h-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Side - Settings Panel */}
            <div className="w-full lg:w-80 lg:sticky lg:top-4 lg:self-start">
              <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <Tabs value={splitMode} onValueChange={(v) => setSplitMode(v as typeof splitMode)}>
                  <TabsList className="w-full grid grid-cols-3 mb-4">
                    <TabsTrigger value="range">Range</TabsTrigger>
                    <TabsTrigger value="pages">Pages</TabsTrigger>
                    <TabsTrigger value="size">Size</TabsTrigger>
                  </TabsList>

                  {/* Range Tab */}
                  <TabsContent value="range" className="space-y-4">
                    <div className="space-y-3">
                      {ranges.map((range, index) => (
                        <div key={range.id} className="flex items-center gap-2">
                          <div className="flex-1 flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              max={pageCount}
                              value={range.from}
                              onChange={(e) => updateRange(range.id, 'from', parseInt(e.target.value) || 1)}
                              className="w-16 text-center"
                            />
                            <span className="text-muted-foreground">to</span>
                            <Input
                              type="number"
                              min={1}
                              max={pageCount}
                              value={range.to}
                              onChange={(e) => updateRange(range.id, 'to', parseInt(e.target.value) || 1)}
                              className="w-16 text-center"
                            />
                          </div>
                          {ranges.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => removeRange(range.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={addRange}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Range
                    </Button>

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <Label htmlFor="merge-ranges" className="text-sm cursor-pointer">
                        Merge all ranges into one PDF
                      </Label>
                      <Switch
                        id="merge-ranges"
                        checked={mergeRanges}
                        onCheckedChange={setMergeRanges}
                      />
                    </div>

                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                      Output: <span className="font-semibold text-foreground">{getOutputCount()} PDF(s)</span>
                    </div>
                  </TabsContent>

                  {/* Pages Tab */}
                  <TabsContent value="pages" className="space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="extract-all" className="cursor-pointer">
                          Extract all pages
                        </Label>
                        <Switch
                          id="extract-all"
                          checked={extractAll}
                          onCheckedChange={setExtractAll}
                        />
                      </div>

                      {!extractAll && (
                        <p className="text-xs text-muted-foreground">
                          Click on page thumbnails to select pages for extraction.
                        </p>
                      )}
                    </div>

                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                      {extractAll ? (
                        <>
                          Output: <span className="font-semibold text-foreground">{pageCount} PDFs</span>
                          <p className="text-xs mt-1">Each page becomes a separate PDF</p>
                        </>
                      ) : (
                        <>
                          Selected: <span className="font-semibold text-foreground">{selectedPages.size} page(s)</span>
                          <p className="text-xs mt-1">
                            {selectedPages.size > 0 
                              ? `Will create ${selectedPages.size} separate PDF(s)` 
                              : 'Select pages to extract'}
                          </p>
                        </>
                      )}
                    </div>
                  </TabsContent>

                  {/* Size Tab */}
                  <TabsContent value="size" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Maximum output size</Label>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          value={maxSize}
                          onChange={(e) => setMaxSize(parseInt(e.target.value) || 1)}
                          className="flex-1"
                        />
                        <div className="flex rounded-md border border-input overflow-hidden">
                          <button
                            onClick={() => setSizeUnit('KB')}
                            className={cn(
                              "px-3 py-2 text-sm transition-colors",
                              sizeUnit === 'KB' 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-background hover:bg-muted"
                            )}
                          >
                            KB
                          </button>
                          <button
                            onClick={() => setSizeUnit('MB')}
                            className={cn(
                              "px-3 py-2 text-sm transition-colors",
                              sizeUnit === 'MB' 
                                ? "bg-primary text-primary-foreground" 
                                : "bg-background hover:bg-muted"
                            )}
                          >
                            MB
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <Label htmlFor="allow-compression" className="text-sm cursor-pointer">
                        Allow compression
                      </Label>
                      <Switch
                        id="allow-compression"
                        checked={allowCompression}
                        onCheckedChange={setAllowCompression}
                      />
                    </div>

                    <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                      <p>Split will create multiple PDFs, each under {maxSize} {sizeUnit}.</p>
                      {allowCompression && (
                        <p className="text-xs mt-1">Compression enabled to help reduce file sizes.</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Progress */}
                {isProcessing && (
                  <div className="mt-4 space-y-2">
                    <ProgressBar progress={progress} />
                    {progressText && (
                      <p className="text-xs text-center text-muted-foreground">{progressText}</p>
                    )}
                  </div>
                )}

                {/* Split Button */}
                <Button
                  onClick={handleSplit}
                  disabled={files.length === 0 || isProcessing || (splitMode === 'pages' && !extractAll && selectedPages.size === 0)}
                  size="lg"
                  className="w-full mt-4"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Splitting...
                    </>
                  ) : (
                    <>
                      {getOutputCount() > 1 ? (
                        <FileArchive className="mr-2 h-5 w-5" />
                      ) : (
                        <Download className="mr-2 h-5 w-5" />
                      )}
                      Split PDF
                    </>
                  )}
                </Button>

                {getOutputCount() > 1 && !isProcessing && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Will download as ZIP file
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default SplitPdf;
