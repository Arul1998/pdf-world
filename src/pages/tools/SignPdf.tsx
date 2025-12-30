import { useState, useRef, useEffect, useCallback } from 'react';
import { PenLine, Download, Loader2, Type, Pencil, Trash2, RotateCcw, Upload, ChevronLeft, ChevronRight, Move, Copy } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { signPdfWithCoordinates, downloadBlob, renderPdfPages, type PDFFile, type SignaturePlacement } from '@/lib/pdf-tools';
import { cn } from '@/lib/utils';

const SIGNATURE_COLORS = [
  { id: 'black', name: 'Black', value: '#1a1a1a' },
  { id: 'blue', name: 'Blue', value: '#1e40af' },
  { id: 'navy', name: 'Navy', value: '#1e3a5f' },
  { id: 'red', name: 'Red', value: '#b91c1c' },
];

const SIGNATURE_THICKNESS = [
  { id: 'thin', name: 'Thin', value: 1.5 },
  { id: 'medium', name: 'Medium', value: 2.5 },
  { id: 'thick', name: 'Thick', value: 4 },
];

const SIGNATURE_FONTS = [
  { id: 'cursive', name: 'Cursive', fontFamily: "'Dancing Script', cursive" },
  { id: 'elegant', name: 'Elegant', fontFamily: "'Great Vibes', cursive" },
  { id: 'handwritten', name: 'Handwritten', fontFamily: "'Caveat', cursive" },
  { id: 'formal', name: 'Formal', fontFamily: "'Allura', cursive" },
];

interface PagePreview {
  dataUrl: string;
  width: number;
  height: number;
}

interface SignatureOnPage {
  id: string;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  dataUrl: string;
}

type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se' | null;

const SignPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type' | 'upload'>('draw');
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState('cursive');
  const [selectedColor, setSelectedColor] = useState('black');
  const [selectedThickness, setSelectedThickness] = useState('medium');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pagesPreviews, setPagesPreviews] = useState<PagePreview[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoadingPages, setIsLoadingPages] = useState(false);
  const [signatures, setSignatures] = useState<SignatureOnPage[]>([]);
  const [activeSignatureId, setActiveSignatureId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeCorner, setResizeCorner] = useState<ResizeCorner>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0, mouseX: 0, mouseY: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  const getCurrentColor = () => SIGNATURE_COLORS.find(c => c.id === selectedColor)?.value || '#1a1a1a';
  const getCurrentThickness = () => SIGNATURE_THICKNESS.find(t => t.id === selectedThickness)?.value || 2.5;

  useEffect(() => {
    const loadPreviews = async () => {
      if (files.length === 0) { setPagesPreviews([]); return; }
      setIsLoadingPages(true);
      try {
        const previews = await renderPdfPages(files[0].file, 1.5);
        setPagesPreviews(previews);
        setCurrentPageIndex(0);
      } catch (error) {
        toast.error('Failed to load PDF preview');
      } finally { setIsLoadingPages(false); }
    };
    loadPreviews();
  }, [files]);

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const rect = container.getBoundingClientRect();
    const width = rect.width || 400;
    const height = 128;
    canvas.width = width * 2;
    canvas.height = height * 2;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.scale(2, 2);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }, []);

  useEffect(() => {
    if (signatureMode === 'draw' && files.length > 0) {
      const timer = setTimeout(initCanvas, 100);
      return () => clearTimeout(timer);
    }
  }, [signatureMode, files.length, initCanvas]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width / 2;
    const scaleY = canvas.height / rect.height / 2;
    if ('touches' in e) {
      return { x: (e.touches[0].clientX - rect.left) * scaleX, y: (e.touches[0].clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.strokeStyle = getCurrentColor();
    context.lineWidth = getCurrentThickness();
    context.lineCap = 'round';
    context.lineJoin = 'round';
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    context.beginPath();
    context.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    if ('touches' in e) e.preventDefault();
    const { x, y } = getCoordinates(e);
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) { setIsDrawing(false); saveSignature(); }
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSignatureDataUrl(canvas.toDataURL('image/png'));
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    setSignatureDataUrl(null);
  };

  const generateTypedSignature = useCallback(() => {
    if (!typedName.trim()) { setSignatureDataUrl(null); return; }
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const font = SIGNATURE_FONTS.find(f => f.id === selectedFont);
    ctx.font = `48px ${font?.fontFamily || "'Dancing Script', cursive"}`;
    ctx.fillStyle = getCurrentColor();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);
    setSignatureDataUrl(canvas.toDataURL('image/png'));
  }, [typedName, selectedFont, selectedColor]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) { toast.error('Please upload an image file'); return; }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width, height = img.height;
        if (width > 400) { height = (height * 400) / width; width = 400; }
        if (height > 150) { width = (width * 150) / height; height = 150; }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, width, height);
        setSignatureDataUrl(canvas.toDataURL('image/png'));
        toast.success('Signature image uploaded');
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (signatureMode === 'type') generateTypedSignature();
  }, [typedName, selectedFont, signatureMode, selectedColor, generateTypedSignature]);

  const handlePageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!signatureDataUrl || !previewContainerRef.current || isDragging || isResizing) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const sigWidth = 25, sigHeight = 8;
    const newSignature: SignatureOnPage = {
      id: `sig-${Date.now()}`,
      pageIndex: currentPageIndex,
      x: Math.max(0, Math.min(100 - sigWidth, x - sigWidth / 2)),
      y: Math.max(0, Math.min(100 - sigHeight, y - sigHeight / 2)),
      width: sigWidth, 
      height: sigHeight,
      dataUrl: signatureDataUrl,
    };
    setSignatures(prev => [...prev, newSignature]);
    setActiveSignatureId(newSignature.id);
  };

  const handleSignatureDragStart = (e: React.MouseEvent<HTMLDivElement>, sigId: string) => {
    e.stopPropagation();
    if (!previewContainerRef.current) return;
    const sigElement = e.currentTarget;
    const sigRect = sigElement.getBoundingClientRect();
    setDragOffset({ x: e.clientX - sigRect.left, y: e.clientY - sigRect.top });
    setIsDragging(true);
    setActiveSignatureId(sigId);
  };

  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>, sigId: string, corner: ResizeCorner) => {
    e.stopPropagation();
    const sig = signatures.find(s => s.id === sigId);
    if (!sig || !previewContainerRef.current) return;
    setResizeStart({ x: sig.x, y: sig.y, width: sig.width, height: sig.height, mouseX: e.clientX, mouseY: e.clientY });
    setResizeCorner(corner);
    setIsResizing(true);
    setActiveSignatureId(sigId);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();

    if (isDragging && activeSignatureId) {
      const x = ((e.clientX - rect.left - dragOffset.x) / rect.width) * 100;
      const y = ((e.clientY - rect.top - dragOffset.y) / rect.height) * 100;
      setSignatures(prev => prev.map(sig => 
        sig.id === activeSignatureId ? {
          ...sig,
          pageIndex: currentPageIndex,
          x: Math.max(0, Math.min(100 - sig.width, x)),
          y: Math.max(0, Math.min(100 - sig.height, y)),
        } : sig
      ));
    }

    if (isResizing && activeSignatureId && resizeCorner) {
      const deltaX = ((e.clientX - resizeStart.mouseX) / rect.width) * 100;
      const deltaY = ((e.clientY - resizeStart.mouseY) / rect.height) * 100;
      const minSize = 5;

      setSignatures(prev => prev.map(sig => {
        if (sig.id !== activeSignatureId) return sig;
        let newX = sig.x, newY = sig.y, newWidth = sig.width, newHeight = sig.height;

        if (resizeCorner === 'se') {
          newWidth = Math.max(minSize, resizeStart.width + deltaX);
          newHeight = Math.max(minSize, resizeStart.height + deltaY);
        } else if (resizeCorner === 'sw') {
          const widthChange = -deltaX;
          newWidth = Math.max(minSize, resizeStart.width + widthChange);
          newX = resizeStart.x - (newWidth - resizeStart.width);
          newHeight = Math.max(minSize, resizeStart.height + deltaY);
        } else if (resizeCorner === 'ne') {
          newWidth = Math.max(minSize, resizeStart.width + deltaX);
          const heightChange = -deltaY;
          newHeight = Math.max(minSize, resizeStart.height + heightChange);
          newY = resizeStart.y - (newHeight - resizeStart.height);
        } else if (resizeCorner === 'nw') {
          const widthChange = -deltaX;
          const heightChange = -deltaY;
          newWidth = Math.max(minSize, resizeStart.width + widthChange);
          newHeight = Math.max(minSize, resizeStart.height + heightChange);
          newX = resizeStart.x - (newWidth - resizeStart.width);
          newY = resizeStart.y - (newHeight - resizeStart.height);
        }

        newX = Math.max(0, Math.min(100 - newWidth, newX));
        newY = Math.max(0, Math.min(100 - newHeight, newY));
        newWidth = Math.min(newWidth, 100 - newX);
        newHeight = Math.min(newHeight, 100 - newY);

        return { ...sig, x: newX, y: newY, width: newWidth, height: newHeight };
      }));
    }
  };

  const handleMouseUp = () => { setIsDragging(false); setIsResizing(false); setResizeCorner(null); };

  const deleteSignature = (sigId: string) => {
    setSignatures(prev => prev.filter(s => s.id !== sigId));
    if (activeSignatureId === sigId) setActiveSignatureId(null);
  };

  const duplicateSignature = (sigId: string) => {
    const sig = signatures.find(s => s.id === sigId);
    if (!sig) return;
    const newSig: SignatureOnPage = {
      ...sig,
      id: `sig-${Date.now()}`,
      x: Math.min(sig.x + 5, 100 - sig.width),
      y: Math.min(sig.y + 5, 100 - sig.height),
    };
    setSignatures(prev => [...prev, newSig]);
    setActiveSignatureId(newSig.id);
  };

  const handleSign = async () => {
    if (files.length === 0) { toast.error('Please upload a PDF file'); return; }
    if (signatures.length === 0) { toast.error('Please place at least one signature on the document'); return; }
    setIsProcessing(true);
    setProgress(0);
    try {
      const placements: SignaturePlacement[] = signatures.map(sig => ({
        pageIndex: sig.pageIndex,
        x: sig.x,
        y: sig.y,
        width: sig.width,
        height: sig.height,
        dataUrl: sig.dataUrl,
      }));
      const result = await signPdfWithCoordinates(files[0].file, signatures[0].dataUrl, placements, (current, total) => setProgress((current / total) * 100));
      downloadBlob(result, files[0].name.replace('.pdf', '_signed.pdf'));
      toast.success('PDF signed successfully!');
    } catch (error) { toast.error('Failed to sign PDF'); } finally { setIsProcessing(false); setProgress(0); }
  };

  const resetAll = () => { setFiles([]); setSignatureDataUrl(null); setSignatures([]); setActiveSignatureId(null); setPagesPreviews([]); setCurrentPageIndex(0); };

  return (
    <ToolLayout title="Sign PDF" description="Add your signature to PDF documents" icon={PenLine} category="security" categoryColor="security">
      <link href="https://fonts.googleapis.com/css2?family=Allura&family=Caveat&family=Dancing+Script&family=Great+Vibes&display=swap" rel="stylesheet" />
      <div className="space-y-6">
        {files.length === 0 ? (
          <FileDropZone accept={['.pdf']} multiple={false} files={files} onFilesChange={setFiles} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">PDF Preview</Label>
                <Button variant="ghost" size="sm" onClick={resetAll}><Trash2 className="h-4 w-4 mr-1" />New File</Button>
              </div>
              {isLoadingPages ? (
                <div className="aspect-[3/4] bg-muted/50 rounded-lg flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : pagesPreviews.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Button variant="outline" size="sm" disabled={currentPageIndex === 0} onClick={() => setCurrentPageIndex(i => i - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                    <span className="text-sm text-muted-foreground">Page {currentPageIndex + 1} of {pagesPreviews.length}</span>
                    <Button variant="outline" size="sm" disabled={currentPageIndex === pagesPreviews.length - 1} onClick={() => setCurrentPageIndex(i => i + 1)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                  <div ref={previewContainerRef} className="relative bg-white rounded-lg shadow-lg overflow-hidden cursor-crosshair border" onClick={handlePageClick} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
                    <img src={pagesPreviews[currentPageIndex]?.dataUrl} alt={`Page ${currentPageIndex + 1}`} className="w-full h-auto" draggable={false} />
                    {signatures.filter(sig => sig.pageIndex === currentPageIndex).map((sig) => (
                      <div 
                        key={sig.id}
                        className={cn(
                          "absolute cursor-move border-2 rounded bg-white/80 shadow-lg transition-shadow",
                          activeSignatureId === sig.id ? "border-primary shadow-xl z-10" : "border-primary/50 hover:shadow-xl"
                        )}
                        style={{ left: `${sig.x}%`, top: `${sig.y}%`, width: `${sig.width}%`, height: `${sig.height}%` }}
                        onMouseDown={(e) => handleSignatureDragStart(e, sig.id)}
                        onClick={(e) => { e.stopPropagation(); setActiveSignatureId(sig.id); }}
                      >
                        <img src={sig.dataUrl} alt="Signature" className="w-full h-full object-contain" draggable={false} />
                        <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1"><Move className="h-3 w-3" /></div>
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-1">
                          <button 
                            className="bg-primary text-primary-foreground rounded-full p-1 hover:scale-110 transition-transform"
                            onClick={(e) => { e.stopPropagation(); duplicateSignature(sig.id); }}
                            title="Duplicate"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button 
                            className="bg-destructive text-destructive-foreground rounded-full p-1 hover:scale-110 transition-transform"
                            onClick={(e) => { e.stopPropagation(); deleteSignature(sig.id); }}
                            title="Delete"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        {/* Resize handles */}
                        <div className="absolute -top-1 -left-1 w-3 h-3 bg-primary rounded-full cursor-nw-resize hover:scale-125 transition-transform" onMouseDown={(e) => handleResizeStart(e, sig.id, 'nw')} />
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full cursor-ne-resize hover:scale-125 transition-transform" onMouseDown={(e) => handleResizeStart(e, sig.id, 'ne')} />
                        <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-primary rounded-full cursor-sw-resize hover:scale-125 transition-transform" onMouseDown={(e) => handleResizeStart(e, sig.id, 'sw')} />
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-primary rounded-full cursor-se-resize hover:scale-125 transition-transform" onMouseDown={(e) => handleResizeStart(e, sig.id, 'se')} />
                      </div>
                    ))}
                    {signatureDataUrl && signatures.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/10 pointer-events-none"><div className="bg-background/90 px-4 py-2 rounded-lg shadow text-sm font-medium">Click to place signature</div></div>
                    )}
                  </div>
                  {signatures.length > 0 && <p className="text-xs text-muted-foreground text-center">Drag to move • Corners to resize • {signatures.length} signature{signatures.length > 1 ? 's' : ''} placed</p>}
                </div>
              )}
            </div>
            <div className="space-y-6">
              <div className="space-y-4">
                <Label className="text-base font-semibold">Create Your Signature</Label>
                <Tabs value={signatureMode} onValueChange={(v) => { setSignatureMode(v as 'draw' | 'type' | 'upload'); setSignatureDataUrl(null); if (v === 'draw') setTimeout(initCanvas, 100); }}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="draw" className="gap-2"><Pencil className="h-4 w-4" />Draw</TabsTrigger>
                    <TabsTrigger value="type" className="gap-2"><Type className="h-4 w-4" />Type</TabsTrigger>
                    <TabsTrigger value="upload" className="gap-2"><Upload className="h-4 w-4" />Upload</TabsTrigger>
                  </TabsList>
                  <TabsContent value="draw" className="space-y-4">
                    <div className="flex flex-wrap gap-4 items-center">
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground">Color:</Label>
                        <div className="flex gap-1.5">
                          {SIGNATURE_COLORS.map((color) => (<button key={color.id} onClick={() => setSelectedColor(color.id)} className={cn("w-7 h-7 rounded-full border-2 transition-all", selectedColor === color.id ? "border-primary ring-2 ring-primary/30 scale-110" : "border-muted-foreground/20 hover:scale-105")} style={{ backgroundColor: color.value }} title={color.name} />))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground">Thickness:</Label>
                        <div className="flex gap-1.5">
                          {SIGNATURE_THICKNESS.map((thickness) => (<button key={thickness.id} onClick={() => setSelectedThickness(thickness.id)} className={cn("w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all", selectedThickness === thickness.id ? "border-primary bg-primary/10" : "border-muted hover:border-muted-foreground/30")} title={thickness.name}><div className="rounded-full" style={{ width: `${thickness.value * 3}px`, height: `${thickness.value * 3}px`, backgroundColor: getCurrentColor() }} /></button>))}
                        </div>
                      </div>
                    </div>
                    <div ref={containerRef} className="relative">
                      <canvas ref={canvasRef} className="w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white touch-none" style={{ cursor: 'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%231a1a1a%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M12 20h9%27/%3E%3Cpath d=%27M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z%27/%3E%3C/svg%3E") 0 24, crosshair' }} onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing} onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing} />
                      <Button variant="ghost" size="sm" className="absolute top-2 right-2" onClick={clearCanvas}><RotateCcw className="h-4 w-4 mr-1" />Clear</Button>
                    </div>
                    <p className="text-sm text-muted-foreground text-center">Draw your signature in the box above</p>
                  </TabsContent>
                  <TabsContent value="type" className="space-y-4">
                    <div className="space-y-3">
                      <Input placeholder="Type your name..." value={typedName} onChange={(e) => setTypedName(e.target.value)} className="text-lg" />
                      <div className="flex items-center gap-2">
                        <Label className="text-sm text-muted-foreground">Color:</Label>
                        <div className="flex gap-1.5">
                          {SIGNATURE_COLORS.map((color) => (<button key={color.id} onClick={() => setSelectedColor(color.id)} className={cn("w-7 h-7 rounded-full border-2 transition-all", selectedColor === color.id ? "border-primary ring-2 ring-primary/30 scale-110" : "border-muted-foreground/20 hover:scale-105")} style={{ backgroundColor: color.value }} title={color.name} />))}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Font Style</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {SIGNATURE_FONTS.map((font) => (<button key={font.id} onClick={() => setSelectedFont(font.id)} className={cn("p-3 rounded-lg border-2 transition-all text-left", selectedFont === font.id ? "border-primary bg-primary/5" : "border-muted hover:border-muted-foreground/30")}><span className="text-xl" style={{ fontFamily: font.fontFamily, color: getCurrentColor() }}>{typedName || 'Your Name'}</span><p className="text-xs text-muted-foreground mt-1">{font.name}</p></button>))}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                  <TabsContent value="upload" className="space-y-4">
                    <input ref={uploadInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    <div onClick={() => uploadInputRef.current?.click()} className="border-2 border-dashed border-muted-foreground/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all">
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="font-medium">Click to upload signature image</p>
                      <p className="text-sm text-muted-foreground mt-1">PNG, JPG or GIF (transparent background recommended)</p>
                    </div>
                    {signatureDataUrl && signatureMode === 'upload' && (<Button variant="outline" size="sm" onClick={() => { setSignatureDataUrl(null); if (uploadInputRef.current) uploadInputRef.current.value = ''; }} className="w-full"><Trash2 className="h-4 w-4 mr-2" />Remove Image</Button>)}
                  </TabsContent>
                </Tabs>
                {signatureDataUrl && (<div className="space-y-2"><Label className="text-sm">Your Signature</Label><div className="p-4 border rounded-lg bg-white flex justify-center"><img src={signatureDataUrl} alt="Signature preview" className="max-h-16 object-contain" /></div></div>)}
              </div>
              <Button onClick={handleSign} disabled={isProcessing || signatures.length === 0} className="w-full" size="lg">
                {isProcessing ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" />Signing... {Math.round(progress)}%</>) : (<><Download className="h-4 w-4 mr-2" />Download Signed PDF</>)}
              </Button>
              {signatures.length === 0 && signatureDataUrl && (<p className="text-sm text-muted-foreground text-center">Click on the PDF preview to place your signature</p>)}
            </div>
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default SignPdf;
