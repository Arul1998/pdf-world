import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ToolLayout } from '@/components/ToolLayout';
const OfficeToPdf = () => (
  <ToolLayout title="Office to PDF" description="Choose a dedicated browser-based export tool. Layout preservation is limited." icon={FileText} category="convert-to" categoryColor="convert-to">
    <ul className="space-y-4">
      <li><Link className="text-primary underline" to="/tools/word-to-pdf">Word text to PDF</Link> — DOCX text only; images and layout are not preserved.</li>
      <li><Link className="text-primary underline" to="/tools/ppt-to-pdf">PowerPoint text to PDF</Link> — PPTX slide text only; images, charts, and layout are not preserved.</li>
      <li><Link className="text-primary underline" to="/tools/excel-to-pdf">Excel to PDF</Link> — basic table export; review the output for clipping and layout changes.</li>
    </ul>
  </ToolLayout>
);
export default OfficeToPdf;
