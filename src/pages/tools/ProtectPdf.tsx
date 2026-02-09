import { useState, useMemo } from 'react';
import { Lock, Download, Loader2, Eye, EyeOff, X, FileText, AlertTriangle } from 'lucide-react';
import JSZip from 'jszip';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { ProgressBar } from '@/components/ProgressBar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { protectPdf, downloadBlob, formatFileSize, type PDFFile } from '@/lib/pdf-tools';
import { cn } from '@/lib/utils';

const getPasswordStrength = (password: string): { level: 'weak' | 'medium' | 'strong'; score: number; feedback: string } => {
  if (!password) return { level: 'weak', score: 0, feedback: '' };
  
  let score = 0;
  
  // Length checks
  if (password.length >= 4) score += 1;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  
  // Character variety checks
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  
  let level: 'weak' | 'medium' | 'strong';
  let feedback: string;
  
  if (score <= 2) {
    level = 'weak';
    feedback = 'Add numbers, uppercase, or special characters';
  } else if (score <= 4) {
    level = 'medium';
    feedback = 'Good, but could be stronger';
  } else {
    level = 'strong';
    feedback = 'Strong password';
  }
  
  return { level, score: Math.min(score, 7), feedback };
};

const ProtectPdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  const passwordStrength = useMemo(() => getPasswordStrength(password), [password]);

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const handleProtect = async () => {
    if (files.length === 0) {
      toast.error('Please add PDF files');
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
    setProgress(0);

    try {
      if (files.length === 1) {
        const result = await protectPdf(files[0].file, password, (current, total) => {
          setProgress(30 + (current / total) * 50);
        });
        setProgress(90);
        
        const filename = files[0].name.replace('.pdf', '_protected.pdf');
        downloadBlob(result, filename);
        setProgress(100);
        
        toast.success('PDF protected successfully!');
      } else {
        // Multiple files - create ZIP
        const zip = new JSZip();
        const date = new Date().toISOString().split('T')[0];

        for (let i = 0; i < files.length; i++) {
          setCurrentFileIndex(i);
          setProgress((i / files.length) * 90);
          
          const result = await protectPdf(files[i].file, password);
          const filename = files[i].name.replace('.pdf', '_protected.pdf');
          zip.file(filename, result);
        }

        setProgress(95);
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `protected_pdfs_${date}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setProgress(100);
        toast.success(`${files.length} PDFs protected successfully!`);
      }
      
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
        {/* Limitation Notice */}
        <div className="flex items-start gap-3 p-4 rounded-xl border border-warning/30 bg-warning/5">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">Browser-based protection</p>
            <p>This tool re-renders your PDF with metadata markers. True PDF encryption is not available in browser-based processing. For enterprise-grade password protection, use desktop software like Adobe Acrobat.</p>
          </div>
        </div>

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
                    {file.pageCount} {file.pageCount === 1 ? 'page' : 'pages'} • {formatFileSize(file.size)}
                  </p>
                </div>
              ))}
            </div>

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
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
              </div>
              
              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <div className="space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3].map((bar) => (
                      <div
                        key={bar}
                        className={cn(
                          "h-1.5 flex-1 rounded-full transition-colors duration-200",
                          bar === 1 && password.length > 0 && (
                            passwordStrength.level === 'weak' ? 'bg-destructive' :
                            passwordStrength.level === 'medium' ? 'bg-warning' :
                            'bg-success'
                          ),
                          bar === 2 && (
                            passwordStrength.level === 'medium' ? 'bg-warning' :
                            passwordStrength.level === 'strong' ? 'bg-success' :
                            'bg-muted'
                          ),
                          bar === 3 && (
                            passwordStrength.level === 'strong' ? 'bg-success' :
                            'bg-muted'
                          )
                        )}
                      />
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-xs font-medium capitalize",
                      passwordStrength.level === 'weak' && 'text-destructive',
                      passwordStrength.level === 'medium' && 'text-warning',
                      passwordStrength.level === 'strong' && 'text-success'
                    )}>
                      {passwordStrength.level}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {passwordStrength.feedback}
                    </span>
                  </div>
                </div>
              )}
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
                <p className="text-sm text-success">Passwords match</p>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              The same password will be applied to all selected PDFs.
            </p>
          </div>
        )}

        {isProcessing && (
          <div className="space-y-2">
            {files.length > 1 && (
              <p className="text-sm text-muted-foreground text-center">
                Protecting file {currentFileIndex + 1} of {files.length}
              </p>
            )}
            <ProgressBar progress={progress} />
          </div>
        )}

        <Button
          onClick={handleProtect}
          disabled={isProcessing || !canProtect || files.length === 0}
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
              Protect PDF{files.length > 1 ? 's' : ''} {files.length > 1 ? '& Download ZIP' : ''}
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

export default ProtectPdf;
