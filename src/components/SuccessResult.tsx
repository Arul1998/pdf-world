import { CheckCircle, Download, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SuccessResultProps {
  /** Main message e.g. "PDFs merged successfully!" */
  message: string;
  /** Optional extra detail e.g. "3 files • 2.1 MB saved" */
  detail?: string;
  /** Called when user clicks "Process More Files" */
  onReset: () => void;
}

/**
 * Success state card shown after a tool operation completes.
 * Provides visual confirmation + reset option.
 */
export const SuccessResult = ({ message, detail, onReset }: SuccessResultProps) => {
  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-success/5 border border-success/20 rounded-2xl animate-fade-in">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
        <CheckCircle className="h-7 w-7 text-success" />
      </div>
      <div className="text-center">
        <p className="text-lg font-semibold text-foreground">{message}</p>
        {detail && (
          <p className="text-sm text-muted-foreground mt-1">{detail}</p>
        )}
      </div>
      <Button variant="outline" onClick={onReset} className="gap-2">
        <RotateCcw className="h-4 w-4" />
        Process More Files
      </Button>
    </div>
  );
};
