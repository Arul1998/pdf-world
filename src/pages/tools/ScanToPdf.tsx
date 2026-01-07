import { useState, useRef, useCallback } from 'react';
import { ScanLine, Download, Loader2, Camera, RotateCw, Trash2, Plus } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { downloadBlob, imageToPdf } from '@/lib/pdf-tools';

interface ScannedPage {
  id: string;
  dataUrl: string;
  rotation: number;
}

const ScanToPdf = () => {
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCameraActive(true);
    } catch (error) {
      console.error('Camera access error:', error);
      toast.error('Could not access camera. Please check permissions.');
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
  }, [stream]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    const newPage: ScannedPage = {
      id: Math.random().toString(36).substring(2, 9),
      dataUrl,
      rotation: 0,
    };
    setPages(prev => [...prev, newPage]);
    toast.success('Page captured!');
  };

  const rotatePage = (id: string) => {
    setPages(prev => prev.map(page => 
      page.id === id 
        ? { ...page, rotation: (page.rotation + 90) % 360 }
        : page
    ));
  };

  const removePage = (id: string) => {
    setPages(prev => prev.filter(page => page.id !== id));
  };

  const handleCreatePdf = async () => {
    if (pages.length === 0) {
      toast.error('Please capture at least one page');
      return;
    }

    setIsProcessing(true);
    setProgress(20);

    try {
      // Convert data URLs to files with rotation applied
      const files: File[] = [];
      
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        setProgress(20 + (i / pages.length) * 40);
        
        // Apply rotation if needed
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.src = page.dataUrl;
        });
        
        const isRotated90or270 = page.rotation === 90 || page.rotation === 270;
        canvas.width = isRotated90or270 ? img.height : img.width;
        canvas.height = isRotated90or270 ? img.width : img.height;
        
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((page.rotation * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9);
        });
        
        files.push(new File([blob], `page_${i + 1}.jpg`, { type: 'image/jpeg' }));
      }

      setProgress(70);
      const result = await imageToPdf(files, { pageSize: 'a4', orientation: 'portrait', margin: 'small' });
      setProgress(90);
      
      const timestamp = new Date().toISOString().slice(0, 10);
      downloadBlob(result, `scanned_document_${timestamp}.pdf`);
      setProgress(100);
      
      toast.success('PDF created successfully!');
      stopCamera();
    } catch (error) {
      console.error(error);
      toast.error('Failed to create PDF. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="Scan to PDF"
      description="Use your device camera to scan documents and create a PDF."
      icon={ScanLine}
      category="organize"
      categoryColor="organize"
    >
      <div className="space-y-6">
        {/* Camera view */}
        {isCameraActive ? (
          <div className="space-y-4">
            <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex gap-2 justify-center">
              <Button onClick={capturePhoto} size="lg" className="gap-2">
                <Camera className="h-5 w-5" />
                Capture Page
              </Button>
              <Button onClick={stopCamera} variant="outline" size="lg">
                Close Camera
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed rounded-xl bg-muted/30">
            <Camera className="h-16 w-16 text-muted-foreground" />
            <p className="text-muted-foreground text-center">
              Use your camera to scan document pages
            </p>
            <Button onClick={startCamera} size="lg" className="gap-2">
              <Camera className="h-5 w-5" />
              Start Camera
            </Button>
          </div>
        )}

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Captured pages */}
        {pages.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-lg">Captured Pages ({pages.length})</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {pages.map((page, index) => (
                <div key={page.id} className="relative group">
                  <div className="aspect-[3/4] rounded-lg border overflow-hidden bg-muted">
                    <img
                      src={page.dataUrl}
                      alt={`Page ${index + 1}`}
                      className="w-full h-full object-cover"
                      style={{ transform: `rotate(${page.rotation}deg)` }}
                    />
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="secondary"
                      onClick={() => rotatePage(page.id)}
                    >
                      <RotateCw className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => removePage(page.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="absolute bottom-1 left-1 bg-background/80 px-2 py-0.5 rounded text-xs font-medium">
                    {index + 1}
                  </div>
                </div>
              ))}
              
              {/* Add more button */}
              {!isCameraActive && (
                <button
                  onClick={startCamera}
                  className="aspect-[3/4] rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  <Plus className="h-8 w-8" />
                  <span className="text-sm">Add Page</span>
                </button>
              )}
            </div>
          </div>
        )}

        {isProcessing && <ProgressBar progress={progress} />}

        <Button
          onClick={handleCreatePdf}
          disabled={pages.length === 0 || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Creating PDF...
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Create PDF ({pages.length} {pages.length === 1 ? 'page' : 'pages'})
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default ScanToPdf;
