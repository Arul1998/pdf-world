import { useState } from 'react';
import { Wrench, Download, Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { repairPdf, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

type RepairStatus = 'idle' | 'analyzing' | 'repairing' | 'success' | 'error';

interface RepairResult {
  success: boolean;
  originalPageCount: number;
  repairedPageCount: number;
  issuesFound: string[];
  issuesFixed: string[];
}

const RepairPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<RepairStatus>('idle');
  const [result, setResult] = useState<RepairResult | null>(null);
  const [repairedData, setRepairedData] = useState<Uint8Array | null>(null);

  const handleRepair = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    setIsProcessing(true);
    setProgress(10);
    setStatus('analyzing');
    setResult(null);
    setRepairedData(null);

    try {
      setProgress(30);
      setStatus('repairing');
      
      const repairResult = await repairPdf(
        files[0].file,
        (currentPage, totalPages) => {
          setProgress(30 + (currentPage / totalPages) * 60);
        }
      );
      
      setProgress(95);
      setRepairedData(repairResult.data);
      setResult({
        success: true,
        originalPageCount: repairResult.originalPageCount,
        repairedPageCount: repairResult.repairedPageCount,
        issuesFound: repairResult.issuesFound,
        issuesFixed: repairResult.issuesFixed,
      });
      setStatus('success');
      setProgress(100);
      
      if (repairResult.issuesFixed.length > 0) {
        toast.success('PDF repaired successfully!');
      } else {
        toast.info('PDF appears to be healthy. No repairs needed.');
      }
    } catch (error) {
      console.error(error);
      setStatus('error');
      toast.error('Failed to repair PDF. The file may be too corrupted.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleDownload = () => {
    if (!repairedData) return;
    const filename = files[0].name.replace('.pdf', '_repaired.pdf');
    downloadBlob(repairedData, filename);
    toast.success('Repaired PDF downloaded!');
  };

  const resetState = () => {
    setStatus('idle');
    setResult(null);
    setRepairedData(null);
  };

  return (
    <ToolLayout
      title="Repair PDF"
      description="Fix corrupted or damaged PDF files by reconstructing the document structure."
      icon={Wrench}
      category="optimize"
      categoryColor="optimize"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={(newFiles) => {
            setFiles(newFiles.slice(0, 1));
            resetState();
          }}
          multiple={false}
          hideFileList={false}
          buttonText="Select File"
          buttonTextWithFiles="Change File"
        />

        {/* Status display */}
        {status !== 'idle' && (
          <div className="p-4 rounded-xl bg-muted/50 space-y-4">
            <div className="flex items-center gap-3">
              {status === 'analyzing' && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span>Analyzing PDF structure...</span>
                </>
              )}
              {status === 'repairing' && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span>Repairing document...</span>
                </>
              )}
              {status === 'success' && (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-700 dark:text-green-400">
                    Repair complete
                  </span>
                </>
              )}
              {status === 'error' && (
                <>
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <span className="font-medium text-red-700 dark:text-red-400">
                    Repair failed
                  </span>
                </>
              )}
            </div>

            {/* Repair results */}
            {result && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-background rounded-lg">
                    <div className="text-muted-foreground">Original Pages</div>
                    <div className="text-xl font-semibold">{result.originalPageCount}</div>
                  </div>
                  <div className="p-3 bg-background rounded-lg">
                    <div className="text-muted-foreground">Recovered Pages</div>
                    <div className="text-xl font-semibold">{result.repairedPageCount}</div>
                  </div>
                </div>

                {result.issuesFound.length > 0 && (
                  <div>
                    <div className="font-medium mb-1">Issues Found:</div>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {result.issuesFound.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.issuesFixed.length > 0 && (
                  <div>
                    <div className="font-medium mb-1 text-green-700 dark:text-green-400">Repairs Applied:</div>
                    <ul className="list-disc list-inside text-muted-foreground">
                      {result.issuesFixed.map((fix, i) => (
                        <li key={i}>{fix}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.issuesFixed.length === 0 && result.issuesFound.length === 0 && (
                  <p className="text-muted-foreground">
                    No issues were detected. The PDF appears to be healthy.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {isProcessing && <ProgressBar progress={progress} />}

        {/* Action buttons */}
        <div className="flex gap-3">
          {status === 'success' && repairedData ? (
            <>
              <Button onClick={handleDownload} size="lg" className="flex-1">
                <Download className="mr-2 h-5 w-5" />
                Download Repaired PDF
              </Button>
              <Button 
                onClick={() => {
                  setFiles([]);
                  resetState();
                }} 
                variant="outline" 
                size="lg"
              >
                Repair Another
              </Button>
            </>
          ) : (
            <Button
              onClick={handleRepair}
              disabled={files.length === 0 || isProcessing}
              size="lg"
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Repairing...
                </>
              ) : (
                <>
                  <Wrench className="mr-2 h-5 w-5" />
                  Repair PDF
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </ToolLayout>
  );
};

export default RepairPdf;
