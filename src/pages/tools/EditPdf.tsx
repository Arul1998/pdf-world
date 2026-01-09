import { useState, useEffect, useRef, useCallback } from 'react';
import { PenTool, Download, Type, Square, Circle, Image, Pencil, MousePointer, ChevronLeft, ChevronRight, Trash2, Undo, Redo, Minus, Plus, ZoomIn, ZoomOut } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { downloadBlob, type PDFFile } from '@/lib/pdf-tools';
import { Canvas as FabricCanvas, Rect, Circle as FabricCircle, IText, Image as FabricImage, FabricObject, PencilBrush } from 'fabric';
import * as pdfjsLib from 'pdfjs-dist/webpack.mjs';
import { PDFDocument, rgb } from 'pdf-lib';


type Tool = 'select' | 'draw' | 'text' | 'rectangle' | 'circle' | 'image';

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', 
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'
];

const EditPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pdfPages, setPdfPages] = useState<ImageData[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [activeColor, setActiveColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [fontSize, setFontSize] = useState(24);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [pageCanvasStates, setPageCanvasStates] = useState<Map<number, string>>(new Map());
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // Load PDF and render pages
  const loadPdf = useCallback(async () => {
    if (files.length === 0) return;
    
    setIsProcessing(true);
    setProgress(10);
    
    try {
      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);
      setProgress(30);
      
      // Render all pages to ImageData
      const pages: ImageData[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const scale = 1.5;
        const viewport = page.getViewport({ scale });
        
        const offscreen = document.createElement('canvas');
        offscreen.width = viewport.width;
        offscreen.height = viewport.height;
        const ctx = offscreen.getContext('2d')!;
        
        await page.render({ canvasContext: ctx, viewport, canvas: offscreen }).promise;
        pages.push(ctx.getImageData(0, 0, viewport.width, viewport.height));
        setProgress(30 + ((i / pdf.numPages) * 60));
      }
      
      setPdfPages(pages);
      setCurrentPage(0);
      setPageCanvasStates(new Map());
      setProgress(100);
    } catch (error) {
      console.error('Error loading PDF:', error);
      const message = error instanceof Error ? error.message : 'Failed to load PDF';
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }, [files]);

  useEffect(() => {
    if (files.length > 0) {
      loadPdf();
    } else {
      setPdfPages([]);
      setTotalPages(0);
      setPageCanvasStates(new Map());
    }
  }, [files, loadPdf]);

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current || pdfPages.length === 0) return;
    
    const pageData = pdfPages[currentPage];
    if (!pageData) return;

    // Dispose existing canvas
    if (fabricCanvas) {
      // Save current state before switching
      const json = JSON.stringify(fabricCanvas.toJSON());
      setPageCanvasStates(prev => new Map(prev).set(currentPage, json));
      fabricCanvas.dispose();
    }

    const canvas = new FabricCanvas(canvasRef.current, {
      width: pageData.width,
      height: pageData.height,
      backgroundColor: '#ffffff',
      // Professional selection styling
      selectionColor: 'rgba(59, 130, 246, 0.15)',
      selectionBorderColor: '#3b82f6',
      selectionLineWidth: 1.5,
    });

    // Configure professional control styling for all objects
    FabricObject.prototype.set({
      transparentCorners: false,
      cornerColor: '#3b82f6',
      cornerStrokeColor: '#ffffff',
      cornerSize: 10,
      cornerStyle: 'circle',
      borderColor: '#3b82f6',
      borderScaleFactor: 1.5,
      padding: 8,
      borderDashArray: undefined,
    });

    // Render PDF page as background
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = pageData.width;
    tempCanvas.height = pageData.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.putImageData(pageData, 0, 0);
    
    FabricImage.fromURL(tempCanvas.toDataURL()).then((img) => {
      img.set({
        left: 0,
        top: 0,
        selectable: false,
        evented: false,
      });
      canvas.backgroundImage = img;
      canvas.renderAll();
      
      // Restore saved state for this page
      const savedState = pageCanvasStates.get(currentPage);
      if (savedState) {
        canvas.loadFromJSON(JSON.parse(savedState)).then(() => {
          canvas.renderAll();
        });
      }
    });

    // Setup drawing brush
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = activeColor;
    canvas.freeDrawingBrush.width = brushSize;

    setFabricCanvas(canvas);
    
    // Initialize history
    setHistory([JSON.stringify(canvas.toJSON())]);
    setHistoryIndex(0);

    return () => {
      // Save state when unmounting
      const json = JSON.stringify(canvas.toJSON());
      setPageCanvasStates(prev => new Map(prev).set(currentPage, json));
    };
  }, [pdfPages, currentPage]);

  // Update tool mode
  useEffect(() => {
    if (!fabricCanvas) return;
    
    fabricCanvas.isDrawingMode = activeTool === 'draw';
    fabricCanvas.selection = activeTool === 'select';
    
    if (activeTool === 'draw' && fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = activeColor;
      fabricCanvas.freeDrawingBrush.width = brushSize;
    }
  }, [activeTool, activeColor, brushSize, fabricCanvas]);

  // Save state on object changes
  useEffect(() => {
    if (!fabricCanvas) return;

    const saveState = () => {
      const json = JSON.stringify(fabricCanvas.toJSON());
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(json);
        return newHistory.slice(-50); // Keep last 50 states
      });
      setHistoryIndex(prev => Math.min(prev + 1, 49));
    };

    fabricCanvas.on('object:added', saveState);
    fabricCanvas.on('object:modified', saveState);
    fabricCanvas.on('object:removed', saveState);

    return () => {
      fabricCanvas.off('object:added', saveState);
      fabricCanvas.off('object:modified', saveState);
      fabricCanvas.off('object:removed', saveState);
    };
  }, [fabricCanvas, historyIndex]);

  const handleToolClick = (tool: Tool) => {
    if (!fabricCanvas) return;
    
    setActiveTool(tool);

    if (tool === 'rectangle') {
      const rect = new Rect({
        left: fabricCanvas.width! / 2 - 50,
        top: fabricCanvas.height! / 2 - 50,
        fill: 'transparent',
        stroke: activeColor,
        strokeWidth: 2,
        width: 100,
        height: 100,
      });
      fabricCanvas.add(rect);
      fabricCanvas.setActiveObject(rect);
      setActiveTool('select');
    } else if (tool === 'circle') {
      const circle = new FabricCircle({
        left: fabricCanvas.width! / 2 - 40,
        top: fabricCanvas.height! / 2 - 40,
        fill: 'transparent',
        stroke: activeColor,
        strokeWidth: 2,
        radius: 40,
      });
      fabricCanvas.add(circle);
      fabricCanvas.setActiveObject(circle);
      setActiveTool('select');
    } else if (tool === 'text') {
      const text = new IText('Click to edit', {
        left: fabricCanvas.width! / 2 - 60,
        top: fabricCanvas.height! / 2 - 15,
        fill: activeColor,
        fontSize: fontSize,
        fontFamily: 'Arial',
      });
      fabricCanvas.add(text);
      fabricCanvas.setActiveObject(text);
      text.enterEditing();
      setActiveTool('select');
    } else if (tool === 'image') {
      fileInputRef.current?.click();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricCanvas) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      FabricImage.fromURL(event.target?.result as string).then((img) => {
        // Scale image to fit within canvas
        const maxSize = Math.min(fabricCanvas.width!, fabricCanvas.height!) * 0.5;
        const scale = Math.min(maxSize / (img.width || 1), maxSize / (img.height || 1), 1);
        
        img.scale(scale);
        img.set({
          left: (fabricCanvas.width! - (img.width || 0) * scale) / 2,
          top: (fabricCanvas.height! - (img.height || 0) * scale) / 2,
        });
        
        fabricCanvas.add(img);
        fabricCanvas.setActiveObject(img);
        fabricCanvas.renderAll();
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
    setActiveTool('select');
  };

  const deleteSelected = () => {
    if (!fabricCanvas) return;
    const active = fabricCanvas.getActiveObjects();
    if (active.length > 0) {
      active.forEach(obj => fabricCanvas.remove(obj));
      fabricCanvas.discardActiveObject();
      fabricCanvas.renderAll();
    }
  };

  const undo = () => {
    if (!fabricCanvas || historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    fabricCanvas.loadFromJSON(JSON.parse(history[newIndex])).then(() => {
      fabricCanvas.renderAll();
      setHistoryIndex(newIndex);
    });
  };

  const redo = () => {
    if (!fabricCanvas || historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    fabricCanvas.loadFromJSON(JSON.parse(history[newIndex])).then(() => {
      fabricCanvas.renderAll();
      setHistoryIndex(newIndex);
    });
  };

  const changePage = (delta: number) => {
    if (!fabricCanvas) return;
    
    // Save current page state
    const json = JSON.stringify(fabricCanvas.toJSON());
    setPageCanvasStates(prev => new Map(prev).set(currentPage, json));
    
    setCurrentPage(prev => Math.max(0, Math.min(totalPages - 1, prev + delta)));
  };

  const savePdf = async () => {
    if (!fabricCanvas || pdfPages.length === 0 || !files[0]) return;
    
    setIsProcessing(true);
    setProgress(10);
    
    try {
      // Save current page state
      const currentState = JSON.stringify(fabricCanvas.toJSON());
      const allStates = new Map(pageCanvasStates);
      allStates.set(currentPage, currentState);

      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      
      for (let i = 0; i < pdfPages.length; i++) {
        const pageData = pdfPages[i];
        const savedState = allStates.get(i);
        
        // Create a temporary canvas to render annotations
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = pageData.width;
        tempCanvas.height = pageData.height;
        
        const tempFabric = new FabricCanvas(tempCanvas, {
          width: pageData.width,
          height: pageData.height,
        });
        
        if (savedState) {
          await tempFabric.loadFromJSON(JSON.parse(savedState));
          tempFabric.renderAll();
        }
        
        // Get objects (annotations) only
        const objects = tempFabric.getObjects();
        if (objects.length > 0) {
          // Render annotations to an image
          const annotationDataUrl = tempFabric.toDataURL({
            format: 'png',
            multiplier: 1,
          });
          
          const annotationBytes = await fetch(annotationDataUrl).then(r => r.arrayBuffer());
          const annotationImage = await pdfDoc.embedPng(annotationBytes);
          
          const page = pages[i];
          const { width, height } = page.getSize();
          const scaleX = width / pageData.width;
          const scaleY = height / pageData.height;
          
          page.drawImage(annotationImage, {
            x: 0,
            y: 0,
            width: width,
            height: height,
          });
        }
        
        tempFabric.dispose();
        setProgress(10 + ((i + 1) / pdfPages.length) * 80);
      }
      
      const pdfBytes = await pdfDoc.save();
      downloadBlob(new Uint8Array(pdfBytes), files[0].file.name.replace('.pdf', '-edited.pdf'));
      
      setProgress(100);
      toast.success('PDF saved with annotations!');
    } catch (error) {
      console.error('Error saving PDF:', error);
      toast.error('Failed to save PDF');
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFiles([]);
    setPdfPages([]);
    setPageCanvasStates(new Map());
    setCurrentPage(0);
    setTotalPages(0);
    if (fabricCanvas) {
      fabricCanvas.dispose();
      setFabricCanvas(null);
    }
  };

  return (
    <ToolLayout
      title="Edit PDF"
      description="Add text, images, and shapes to your PDF"
      icon={PenTool}
      category="Edit PDF"
      categoryColor="edit"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      <div className="max-w-6xl mx-auto space-y-4">
        {files.length === 0 ? (
          <FileDropZone
            accept={['.pdf']}
            multiple={false}
            maxFiles={1}
            files={files}
            onFilesChange={setFiles}
            hideFileList
          />
        ) : pdfPages.length === 0 ? (
          <div className="text-center py-12">
            <ProgressBar progress={progress} />
            <p className="mt-4 text-muted-foreground">Loading PDF...</p>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-center gap-1 border-r pr-2 mr-2">
                <Button
                  variant={activeTool === 'select' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveTool('select')}
                  title="Select"
                >
                  <MousePointer className="h-4 w-4" />
                </Button>
                <Button
                  variant={activeTool === 'draw' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleToolClick('draw')}
                  title="Draw"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToolClick('text')}
                  title="Add Text"
                >
                  <Type className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToolClick('rectangle')}
                  title="Add Rectangle"
                >
                  <Square className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToolClick('circle')}
                  title="Add Circle"
                >
                  <Circle className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToolClick('image')}
                  title="Add Image"
                >
                  <Image className="h-4 w-4" />
                </Button>
              </div>

              {/* Color picker */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2">
                    <div 
                      className="w-5 h-5 rounded border" 
                      style={{ backgroundColor: activeColor }}
                    />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2">
                  <div className="grid grid-cols-5 gap-1">
                    {COLORS.map(color => (
                      <button
                        key={color}
                        className={`w-6 h-6 rounded border-2 ${activeColor === color ? 'border-primary' : 'border-transparent'}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setActiveColor(color)}
                      />
                    ))}
                  </div>
                  <Input
                    type="color"
                    value={activeColor}
                    onChange={(e) => setActiveColor(e.target.value)}
                    className="mt-2 h-8 w-full"
                  />
                </PopoverContent>
              </Popover>

              {/* Brush size */}
              {activeTool === 'draw' && (
                <div className="flex items-center gap-2 px-2">
                  <Minus className="h-3 w-3 text-muted-foreground" />
                  <Slider
                    value={[brushSize]}
                    onValueChange={([v]) => setBrushSize(v)}
                    min={1}
                    max={20}
                    step={1}
                    className="w-20"
                  />
                  <Plus className="h-3 w-3 text-muted-foreground" />
                </div>
              )}

              {/* Zoom controls */}
              <div className="flex items-center gap-1 border-l pl-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setZoomLevel(z => Math.max(0.25, z - 0.25))}
                  disabled={zoomLevel <= 0.25}
                  title="Zoom Out"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs w-12 text-center font-medium">
                  {Math.round(zoomLevel * 100)}%
                </span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setZoomLevel(z => Math.min(3, z + 0.25))}
                  disabled={zoomLevel >= 3}
                  title="Zoom In"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-1 border-l pl-2 ml-auto">
                <Button variant="ghost" size="sm" onClick={undo} disabled={historyIndex <= 0}>
                  <Undo className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1}>
                  <Redo className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={deleteSelected}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Canvas container */}
            <div 
              ref={containerRef}
              className="relative bg-muted/30 rounded-lg border overflow-auto max-h-[600px] flex justify-center p-4"
            >
              <div style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}>
                <canvas ref={canvasRef} className="shadow-lg" />
              </div>
            </div>

            {/* Page navigation */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => changePage(-1)}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm">
                Page {currentPage + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => changePage(1)}
                disabled={currentPage >= totalPages - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button variant="outline" onClick={reset} className="flex-1">
                Start Over
              </Button>
              <Button onClick={savePdf} disabled={isProcessing} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                {isProcessing ? 'Saving...' : 'Save PDF'}
              </Button>
            </div>

            {isProcessing && <ProgressBar progress={progress} />}
          </>
        )}
      </div>
    </ToolLayout>
  );
};

export default EditPdf;
