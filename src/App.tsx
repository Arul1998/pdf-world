import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import MergePdf from "./pages/tools/MergePdf";
import SplitPdf from "./pages/tools/SplitPdf";
import CompressPdf from "./pages/tools/CompressPdf";
import RotatePdf from "./pages/tools/RotatePdf";
import JpgToPdf from "./pages/tools/JpgToPdf";
import PdfToJpg from "./pages/tools/PdfToJpg";
import PageNumbers from "./pages/tools/PageNumbers";
import Watermark from "./pages/tools/Watermark";
import RemovePages from "./pages/tools/RemovePages";
import ExtractPages from "./pages/tools/ExtractPages";
import OrganizePages from "./pages/tools/OrganizePages";
import UnlockPdf from "./pages/tools/UnlockPdf";
import ProtectPdf from "./pages/tools/ProtectPdf";
import SignPdf from "./pages/tools/SignPdf";
import PdfToWord from "./pages/tools/PdfToWord";
import WordToPdf from "./pages/tools/WordToPdf";
import CropPdf from "./pages/tools/CropPdf";
import RedactPdf from "./pages/tools/RedactPdf";
import ComparePdf from "./pages/tools/ComparePdf";
import CopyPdf from "./pages/tools/CopyPdf";
import ScanToPdf from "./pages/tools/ScanToPdf";
import RepairPdf from "./pages/tools/RepairPdf";
import OcrPdf from "./pages/tools/OcrPdf";
import ExcelToPdf from "./pages/tools/ExcelToPdf";
import PptToPdf from "./pages/tools/PptToPdf";
import PdfToExcel from "./pages/tools/PdfToExcel";
import EditPdf from "./pages/tools/EditPdf";
import PdfFiller from "./pages/tools/PdfFiller";
import Contact from "./pages/Contact";
import FAQ from "./pages/FAQ";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ScrollToTop />
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
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
