import { useState } from 'react';
import { Unlock, Download, Loader2, Eye, EyeOff, X, FileText } from 'lucide-react';
import JSZip from 'jszip';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { unlockPdf, downloadBlob, formatFileSize, type PDFFile } from '@/lib/pdf-tools';

const UnlockPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
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
        // Multiple files - create ZIP
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
            {/* File thumbnails grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="relative group bg-card border border-border rounded-xl p-3 flex flex-col items-center"
                >
                  <button
                    onClick={() => removeFile(file.id)}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  <div className="w-full aspect-[3/4] bg-muted rounded-lg overflow-hidden mb-2 flex items-center justify-center">
                    {file.thumbnail ? (
                      <img src={file.thumbnail} alt={file.name} className="w-full h-full object-cover" />
                    ) : (
                      <FileText className="w-10 h-10 text-muted-foreground" />
                    )}
                  </div>

                  <p className="text-xs font-medium text-foreground truncate w-full text-center" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              ))}
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
