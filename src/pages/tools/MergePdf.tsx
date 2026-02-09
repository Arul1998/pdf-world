import { useState } from 'react';
import { FileStack, Download, Loader2, GripVertical, Trash2 } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { ToolLayout } from '@/components/ToolLayout';
import { FileDropZone } from '@/components/FileDropZone';
import { SortablePdfCard } from '@/components/SortablePdfCard';
import { ProgressBar } from '@/components/ProgressBar';
import { SuccessResult } from '@/components/SuccessResult';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { mergePdfs, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

const MergePdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFiles((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast.error('Please add at least 2 PDF files to merge');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const pdfFiles = files.map(f => f.file);
      const mergedPdf = await mergePdfs(pdfFiles, (p) => setProgress(p));
      
      const filename = `merged_${new Date().toISOString().split('T')[0]}.pdf`;
      downloadBlob(mergedPdf, filename);
      
      toast.success('PDFs merged successfully!');
      setIsComplete(true);
    } catch (error) {
      console.error(error);
      toast.error('Failed to merge PDFs. The file may be corrupted or too large for browser processing.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setIsComplete(false);
  };

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  if (isComplete) {
    return (
      <ToolLayout
        title="Merge PDF"
        description="Combine multiple PDF files into a single document. Drag to reorder."
        icon={FileStack}
        category="organize"
        categoryColor="organize"
      >
        <SuccessResult
          message="PDFs merged successfully!"
          detail={`${files.length} files combined into one document`}
          onReset={handleReset}
        />
      </ToolLayout>
    );
  }

  return (
    <ToolLayout
      title="Merge PDF"
      description="Combine multiple PDF files into a single document. Drag to reorder."
      icon={FileStack}
      category="organize"
      categoryColor="organize"
    >
      <div className="space-y-6">
        <FileDropZone
          accept={['.pdf']}
          files={files}
          onFilesChange={setFiles}
          multiple
          hideFileList
        />

        {files.length > 0 && (
          <div className="space-y-4">
            {/* Header with reorder hint + clear all */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GripVertical className="h-4 w-4" />
                <span>Drag tiles to reorder • Order shown = merge order</span>
              </div>
              {files.length > 1 && (
                <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground hover:text-destructive gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear All
                </Button>
              )}
            </div>

            {/* Thumbnail Grid */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={files.map(f => f.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {files.map((file, index) => (
                    <SortablePdfCard
                      key={file.id}
                      file={file}
                      index={index}
                      onRemove={removeFile}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {isProcessing && (
          <ProgressBar progress={progress} />
        )}

        <div className="flex gap-3">
          <Button
            onClick={handleMerge}
            disabled={files.length < 2 || isProcessing}
            size="lg"
            className="flex-1"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Download className="mr-2 h-5 w-5" />
                Merge & Download
              </>
            )}
          </Button>
        </div>
      </div>
    </ToolLayout>
  );
};

export default MergePdf;
