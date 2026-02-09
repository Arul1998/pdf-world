import { useState } from 'react';
import { Unlock, Download, Loader2, Eye, EyeOff, Trash2 } from 'lucide-react';
import JSZip from 'jszip';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { PdfFileCard } from '@/components/PdfFileCard';
import { ProgressBar } from '@/components/ProgressBar';
import { SuccessResult } from '@/components/SuccessResult';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { unlockPdf, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

const UnlockPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const handleReset = () => {
    setFiles([]);
    setPassword('');
    setIsComplete(false);
  };

  const handleUnlock = async () => {
    if (files.length === 0) {
      toast.error('Please add PDF files');
      return;
    }

    if (!password.trim()) {
      toast.error('Please enter the PDF password');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      if (files.length === 1) {
        const result = await unlockPdf(files[0].file, password);
        setProgress(80);
        
        const filename = files[0].name.replace('.pdf', '_unlocked.pdf');
        downloadBlob(result, filename);
        setProgress(100);
        
        toast.success('PDF unlocked successfully!');
      } else {
        const zip = new JSZip();
        const date = new Date().toISOString().split('T')[0];
        let successCount = 0;
        let failedFiles: string[] = [];

        for (let i = 0; i < files.length; i++) {
          setCurrentFileIndex(i);
          setProgress((i / files.length) * 90);
          
          try {
            const result = await unlockPdf(files[i].file, password);
            const filename = files[i].name.replace('.pdf', '_unlocked.pdf');
            zip.file(filename, result);
            successCount++;
          } catch {
            failedFiles.push(files[i].name);
          }
        }

        if (successCount > 0) {
          setProgress(95);
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          const url = URL.createObjectURL(zipBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `unlocked_pdfs_${date}.zip`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);

          setProgress(100);
          
          if (failedFiles.length > 0) {
            toast.warning(`${successCount} PDFs unlocked. ${failedFiles.length} failed (wrong password?)`);
          } else {
            toast.success(`${successCount} PDFs unlocked successfully!`);
          }
        } else {
          toast.error('Failed to unlock any PDFs. Check the password.');
        }
      }
      
      setIsComplete(true);
      setPassword('');
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message.includes('password')) {
        toast.error('Incorrect password. Please try again.');
      } else {
        toast.error('Failed to unlock PDF. The file may not be password-protected or the password is incorrect.');
      }
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  if (isComplete) {
    return (
      <ToolLayout
        title="Unlock PDF"
        description="Remove password protection from your PDF files."
        icon={Unlock}
        category="security"
        categoryColor="security"
      >
        <SuccessResult
          message={`${files.length} PDF${files.length > 1 ? 's' : ''} unlocked!`}
          detail={files.length > 1 ? 'Downloaded as ZIP archive' : undefined}
          onReset={handleReset}
        />
      </ToolLayout>
    );
  }

  return (
    <ToolLayout
      title="Unlock PDF"
      description="Remove password protection from your PDF files."
      icon={Unlock}
      category="security"
      categoryColor="security"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={setFiles}
          multiple={true}
          hideFileList
          buttonText="Select Files"
          buttonTextWithFiles="Add More Files"
        />

        {files.length > 0 && (
          <div className="space-y-6">
            {/* File cards */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-muted-foreground">
                  {files.length} file{files.length !== 1 ? 's' : ''} selected
                </p>
                {files.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground hover:text-destructive gap-1.5">
                    <Trash2 className="h-3.5 w-3.5" />
                    Clear All
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {files.map((file) => (
                  <PdfFileCard
                    key={file.id}
                    file={file}
                    onRemove={removeFile}
                  />
                ))}
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <Label htmlFor="password">PDF Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter the password to unlock"
                  className="pr-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isProcessing) {
                      handleUnlock();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {files.length > 1 
                  ? 'The same password will be used to unlock all selected PDFs.'
                  : 'Enter the password that was used to protect this PDF.'}
              </p>
            </div>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-2">
            {files.length > 1 && (
              <p className="text-sm text-muted-foreground text-center">
                Unlocking file {currentFileIndex + 1} of {files.length}
              </p>
            )}
            <ProgressBar progress={progress} />
          </div>
        )}

        <Button
          onClick={handleUnlock}
          disabled={isProcessing || !password.trim() || files.length === 0}
          className="w-full h-14 text-lg rounded-2xl"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Unlocking...
            </>
          ) : (
            <>
              <Unlock className="mr-2 h-5 w-5" />
              Unlock PDF{files.length > 1 ? 's' : ''} {files.length > 1 ? '& Download ZIP' : ''}
            </>
          )}
        </Button>

        {files.length > 1 && !isProcessing && (
          <p className="text-sm text-muted-foreground text-center">
            Multiple files will be downloaded as a ZIP archive.
          </p>
        )}
      </div>
    </ToolLayout>
  );
};

export default UnlockPdf;
