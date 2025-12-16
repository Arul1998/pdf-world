import { useState } from 'react';
import { Droplets, Download, Loader2 } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { addWatermark, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

const Watermark = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [text, setText] = useState('CONFIDENTIAL');
  const [opacity, setOpacity] = useState([30]);
  const [rotation, setRotation] = useState([-45]);
  const [fontSize, setFontSize] = useState([50]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleAddWatermark = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    if (!text.trim()) {
      toast.error('Please enter watermark text');
      return;
    }

    setIsProcessing(true);
    setProgress(30);

    try {
      const result = await addWatermark(files[0].file, text, {
        opacity: opacity[0] / 100,
        rotation: rotation[0],
        fontSize: fontSize[0],
      });
      setProgress(80);
      
      const filename = files[0].name.replace('.pdf', '_watermarked.pdf');
      downloadBlob(result, filename);
      setProgress(100);
      
      toast.success('Watermark added successfully!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to add watermark. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  return (
    <ToolLayout
      title="Add Watermark"
      description="Stamp a text watermark across all pages of your PDF."
      icon={Droplets}
      category="edit"
      categoryColor="edit"
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

        {files.length > 0 && (
          <div className="space-y-6 p-4 bg-muted/50 rounded-xl">
            <div className="space-y-2">
              <Label htmlFor="text">Watermark text</Label>
              <Input
                id="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter watermark text"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Opacity</Label>
                <span className="text-sm text-muted-foreground">{opacity[0]}%</span>
              </div>
              <Slider
                value={opacity}
                onValueChange={setOpacity}
                min={10}
                max={100}
                step={5}
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Rotation</Label>
                <span className="text-sm text-muted-foreground">{rotation[0]}°</span>
              </div>
              <Slider
                value={rotation}
                onValueChange={setRotation}
                min={-90}
                max={90}
                step={15}
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <Label>Font size</Label>
                <span className="text-sm text-muted-foreground">{fontSize[0]}px</span>
              </div>
              <Slider
                value={fontSize}
                onValueChange={setFontSize}
                min={20}
                max={100}
                step={5}
              />
            </div>

            {/* Preview */}
            <div className="relative aspect-[3/4] bg-card border border-border rounded-lg flex items-center justify-center overflow-hidden">
              <span 
                className="text-muted-foreground font-bold select-none"
                style={{
                  opacity: opacity[0] / 100,
                  transform: `rotate(${rotation[0]}deg)`,
                  fontSize: `${fontSize[0] / 3}px`,
                }}
              >
                {text || 'Preview'}
              </span>
              <span className="absolute bottom-2 left-2 text-xs text-muted-foreground">Preview</span>
            </div>
          </div>
        )}

        {isProcessing && (
          <ProgressBar progress={progress} />
        )}

        <Button
          onClick={handleAddWatermark}
          disabled={files.length === 0 || !text.trim() || isProcessing}
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
              Add Watermark & Download
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default Watermark;
