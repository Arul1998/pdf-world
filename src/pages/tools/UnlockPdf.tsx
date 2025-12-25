import { useState } from 'react';
import { Unlock, Download, Loader2, Eye, EyeOff } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
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

  const handleUnlock = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    if (!password.trim()) {
      toast.error('Please enter the PDF password');
      return;
    }

    setIsProcessing(true);
    setProgress(30);

    try {
      const result = await unlockPdf(files[0].file, password);
      setProgress(80);
      
      const filename = files[0].name.replace('.pdf', '_unlocked.pdf');
      downloadBlob(result, filename);
      setProgress(100);
      
      toast.success('PDF unlocked successfully!');
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
      description="Remove password protection from your PDF files. Enter the current password to unlock."
      icon={Unlock}
      category="security"
      categoryColor="security"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={(newFiles) => setFiles(newFiles.slice(0, 1))}
          multiple={false}
          buttonText="Select PDF"
          buttonTextWithFiles="Change PDF"
        />

        {files.length > 0 && (
          <div className="space-y-6">
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
                Enter the password that was used to protect this PDF.
              </p>
            </div>

            {/* Progress Bar */}
            {isProcessing && (
              <ProgressBar progress={progress} />
            )}

            {/* Unlock Button */}
            <Button
              onClick={handleUnlock}
              disabled={isProcessing || !password.trim()}
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
                  Unlock PDF
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default UnlockPdf;
