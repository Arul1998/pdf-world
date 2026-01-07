import { useState } from 'react';
import { Workflow as WorkflowIcon, Play, Download, Loader2, Plus, Trash2, ArrowDown, Archive, Settings } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PDFDocument, degrees, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFFile, readFileAsArrayBuffer } from '@/lib/pdf-tools';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

type WorkflowAction = 
  | 'rotate' 
  | 'compress' 
  | 'watermark' 
  | 'page-numbers' 
  | 'merge';

interface WorkflowStep {
  id: string;
  action: WorkflowAction;
  options: Record<string, any>;
}

const ACTION_OPTIONS: { id: WorkflowAction; name: string; description: string }[] = [
  { id: 'rotate', name: 'Rotate Pages', description: 'Rotate all pages by 90°, 180°, or 270°' },
  { id: 'compress', name: 'Compress', description: 'Reduce file size' },
  { id: 'watermark', name: 'Add Watermark', description: 'Add text watermark to all pages' },
  { id: 'page-numbers', name: 'Add Page Numbers', description: 'Add page numbers to footer' },
  { id: 'merge', name: 'Merge All', description: 'Combine all PDFs into one (applies last)' },
];

const Workflow = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [steps, setSteps] = useState<WorkflowStep[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addStep = () => {
    setSteps([...steps, { 
      id: generateId(), 
      action: 'rotate', 
      options: { rotation: 90 } 
    }]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id));
  };

  const updateStep = (id: string, updates: Partial<WorkflowStep>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const updateStepOptions = (id: string, options: Record<string, any>) => {
    setSteps(steps.map(s => s.id === id ? { ...s, options: { ...s.options, ...options } } : s));
  };

  // Action implementations
  const applyRotate = async (pdfBytes: Uint8Array, rotation: number): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    pages.forEach(page => {
      const currentRotation = page.getRotation().angle;
      page.setRotation(degrees(currentRotation + rotation));
    });
    return pdfDoc.save();
  };

  const applyCompress = async (pdfBytes: Uint8Array): Promise<Uint8Array> => {
    const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
    const newPdfDoc = await PDFDocument.create();
    const quality = 0.6;
    const scale = 1.2;
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      if (!context) continue;
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      
      const imageDataUrl = canvas.toDataURL('image/jpeg', quality);
      const imageBytes = Uint8Array.from(atob(imageDataUrl.split(',')[1]), c => c.charCodeAt(0));
      const jpgImage = await newPdfDoc.embedJpg(imageBytes);
      
      const originalViewport = page.getViewport({ scale: 1 });
      const newPage = newPdfDoc.addPage([originalViewport.width, originalViewport.height]);
      
      newPage.drawImage(jpgImage, {
        x: 0,
        y: 0,
        width: originalViewport.width,
        height: originalViewport.height,
      });
    }
    
    return newPdfDoc.save({ useObjectStreams: true });
  };

  const applyWatermark = async (pdfBytes: Uint8Array, text: string): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();
    
    pages.forEach(page => {
      const { width, height } = page.getSize();
      const fontSize = 40;
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      
      page.drawText(text, {
        x: (width - textWidth) / 2,
        y: height / 2,
        size: fontSize,
        font,
        color: rgb(0.5, 0.5, 0.5),
        opacity: 0.3,
        rotate: degrees(-45),
      });
    });
    
    return pdfDoc.save();
  };

  const applyPageNumbers = async (pdfBytes: Uint8Array): Promise<Uint8Array> => {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    
    pages.forEach((page, index) => {
      const { width } = page.getSize();
      const text = `${index + 1}`;
      const fontSize = 10;
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      
      page.drawText(text, {
        x: (width - textWidth) / 2,
        y: 30,
        size: fontSize,
        font,
        color: rgb(0.3, 0.3, 0.3),
      });
    });
    
    return pdfDoc.save();
  };

  const mergePdfs = async (pdfBytesArray: Uint8Array[]): Promise<Uint8Array> => {
    const mergedPdf = await PDFDocument.create();
    
    for (const pdfBytes of pdfBytesArray) {
      const pdf = await PDFDocument.load(pdfBytes);
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }
    
    return mergedPdf.save();
  };

  const runWorkflow = async () => {
    if (files.length === 0) {
      toast.error('Please add PDF files');
      return;
    }
    
    if (steps.length === 0) {
      toast.error('Please add at least one workflow step');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      // Check if merge is in the workflow
      const hasMerge = steps.some(s => s.action === 'merge');
      const nonMergeSteps = steps.filter(s => s.action !== 'merge');
      
      // Process each file
      const processedFiles: { name: string; data: Uint8Array }[] = [];
      
      for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
        const file = files[fileIdx];
        setProgressMessage(`Processing ${file.name}...`);
        
        let pdfBytes = new Uint8Array(await readFileAsArrayBuffer(file.file));
        
        for (let stepIdx = 0; stepIdx < nonMergeSteps.length; stepIdx++) {
          const step = nonMergeSteps[stepIdx];
          const stepProgress = ((fileIdx * nonMergeSteps.length + stepIdx) / (files.length * nonMergeSteps.length)) * 80;
          setProgress(stepProgress);
          setProgressMessage(`${file.name}: ${ACTION_OPTIONS.find(a => a.id === step.action)?.name}...`);
          
          switch (step.action) {
            case 'rotate':
              pdfBytes = new Uint8Array(await applyRotate(pdfBytes, step.options.rotation || 90));
              break;
            case 'compress':
              pdfBytes = new Uint8Array(await applyCompress(pdfBytes));
              break;
            case 'watermark':
              pdfBytes = new Uint8Array(await applyWatermark(pdfBytes, step.options.text || 'WATERMARK'));
              break;
            case 'page-numbers':
              pdfBytes = new Uint8Array(await applyPageNumbers(pdfBytes));
              break;
          }
        }
        
        processedFiles.push({ name: file.name.replace('.pdf', '_processed.pdf'), data: pdfBytes });
      }
      
      setProgress(85);
      
      // Handle output
      if (hasMerge && processedFiles.length > 0) {
        setProgressMessage('Merging all files...');
        const mergedPdf = await mergePdfs(processedFiles.map(f => f.data));
        setProgress(100);
        
        const blob = new Blob([new Uint8Array(mergedPdf)], { type: 'application/pdf' });
        saveAs(blob, `merged_workflow_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success('Workflow completed! Files merged.');
      } else if (processedFiles.length === 1) {
        setProgress(100);
        const blob = new Blob([new Uint8Array(processedFiles[0].data)], { type: 'application/pdf' });
        saveAs(blob, processedFiles[0].name);
        toast.success('Workflow completed!');
      } else {
        setProgressMessage('Creating ZIP archive...');
        const zip = new JSZip();
        processedFiles.forEach(f => zip.file(f.name, f.data));
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        setProgress(100);
        
        saveAs(zipBlob, `workflow_${new Date().toISOString().split('T')[0]}.zip`);
        toast.success(`Workflow completed! Processed ${processedFiles.length} files.`);
      }
      
      setFiles([]);
    } catch (error) {
      console.error(error);
      toast.error('Workflow failed. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setProgressMessage('');
    }
  };

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  return (
    <ToolLayout
      title="PDF Workflow"
      description="Create automated workflows to process multiple PDFs with a sequence of actions."
      icon={WorkflowIcon}
      category="security"
      categoryColor="security"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={setFiles}
          multiple
          hideFileList
          buttonText="Select PDF Files"
          buttonTextWithFiles="Add More Files"
        />

        {files.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{files.length} file(s) selected</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFiles([])}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>
            
            <div className="grid gap-2 max-h-32 overflow-y-auto">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
                >
                  <span className="truncate max-w-[250px]">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeFile(file.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Workflow Steps */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Workflow Steps
            </Label>
            <Button variant="outline" size="sm" onClick={addStep}>
              <Plus className="h-4 w-4 mr-1" />
              Add Step
            </Button>
          </div>
          
          {steps.length === 0 ? (
            <div className="p-8 border-2 border-dashed rounded-xl text-center text-muted-foreground">
              <p>No steps added yet. Click "Add Step" to start building your workflow.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {steps.map((step, index) => (
                <div key={step.id} className="space-y-2">
                  {index > 0 && (
                    <div className="flex justify-center">
                      <ArrowDown className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="p-4 bg-muted/50 rounded-xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Step {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => removeStep(step.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <Select 
                      value={step.action} 
                      onValueChange={(v) => updateStep(step.id, { 
                        action: v as WorkflowAction, 
                        options: v === 'rotate' ? { rotation: 90 } : 
                                 v === 'watermark' ? { text: 'WATERMARK' } : {} 
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACTION_OPTIONS.map((action) => (
                          <SelectItem key={action.id} value={action.id}>
                            <div>
                              <div className="font-medium">{action.name}</div>
                              <div className="text-xs text-muted-foreground">{action.description}</div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Action-specific options */}
                    {step.action === 'rotate' && (
                      <Select 
                        value={String(step.options.rotation || 90)}
                        onValueChange={(v) => updateStepOptions(step.id, { rotation: parseInt(v) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="90">90° Clockwise</SelectItem>
                          <SelectItem value="180">180°</SelectItem>
                          <SelectItem value="270">270° (90° Counter-clockwise)</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                    
                    {step.action === 'watermark' && (
                      <Input
                        placeholder="Watermark text"
                        value={step.options.text || ''}
                        onChange={(e) => updateStepOptions(step.id, { text: e.target.value })}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isProcessing && (
          <div className="space-y-2">
            <ProgressBar progress={progress} />
            <p className="text-sm text-center text-muted-foreground">{progressMessage}</p>
          </div>
        )}

        <Button
          onClick={runWorkflow}
          disabled={files.length === 0 || steps.length === 0 || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Running Workflow...
            </>
          ) : (
            <>
              <Play className="mr-2 h-5 w-5" />
              Run Workflow
            </>
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Steps are applied in order to each PDF. Use "Merge All" as a final step to combine outputs.
        </p>
      </div>
    </ToolLayout>
  );
};

export default Workflow;
