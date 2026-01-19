import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { LoadingSpinner } from "@/components/LoadingSpinner";

// Eagerly load the main page for fast initial load
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Lazy load all tool pages for code splitting
const MergePdf = lazy(() => import("./pages/tools/MergePdf"));
const SplitPdf = lazy(() => import("./pages/tools/SplitPdf"));
const CompressPdf = lazy(() => import("./pages/tools/CompressPdf"));
const RotatePdf = lazy(() => import("./pages/tools/RotatePdf"));
const JpgToPdf = lazy(() => import("./pages/tools/JpgToPdf"));
const PdfToJpg = lazy(() => import("./pages/tools/PdfToJpg"));
const PageNumbers = lazy(() => import("./pages/tools/PageNumbers"));
const Watermark = lazy(() => import("./pages/tools/Watermark"));
const RemovePages = lazy(() => import("./pages/tools/RemovePages"));
const ExtractPages = lazy(() => import("./pages/tools/ExtractPages"));
const OrganizePages = lazy(() => import("./pages/tools/OrganizePages"));
const UnlockPdf = lazy(() => import("./pages/tools/UnlockPdf"));
const ProtectPdf = lazy(() => import("./pages/tools/ProtectPdf"));
const SignPdf = lazy(() => import("./pages/tools/SignPdf"));
const PdfToWord = lazy(() => import("./pages/tools/PdfToWord"));
const WordToPdf = lazy(() => import("./pages/tools/WordToPdf"));
const CropPdf = lazy(() => import("./pages/tools/CropPdf"));
const RedactPdf = lazy(() => import("./pages/tools/RedactPdf"));
const ComparePdf = lazy(() => import("./pages/tools/ComparePdf"));
const CopyPdf = lazy(() => import("./pages/tools/CopyPdf"));
const ScanToPdf = lazy(() => import("./pages/tools/ScanToPdf"));
const RepairPdf = lazy(() => import("./pages/tools/RepairPdf"));
const OcrPdf = lazy(() => import("./pages/tools/OcrPdf"));
const ExcelToPdf = lazy(() => import("./pages/tools/ExcelToPdf"));
const PptToPdf = lazy(() => import("./pages/tools/PptToPdf"));
const PdfToExcel = lazy(() => import("./pages/tools/PdfToExcel"));
const EditPdf = lazy(() => import("./pages/tools/EditPdf"));
const PdfFiller = lazy(() => import("./pages/tools/PdfFiller"));
const HtmlToPdf = lazy(() => import("./pages/tools/HtmlToPdf"));
const OfficeToPdf = lazy(() => import("./pages/tools/OfficeToPdf"));
const PdfToWordOcr = lazy(() => import("./pages/tools/PdfToWordOcr"));
const PdfToExcelOcr = lazy(() => import("./pages/tools/PdfToExcelOcr"));
const PdfToPpt = lazy(() => import("./pages/tools/PdfToPpt"));
const PdfToPdfa = lazy(() => import("./pages/tools/PdfToPdfa"));
const Workflow = lazy(() => import("./pages/tools/Workflow"));

// Lazy load static pages
const Contact = lazy(() => import("./pages/Contact"));
const FAQ = lazy(() => import("./pages/FAQ"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/tools/merge" element={<MergePdf />} />
            <Route path="/tools/split" element={<SplitPdf />} />
            <Route path="/tools/compress" element={<CompressPdf />} />
            <Route path="/tools/rotate" element={<RotatePdf />} />
            <Route path="/tools/jpg-to-pdf" element={<JpgToPdf />} />
            <Route path="/tools/pdf-to-jpg" element={<PdfToJpg />} />
            <Route path="/tools/page-numbers" element={<PageNumbers />} />
            <Route path="/tools/watermark" element={<Watermark />} />
            <Route path="/tools/remove-pages" element={<RemovePages />} />
            <Route path="/tools/extract-pages" element={<ExtractPages />} />
            <Route path="/tools/organize-pages" element={<OrganizePages />} />
            <Route path="/tools/unlock" element={<UnlockPdf />} />
            <Route path="/tools/protect" element={<ProtectPdf />} />
            <Route path="/tools/sign" element={<SignPdf />} />
            <Route path="/tools/pdf-to-word" element={<PdfToWord />} />
            <Route path="/tools/word-to-pdf" element={<WordToPdf />} />
            <Route path="/tools/crop" element={<CropPdf />} />
            <Route path="/tools/redact" element={<RedactPdf />} />
            <Route path="/tools/compare" element={<ComparePdf />} />
            <Route path="/tools/copy-pdf" element={<CopyPdf />} />
            <Route path="/tools/scan-to-pdf" element={<ScanToPdf />} />
            <Route path="/tools/repair" element={<RepairPdf />} />
            <Route path="/tools/ocr" element={<OcrPdf />} />
            <Route path="/tools/excel-to-pdf" element={<ExcelToPdf />} />
            <Route path="/tools/ppt-to-pdf" element={<PptToPdf />} />
            <Route path="/tools/pdf-to-excel" element={<PdfToExcel />} />
            <Route path="/tools/edit-pdf" element={<EditPdf />} />
            <Route path="/tools/pdf-filler" element={<PdfFiller />} />
            <Route path="/tools/html-to-pdf" element={<HtmlToPdf />} />
            <Route path="/tools/office-to-pdf" element={<OfficeToPdf />} />
            <Route path="/tools/pdf-to-word-ocr" element={<PdfToWordOcr />} />
            <Route path="/tools/pdf-to-excel-ocr" element={<PdfToExcelOcr />} />
            <Route path="/tools/pdf-to-ppt" element={<PdfToPpt />} />
            <Route path="/tools/pdf-to-pdfa" element={<PdfToPdfa />} />
            <Route path="/tools/workflow" element={<Workflow />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
