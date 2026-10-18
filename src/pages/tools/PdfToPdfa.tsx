import { FileCheck } from 'lucide-react';
import { ToolLayout } from '@/components/ToolLayout';
const PdfToPdfa = () => (
  <ToolLayout title="PDF to PDF/A" description="Archival conversion is not yet available." icon={FileCheck} category="convert-from" categoryColor="convert-from">
    <p role="status">This tool is not yet available. PDF/A requires a compliant converter and independent output validation. We do not label ordinary PDFs as archival files.</p>
  </ToolLayout>
);
export default PdfToPdfa;
