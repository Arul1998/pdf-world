import { useState } from 'react';
import { FileStack, Download, Loader2, GripVertical } from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { mergePdfs, downloadBlob, type PDFFile } from '@/lib/pdf-tools';

const MergePdf = () => {
  const [files, setFiles] = useState<PDFFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

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
      setFiles([]);
    } catch (error) {
      console.error(error);
      toast.error('Failed to merge PDFs. Please try again.');
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const removeFile = (id: string) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const moveFile = (index: number, direction: 'up' | 'down') => {
    const newFiles = [...files];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= files.length) return;
    [newFiles[index], newFiles[targetIndex]] = [newFiles[targetIndex], newFiles[index]];
    setFiles(newFiles);
  };

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
            {/* Reorder Hint */}
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <GripVertical className="h-4 w-4" />
              <span>Drag tiles to reorder • Order shown = merge order</span>
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
                      onMoveUp={(i) => moveFile(i, 'up')}
                      onMoveDown={(i) => moveFile(i, 'down')}
                      isFirst={index === 0}
                      isLast={index === files.length - 1}
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
