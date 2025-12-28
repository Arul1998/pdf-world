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
