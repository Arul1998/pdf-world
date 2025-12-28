import { useState, useRef, useEffect } from 'react';
import { PenLine, Download, Loader2, Type, Pencil, Trash2, RotateCcw } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { signPdf, downloadBlob, type PDFFile } from '@/lib/pdf-tools';
import { cn } from '@/lib/utils';

type SignaturePosition = 'bottom-left' | 'bottom-center' | 'bottom-right' | 'top-left' | 'top-center' | 'top-right';

const SIGNATURE_FONTS = [
  { id: 'cursive', name: 'Cursive', fontFamily: "'Dancing Script', cursive" },
  { id: 'elegant', name: 'Elegant', fontFamily: "'Great Vibes', cursive" },
  { id: 'handwritten', name: 'Handwritten', fontFamily: "'Caveat', cursive" },
  { id: 'formal', name: 'Formal', fontFamily: "'Allura', cursive" },
];

const SignPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState('cursive');
  const [position, setPosition] = useState<SignaturePosition>('bottom-right');
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    canvas.style.width = `${canvas.offsetWidth}px`;
    canvas.style.height = `${canvas.offsetHeight}px`;

    const context = canvas.getContext('2d');
    if (!context) return;

    context.scale(2, 2);
    context.lineCap = 'round';
    context.strokeStyle = '#1a1a1a';
    context.lineWidth = 2;
    contextRef.current = context;
    
    // Fill with white background
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    setIsDrawing(true);
    
    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    context.beginPath();
    context.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if ('touches' in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    
    context.lineTo(x, y);
    context.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      saveSignature();
    }
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureDataUrl(dataUrl);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width / 2, canvas.height / 2);
    setSignatureDataUrl(null);
  };

  const generateTypedSignature = () => {
    if (!typedName.trim()) return;

    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const font = SIGNATURE_FONTS.find(f => f.id === selectedFont);
    ctx.font = `48px ${font?.fontFamily || "'Dancing Script', cursive"}`;
    ctx.fillStyle = '#1a1a1a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);

    setSignatureDataUrl(canvas.toDataURL('image/png'));
  };

  useEffect(() => {
    if (signatureMode === 'type') {
      generateTypedSignature();
    }
  }, [typedName, selectedFont, signatureMode]);

  const handleSign = async () => {
    if (files.length === 0) {
      toast.error('Please upload a PDF file');
      return;
    }

    if (!signatureDataUrl) {
      toast.error('Please create a signature first');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const result = await signPdf(
        files[0].file,
        signatureDataUrl,
        { position },
        (current, total) => setProgress((current / total) * 100)
      );

      const fileName = files[0].name.replace('.pdf', '_signed.pdf');
      downloadBlob(result, fileName);
      toast.success('PDF signed successfully!');
    } catch (error) {
      console.error('Sign error:', error);
      toast.error('Failed to sign PDF');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="Sign PDF"
      description="Add your signature to PDF documents"
      icon={PenLine}
      category="security"
      categoryColor="security"
    >
      {/* Google Fonts for signatures */}
      <link 
        href="https://fonts.googleapis.com/css2?family=Allura&family=Caveat&family=Dancing+Script&family=Great+Vibes&display=swap" 
        rel="stylesheet" 
      />
      
      <div className="space-y-6">
        {files.length === 0 ? (
          <FileDropZone
            accept={['.pdf']}
            multiple={false}
            files={files}
            onFilesChange={setFiles}
          />
        ) : (
          <div className="space-y-6">
            {/* File Info */}
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">{files[0].name}</p>
                <p className="text-sm text-muted-foreground">
                  {files[0].pageCount} pages
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setFiles([])}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {/* Signature Creation */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Create Your Signature</Label>
              
              <Tabs value={signatureMode} onValueChange={(v) => setSignatureMode(v as 'draw' | 'type')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="draw" className="gap-2">
                    <Pencil className="h-4 w-4" />
                    Draw
                  </TabsTrigger>
                  <TabsTrigger value="type" className="gap-2">
                    <Type className="h-4 w-4" />
                    Type
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="draw" className="space-y-4">
                  <div className="relative">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-32 border-2 border-dashed border-muted-foreground/30 rounded-lg cursor-crosshair bg-white touch-none"
                      onMouseDown={startDrawing}
                      onMouseMove={draw}
                      onMouseUp={stopDrawing}
                      onMouseLeave={stopDrawing}
                      onTouchStart={startDrawing}
                      onTouchMove={draw}
                      onTouchEnd={stopDrawing}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={clearCanvas}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      Clear
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    Draw your signature in the box above
                  </p>
                </TabsContent>

                <TabsContent value="type" className="space-y-4">
                  <div className="space-y-3">
                    <Input
                      placeholder="Type your name..."
                      value={typedName}
                      onChange={(e) => setTypedName(e.target.value)}
                      className="text-lg"
                    />
                    
                    <div className="space-y-2">
                      <Label className="text-sm">Font Style</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {SIGNATURE_FONTS.map((font) => (
                          <button
                            key={font.id}
                            onClick={() => setSelectedFont(font.id)}
                            className={cn(
                              "p-3 rounded-lg border-2 transition-all text-left",
                              selectedFont === font.id
                                ? "border-primary bg-primary/5"
                                : "border-muted hover:border-muted-foreground/30"
                            )}
                          >
                            <span
                              className="text-xl text-foreground"
                              style={{ fontFamily: font.fontFamily }}
                            >
                              {typedName || 'Your Name'}
                            </span>
                            <p className="text-xs text-muted-foreground mt-1">{font.name}</p>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Signature Preview */}
              {signatureDataUrl && (
                <div className="space-y-2">
                  <Label className="text-sm">Preview</Label>
                  <div className="p-4 border rounded-lg bg-white flex justify-center">
                    <img 
                      src={signatureDataUrl} 
                      alt="Signature preview" 
                      className="max-h-20 object-contain"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Position Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Signature Position</Label>
              <Select value={position} onValueChange={(v) => setPosition(v as SignaturePosition)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bottom-left">Bottom Left</SelectItem>
                  <SelectItem value="bottom-center">Bottom Center</SelectItem>
                  <SelectItem value="bottom-right">Bottom Right</SelectItem>
                  <SelectItem value="top-left">Top Left</SelectItem>
                  <SelectItem value="top-center">Top Center</SelectItem>
                  <SelectItem value="top-right">Top Right</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sign Button */}
            <Button
              onClick={handleSign}
              disabled={isProcessing || !signatureDataUrl}
              className="w-full"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing... {Math.round(progress)}%
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Sign & Download PDF
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default SignPdf;
