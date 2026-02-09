import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ScrollToTop } from "@/components/ScrollToTop";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "next-themes";

// Eagerly load the main page for fast initial load
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

// Route configuration for lazy-loaded pages
const toolRoutes = [
  { path: "/tools/merge", factory: () => import("./pages/tools/MergePdf") },
  { path: "/tools/split", factory: () => import("./pages/tools/SplitPdf") },
  { path: "/tools/compress", factory: () => import("./pages/tools/CompressPdf") },
  { path: "/tools/rotate", factory: () => import("./pages/tools/RotatePdf") },
  { path: "/tools/jpg-to-pdf", factory: () => import("./pages/tools/JpgToPdf") },
  { path: "/tools/pdf-to-jpg", factory: () => import("./pages/tools/PdfToJpg") },
  { path: "/tools/page-numbers", factory: () => import("./pages/tools/PageNumbers") },
  { path: "/tools/watermark", factory: () => import("./pages/tools/Watermark") },
  { path: "/tools/remove-pages", factory: () => import("./pages/tools/RemovePages") },
  { path: "/tools/extract-pages", factory: () => import("./pages/tools/ExtractPages") },
  { path: "/tools/organize-pages", factory: () => import("./pages/tools/OrganizePages") },
  { path: "/tools/unlock", factory: () => import("./pages/tools/UnlockPdf") },
  { path: "/tools/protect", factory: () => import("./pages/tools/ProtectPdf") },
  { path: "/tools/sign", factory: () => import("./pages/tools/SignPdf") },
  { path: "/tools/pdf-to-word", factory: () => import("./pages/tools/PdfToWord") },
  { path: "/tools/word-to-pdf", factory: () => import("./pages/tools/WordToPdf") },
  { path: "/tools/crop", factory: () => import("./pages/tools/CropPdf") },
  { path: "/tools/redact", factory: () => import("./pages/tools/RedactPdf") },
  { path: "/tools/compare", factory: () => import("./pages/tools/ComparePdf") },
  { path: "/tools/copy-pdf", factory: () => import("./pages/tools/CopyPdf") },
  { path: "/tools/scan-to-pdf", factory: () => import("./pages/tools/ScanToPdf") },
  { path: "/tools/repair", factory: () => import("./pages/tools/RepairPdf") },
  { path: "/tools/ocr", factory: () => import("./pages/tools/OcrPdf") },
  { path: "/tools/excel-to-pdf", factory: () => import("./pages/tools/ExcelToPdf") },
  { path: "/tools/ppt-to-pdf", factory: () => import("./pages/tools/PptToPdf") },
  { path: "/tools/pdf-to-excel", factory: () => import("./pages/tools/PdfToExcel") },
  { path: "/tools/edit-pdf", factory: () => import("./pages/tools/EditPdf") },
  { path: "/tools/pdf-filler", factory: () => import("./pages/tools/PdfFiller") },
  { path: "/tools/html-to-pdf", factory: () => import("./pages/tools/HtmlToPdf") },
  { path: "/tools/office-to-pdf", factory: () => import("./pages/tools/OfficeToPdf") },
  { path: "/tools/pdf-to-word-ocr", factory: () => import("./pages/tools/PdfToWordOcr") },
  { path: "/tools/pdf-to-excel-ocr", factory: () => import("./pages/tools/PdfToExcelOcr") },
  { path: "/tools/pdf-to-ppt", factory: () => import("./pages/tools/PdfToPpt") },
  { path: "/tools/pdf-to-pdfa", factory: () => import("./pages/tools/PdfToPdfa") },
  { path: "/tools/workflow", factory: () => import("./pages/tools/Workflow") },
] as const;

const staticRoutes = [
  { path: "/contact", factory: () => import("./pages/Contact") },
  { path: "/faq", factory: () => import("./pages/FAQ") },
  { path: "/privacy", factory: () => import("./pages/PrivacyPolicy") },
  { path: "/terms", factory: () => import("./pages/TermsOfService") },
] as const;

// Pre-create lazy components so React can cache them
const lazyComponents = [...toolRoutes, ...staticRoutes].map(route => ({
  path: route.path,
  Component: lazy(route.factory),
}));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ScrollToTop />
          <Suspense fallback={<LoadingSpinner />}>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Index />} />
                {lazyComponents.map(({ path, Component }) => (
                  <Route key={path} path={path} element={<Component />} />
                ))}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
