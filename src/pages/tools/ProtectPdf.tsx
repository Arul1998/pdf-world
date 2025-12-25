import { useState } from 'react';
import { Lock, Download, Loader2, Eye, EyeOff } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { protectPdf, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

const ProtectPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleProtect = async () => {
    if (files.length === 0) {
      toast.error('Please add a PDF file');
      return;
    }

    if (!password.trim()) {
      toast.error('Please enter a password');
      return;
    }

    if (password.length < 4) {
      toast.error('Password must be at least 4 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsProcessing(true);
    setProgress(30);

    try {
      const result = await protectPdf(files[0].file, password, (current, total) => {
        setProgress(30 + (current / total) * 50);
      });
      setProgress(90);
      
      const filename = files[0].name.replace('.pdf', '_protected.pdf');
      downloadBlob(result, filename);
      setProgress(100);
      
      toast.success('PDF protected successfully!');
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error(error);
      toast.error('Failed to protect PDF. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const passwordsMatch = password === confirmPassword && password.length > 0;
  const canProtect = password.length >= 4 && passwordsMatch;

  return (
    <ToolLayout
      title="Protect PDF"
      description="Add password protection to your PDF files to keep them secure."
      icon={Lock}
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
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password (min 4 characters)"
                  className="pr-10"
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
            </div>

            {/* Confirm Password Input */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  className="pr-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isProcessing && canProtect) {
                      handleProtect();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="text-sm text-destructive">Passwords do not match</p>
              )}
              {passwordsMatch && (
                <p className="text-sm text-green-600">Passwords match</p>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              The password will be required to open this PDF. Make sure to remember it!
            </p>

            {/* Progress Bar */}
            {isProcessing && (
              <ProgressBar progress={progress} />
            )}

            {/* Protect Button */}
            <Button
              onClick={handleProtect}
              disabled={isProcessing || !canProtect}
              className="w-full h-14 text-lg rounded-2xl"
              size="lg"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Protecting...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-5 w-5" />
                  Protect PDF
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </ToolLayout>
  );
};

export default ProtectPdf;
