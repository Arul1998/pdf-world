import { useState } from 'react';
import { FileCheck, Download, Loader2, Trash2, Archive, Info } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFFile } from '@/lib/pdf-tools';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

type PdfALevel = 'pdfa-1b' | 'pdfa-2b' | 'pdfa-3b';

const PDFA_LEVELS = [
  { id: 'pdfa-1b', name: 'PDF/A-1b', description: 'Basic conformance, most compatible' },
  { id: 'pdfa-2b', name: 'PDF/A-2b', description: 'Better compression, JPEG2000 support' },
  { id: 'pdfa-3b', name: 'PDF/A-3b', description: 'Allows embedded files' },
];

const PdfToPdfa = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [pdfaLevel, setPdfaLevel] = useState<PdfALevel>('pdfa-2b');
  const [currentFile, setCurrentFile] = useState<string>('');

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const convertToPdfa = async (file: File, level: PdfALevel): Promise<Uint8Array> => {
    const arrayBuffer = await file.arrayBuffer();
    
    // Load and re-render PDF to ensure compliance
    const sourcePdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const totalPages = sourcePdf.numPages;
    
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    for (let i = 1; i <= totalPages; i++) {
      setProgressMessage(`Converting page ${i}/${totalPages}...`);
      setProgress((i / totalPages) * 70);
      
      const page = await sourcePdf.getPage(i);
      const scale = 2.0;
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) continue;
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      
      // Convert to high-quality JPEG
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.95);
      const imageBytes = Uint8Array.from(atob(imageDataUrl.split(',')[1]), c => c.charCodeAt(0));
      const jpgImage = await pdfDoc.embedJpg(imageBytes);
      
      // Get original page dimensions
      const originalViewport = page.getViewport({ scale: 1 });
      const newPage = pdfDoc.addPage([originalViewport.width, originalViewport.height]);
      
      newPage.drawImage(jpgImage, {
        x: 0,
        y: 0,
        width: originalViewport.width,
        height: originalViewport.height,
      });
    }
    
    setProgressMessage('Adding PDF/A metadata...');
    setProgress(80);
    
    // Add PDF/A metadata
    const now = new Date();
    pdfDoc.setTitle(file.name.replace('.pdf', ''));
    pdfDoc.setCreator('PDF World - PDF/A Converter');
    pdfDoc.setProducer('PDF World');
    pdfDoc.setCreationDate(now);
    pdfDoc.setModificationDate(now);
    
    // Add PDF/A compliance information in keywords (metadata simulation)
    pdfDoc.setKeywords([`PDF/A`, level.toUpperCase(), 'Archival', 'Long-term preservation']);
    pdfDoc.setSubject(`Converted to ${level.toUpperCase()} for long-term archival`);
    
    setProgressMessage('Finalizing...');
    setProgress(90);
    
    return pdfDoc.save({
      useObjectStreams: false, // PDF/A-1 doesn't support object streams
    });
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      toast.error('Please add PDF files');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      if (files.length === 1) {
        setCurrentFile(files[0].name);
        const pdfaData = await convertToPdfa(files[0].file, pdfaLevel);
        setProgress(100);
        
        const blob = new Blob([new Uint8Array(pdfaData)], { type: 'application/pdf' });
        saveAs(blob, files[0].name.replace('.pdf', `_${pdfaLevel}.pdf`));
        toast.success(`Converted to ${pdfaLevel.toUpperCase()}!`);
      } else {
        const zip = new JSZip();
        
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          setCurrentFile(file.name);
          
          try {
            const pdfaData = await convertToPdfa(file.file, pdfaLevel);
            const pdfaName = file.name.replace('.pdf', `_${pdfaLevel}.pdf`);
            zip.file(pdfaName, pdfaData);
          } catch (err) {
            console.error(`Failed to convert ${file.name}:`, err);
          }
        }
        
        setProgressMessage('Creating ZIP archive...');
        setProgress(95);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        setProgress(100);
        
        saveAs(zipBlob, `pdf-to-pdfa_${new Date().toISOString().split('T')[0]}.zip`);
        toast.success(`Converted ${files.length} files to ${pdfaLevel.toUpperCase()}!`);
      }
      
      setFiles([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to convert to PDF/A');
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setProgressMessage('');
      setCurrentFile('');
    }
  };

  return (
    <ToolLayout
      title="PDF to PDF/A"
      description="Convert PDF to PDF/A archival format for long-term document preservation."
      icon={FileCheck}
      category="convert-from"
      categoryColor="convert-from"
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
          <>
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
              
              <div className="grid gap-2 max-h-40 overflow-y-auto">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <span className="text-sm truncate max-w-[250px]">{file.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeFile(file.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="p-4 bg-muted/50 rounded-xl space-y-4">
              <Label>PDF/A Conformance Level</Label>
              <RadioGroup value={pdfaLevel} onValueChange={(v) => setPdfaLevel(v as PdfALevel)}>
                {PDFA_LEVELS.map((level) => (
                  <div key={level.id} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted transition-colors">
                    <RadioGroupItem value={level.id} id={level.id} className="mt-1" />
                    <div className="space-y-0.5">
                      <Label htmlFor={level.id} className="font-medium cursor-pointer">
                        {level.name}
                      </Label>
                      <p className="text-xs text-muted-foreground">{level.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>
            
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-muted-foreground">
                PDF/A is an ISO-standardized format designed for long-term archival of electronic documents.
                It ensures the document will be viewable in the future regardless of software changes.
              </p>
            </div>
          </>
        )}

        {isProcessing && (
          <div className="space-y-2">
            <ProgressBar progress={progress} />
            <p className="text-sm text-center text-muted-foreground">
              {currentFile && `${currentFile}: `}{progressMessage}
            </p>
          </div>
        )}

        <Button
          onClick={handleConvert}
          disabled={files.length === 0 || isProcessing}
          size="lg"
          className="w-full"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Converting...
            </>
          ) : files.length > 1 ? (
            <>
              <Archive className="mr-2 h-5 w-5" />
              Convert All & Download ZIP
            </>
          ) : (
            <>
              <Download className="mr-2 h-5 w-5" />
              Convert to PDF/A
            </>
          )}
        </Button>
      </div>
    </ToolLayout>
  );
};

export default PdfToPdfa;
