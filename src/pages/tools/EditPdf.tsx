import { useState, useEffect, useRef, useCallback } from 'react';
import { PenTool, Download, Type, Square, Circle, Image, Pencil, MousePointer, ChevronLeft, ChevronRight, Trash2, Undo, Redo, Minus, Plus, ZoomIn, ZoomOut, RefreshCw, ArrowRight, Minus as LineIcon, Highlighter, Bold, Italic, Underline, Strikethrough } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { downloadBlob, type PDFFile } from '@/lib/pdf-tools';
import { Canvas as FabricCanvas, Rect, Circle as FabricCircle, IText, Image as FabricImage, FabricObject, PencilBrush, Line, Polygon } from 'fabric';
import * as pdfjsLib from 'pdfjs-dist/webpack.mjs';
import { PDFDocument, rgb } from 'pdf-lib';


type Tool = 'select' | 'draw' | 'text' | 'rectangle' | 'circle' | 'image' | 'line' | 'arrow' | 'highlight';

const COLORS = [
  '#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', 
  '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'
];

const EditPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentPageRender, setCurrentPageRender] = useState<
    { canvas: HTMLCanvasElement; width: number; height: number } | null
  >(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pdfReady, setPdfReady] = useState(false);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [activeColor, setActiveColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [fontSize, setFontSize] = useState(24);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [selectedTextObject, setSelectedTextObject] = useState<IText | null>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [pageCanvasStates, setPageCanvasStates] = useState<Map<number, string>>(new Map());
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderedPagesRef = useRef<Map<number, { canvas: HTMLCanvasElement; width: number; height: number }>>(new Map());
  const fabricCanvasRef = useRef<FabricCanvas | null>(null);
  const isInitializingRef = useRef(false);

  // Handle replacing the PDF file
  const handleReplacePdf = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Please select a PDF file');
      return;
    }

    // Clear existing state
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.clear();
    }
    setPageCanvasStates(new Map());
    setHistory([]);
    setHistoryIndex(-1);
    renderedPagesRef.current = new Map();
    pdfDocRef.current = null;
    setCurrentPageRender(null);
    setPdfReady(false);
    
    // Set new file
    const newFile: PDFFile = { 
      id: Math.random().toString(36).substring(2, 9),
      name: file.name,
      file, 
      pageCount: 0,
      size: file.size 
    };
    setFiles([newFile]);
    
    // Reset the input so the same file can be selected again
    e.target.value = '';
    
    toast.success('PDF replaced. Annotations cleared.');
  }, []);

  // Load PDF metadata only (fast)
  const loadPdfMetadata = useCallback(async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProgress(20);

    try {
      const arrayBuffer = await files[0].file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      pdfDocRef.current = pdf;
      setTotalPages(pdf.numPages);
      setCurrentPage(0);
      setCurrentPageRender(null);
      setPageCanvasStates(new Map());
      renderedPagesRef.current = new Map();
      setPdfReady(true);
      setProgress(100);
    } catch (error) {
      console.error('Error loading PDF:', error);
      const message = error instanceof Error ? error.message : 'Failed to load PDF';
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  }, [files]);

  // Render a single page on-demand (cached in a ref to avoid re-render churn)
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDocRef.current) return null;

    const cached = renderedPagesRef.current.get(pageNum);
    if (cached) return cached;

    try {
      const page = await pdfDocRef.current.getPage(pageNum + 1); // 1-indexed

      // Render at a target width to keep initial load snappy on large PDFs
      const baseViewport = page.getViewport({ scale: 1 });
      const containerWidth = containerRef.current?.clientWidth ?? 1200;
      const targetWidth = Math.max(320, Math.min(1200, containerWidth - 64));
      const scale = Math.min(2, Math.max(0.75, targetWidth / baseViewport.width));

      const viewport = page.getViewport({ scale });

      const offscreen = document.createElement('canvas');
      offscreen.width = Math.floor(viewport.width);
      offscreen.height = Math.floor(viewport.height);

      const ctx = offscreen.getContext('2d', { alpha: false })!;

      await page.render({ canvasContext: ctx, viewport, canvas: offscreen }).promise;

      const rendered = { canvas: offscreen, width: offscreen.width, height: offscreen.height };
      renderedPagesRef.current.set(pageNum, rendered);
      return rendered;
    } catch (error) {
      console.error('Error rendering page:', error);
      return null;
    }
  }, []);

  // Load current page when it changes
  useEffect(() => {
    if (!pdfReady) return;

    const loadCurrentPage = async () => {
      setIsProcessing(true);
      const pageRender = await renderPage(currentPage);
      setCurrentPageRender(pageRender);
      setIsProcessing(false);

      // Prefetch adjacent pages opportunistically for faster navigation
      const prefetch = () => {
        if (currentPage + 1 < totalPages) void renderPage(currentPage + 1);
        if (currentPage - 1 >= 0) void renderPage(currentPage - 1);
      };

      const ric = (window as any).requestIdleCallback as
        | ((cb: () => void, opts?: { timeout?: number }) => void)
        | undefined;

      if (ric) {
        ric(prefetch, { timeout: 500 });
      } else {
        setTimeout(prefetch, 0);
      }
    };

    loadCurrentPage();
  }, [currentPage, pdfReady, renderPage, totalPages]);

  useEffect(() => {
    if (files.length > 0) {
      loadPdfMetadata();
    } else {
      setCurrentPageRender(null);
      setTotalPages(0);
      setPageCanvasStates(new Map());
      renderedPagesRef.current = new Map();
      setPdfReady(false);
    }
  }, [files, loadPdfMetadata]);

  // Initialize Fabric canvas
  useEffect(() => {
    if (!canvasRef.current || !currentPageRender) return;

    // Prevent double initialization in React strict mode
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    const pageRender = currentPageRender;

    // Dispose existing canvas using ref
    if (fabricCanvasRef.current) {
      try {
        const json = JSON.stringify(fabricCanvasRef.current.toJSON());
        setPageCanvasStates(prev => new Map(prev).set(currentPage, json));
        fabricCanvasRef.current.dispose();
      } catch (e) {
        console.warn('Canvas dispose warning:', e);
      }
      fabricCanvasRef.current = null;
      setFabricCanvas(null);
    }

    const canvas = new FabricCanvas(canvasRef.current, {
      width: pageRender.width,
      height: pageRender.height,
      backgroundColor: '#ffffff',
      selectionColor: 'rgba(59, 130, 246, 0.15)',
      selectionBorderColor: '#3b82f6',
      selectionLineWidth: 1.5,
    });

    fabricCanvasRef.current = canvas;

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

    // Render PDF page as background (no toDataURL / ImageData copies)
    const bg = new FabricImage(pageRender.canvas, {
      left: 0,
      top: 0,
      selectable: false,
      evented: false,
    });
    canvas.backgroundImage = bg;
    canvas.renderAll();

    // Restore saved state for this page
    const savedState = pageCanvasStates.get(currentPage);
    if (savedState) {
      canvas.loadFromJSON(JSON.parse(savedState)).then(() => {
        canvas.renderAll();
      });
    }

    // Setup drawing brush
    canvas.freeDrawingBrush = new PencilBrush(canvas);
    canvas.freeDrawingBrush.color = activeColor;
    canvas.freeDrawingBrush.width = brushSize;

    setFabricCanvas(canvas);
    isInitializingRef.current = false;

    // Initialize history
    setHistory([JSON.stringify(canvas.toJSON())]);
    setHistoryIndex(0);

    return () => {
      // Save state and dispose on cleanup
      if (fabricCanvasRef.current) {
        try {
          const json = JSON.stringify(fabricCanvasRef.current.toJSON());
          setPageCanvasStates(prev => new Map(prev).set(currentPage, json));
          fabricCanvasRef.current.dispose();
        } catch (e) {
          console.warn('Canvas cleanup warning:', e);
        }
        fabricCanvasRef.current = null;
      }
      isInitializingRef.current = false;
    };
  }, [currentPageRender, currentPage]);

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

    // Track text object selection for formatting toolbar
    const handleSelection = () => {
      const activeObject = fabricCanvas.getActiveObject();
      if (activeObject && activeObject.type === 'i-text') {
        const textObj = activeObject as IText;
        setSelectedTextObject(textObj);
        setIsBold(textObj.fontWeight === 'bold');
        setIsItalic(textObj.fontStyle === 'italic');
        setIsUnderline(textObj.underline === true);
        setIsStrikethrough(textObj.linethrough === true);
        setFontSize(textObj.fontSize || 24);
        setFontFamily((textObj.fontFamily as string) || 'Arial');
      } else {
        setSelectedTextObject(null);
      }
    };

    const handleDeselection = () => {
      setSelectedTextObject(null);
    };

    fabricCanvas.on('selection:created', handleSelection);
    fabricCanvas.on('selection:updated', handleSelection);
    fabricCanvas.on('selection:cleared', handleDeselection);

    return () => {
      fabricCanvas.off('object:added', saveState);
      fabricCanvas.off('object:modified', saveState);
      fabricCanvas.off('object:removed', saveState);
      fabricCanvas.off('selection:created', handleSelection);
      fabricCanvas.off('selection:updated', handleSelection);
      fabricCanvas.off('selection:cleared', handleDeselection);
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
        fontFamily: fontFamily,
        fontWeight: isBold ? 'bold' : 'normal',
        fontStyle: isItalic ? 'italic' : 'normal',
      });
      fabricCanvas.add(text);
      fabricCanvas.setActiveObject(text);
      text.enterEditing();
      setActiveTool('select');
    } else if (tool === 'image') {
      fileInputRef.current?.click();
    } else if (tool === 'line') {
      const centerX = fabricCanvas.width! / 2;
      const centerY = fabricCanvas.height! / 2;
      const line = new Line([centerX - 50, centerY, centerX + 50, centerY], {
        stroke: activeColor,
        strokeWidth: 3,
        selectable: true,
      });
      fabricCanvas.add(line);
      fabricCanvas.setActiveObject(line);
      setActiveTool('select');
    } else if (tool === 'arrow') {
      const centerX = fabricCanvas.width! / 2;
      const centerY = fabricCanvas.height! / 2;
      const lineLength = 100;
      const arrowHeadSize = 15;
      
      // Create the line part
      const line = new Line([centerX - lineLength/2, centerY, centerX + lineLength/2 - arrowHeadSize, centerY], {
        stroke: activeColor,
        strokeWidth: 3,
      });
      
      // Create arrowhead as a triangle
      const arrowHead = new Polygon([
        { x: centerX + lineLength/2, y: centerY },
        { x: centerX + lineLength/2 - arrowHeadSize, y: centerY - arrowHeadSize/2 },
        { x: centerX + lineLength/2 - arrowHeadSize, y: centerY + arrowHeadSize/2 },
      ], {
        fill: activeColor,
        stroke: activeColor,
        strokeWidth: 1,
      });
      
      // Group them together by adding separately (fabric v6 approach)
      fabricCanvas.add(line);
      fabricCanvas.add(arrowHead);
      fabricCanvas.setActiveObject(arrowHead);
      setActiveTool('select');
    } else if (tool === 'highlight') {
      const highlight = new Rect({
        left: fabricCanvas.width! / 2 - 75,
        top: fabricCanvas.height! / 2 - 10,
        fill: activeColor === '#000000' ? 'rgba(255, 235, 59, 0.4)' : activeColor.replace(')', ', 0.4)').replace('rgb', 'rgba'),
        width: 150,
        height: 24,
        selectable: true,
        rx: 2,
        ry: 2,
      });
      // Apply semi-transparent fill for highlight effect
      const hexToRgba = (hex: string, alpha: number) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };
      highlight.set('fill', activeColor === '#000000' ? 'rgba(255, 235, 59, 0.4)' : hexToRgba(activeColor, 0.4));
      fabricCanvas.add(highlight);
      fabricCanvas.setActiveObject(highlight);
      setActiveTool('select');
    }
  };

  // Text formatting handlers
  const toggleBold = () => {
    const newBold = !isBold;
    setIsBold(newBold);
    if (selectedTextObject && fabricCanvas) {
      selectedTextObject.set('fontWeight', newBold ? 'bold' : 'normal');
      fabricCanvas.renderAll();
    }
  };

  const toggleItalic = () => {
    const newItalic = !isItalic;
    setIsItalic(newItalic);
    if (selectedTextObject && fabricCanvas) {
      selectedTextObject.set('fontStyle', newItalic ? 'italic' : 'normal');
      fabricCanvas.renderAll();
    }
  };

  const toggleUnderline = () => {
    const newUnderline = !isUnderline;
    setIsUnderline(newUnderline);
    if (selectedTextObject && fabricCanvas) {
      selectedTextObject.set('underline', newUnderline);
      fabricCanvas.renderAll();
    }
  };

  const toggleStrikethrough = () => {
    const newStrikethrough = !isStrikethrough;
    setIsStrikethrough(newStrikethrough);
    if (selectedTextObject && fabricCanvas) {
      selectedTextObject.set('linethrough', newStrikethrough);
      fabricCanvas.renderAll();
    }
  };

  const updateFontSize = (newSize: number) => {
    setFontSize(newSize);
    if (selectedTextObject && fabricCanvas) {
      selectedTextObject.set('fontSize', newSize);
      fabricCanvas.renderAll();
    }
  };

  const updateFontFamily = (newFamily: string) => {
    setFontFamily(newFamily);
    if (selectedTextObject && fabricCanvas) {
      selectedTextObject.set('fontFamily', newFamily);
      fabricCanvas.renderAll();
    }
  };

  const FONT_FAMILIES = [
    'Arial',
    'Helvetica',
    'Times New Roman',
    'Georgia',
    'Courier New',
    'Verdana',
    'Trebuchet MS',
    'Comic Sans MS',
    'Impact',
    'Lucida Console',
  ];

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
    if (!fabricCanvas || !pdfDocRef.current || !files[0]) return;
    
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
      
      for (let i = 0; i < totalPages; i++) {
        // Render page on-demand for saving
        const pageData = await renderPage(i);
        if (!pageData) continue;
        
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
          
          page.drawImage(annotationImage, {
            x: 0,
            y: 0,
            width: width,
            height: height,
          });
        }
        
        tempFabric.dispose();
        setProgress(10 + ((i + 1) / totalPages) * 80);
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
    setCurrentPageRender(null);
    renderedPagesRef.current = new Map();
    setPageCanvasStates(new Map());
    setCurrentPage(0);
    setTotalPages(0);
    setPdfReady(false);

    if (fabricCanvasRef.current) {
      try {
        fabricCanvasRef.current.dispose();
      } catch {
        // ignore
      }
      fabricCanvasRef.current = null;
    }
    setFabricCanvas(null);
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
      <input
        ref={replaceInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleReplacePdf}
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
            processPdfMetadata={false}
          />
        ) : !currentPageRender ? (
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
                  onClick={() => handleToolClick('line')}
                  title="Add Line"
                >
                  <LineIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToolClick('arrow')}
                  title="Add Arrow"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToolClick('highlight')}
                  title="Add Highlight"
                >
                  <Highlighter className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToolClick('image')}
                  title="Add Image"
                >
                  <Image className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => replaceInputRef.current?.click()}
                  title="Replace PDF"
                >
                  <RefreshCw className="h-4 w-4" />
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

              {/* Text formatting toolbar */}
              {selectedTextObject && (
                <div className="flex items-center gap-2 border-l pl-2">
                  <Select value={fontFamily} onValueChange={updateFontFamily}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="Font" />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_FAMILIES.map((font) => (
                        <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                          {font}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant={isBold ? 'default' : 'ghost'}
                    size="sm"
                    onClick={toggleBold}
                    title="Bold"
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={isItalic ? 'default' : 'ghost'}
                    size="sm"
                    onClick={toggleItalic}
                    title="Italic"
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={isUnderline ? 'default' : 'ghost'}
                    size="sm"
                    onClick={toggleUnderline}
                    title="Underline"
                  >
                    <Underline className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={isStrikethrough ? 'default' : 'ghost'}
                    size="sm"
                    onClick={toggleStrikethrough}
                    title="Strikethrough"
                  >
                    <Strikethrough className="h-4 w-4" />
                  </Button>
                  <div className="flex items-center gap-1 ml-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateFontSize(Math.max(8, fontSize - 2))}
                      disabled={fontSize <= 8}
                      title="Decrease font size"
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="text-xs w-8 text-center font-medium">{fontSize}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateFontSize(Math.min(120, fontSize + 2))}
                      disabled={fontSize >= 120}
                      title="Increase font size"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
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
