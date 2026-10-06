// jsdom cannot render PDFs; these tests exercise page controls and input validation.
vi.mock('../src/lib/pdf/pdfjs-setup', () => ({ pdfjsLib: {} }));
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PdfToPdfa from '../src/pages/tools/PdfToPdfa';
import OfficeToPdf from '../src/pages/tools/OfficeToPdf';
afterEach(cleanup);
const wrap = (element: React.ReactNode) => render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>{element}</MemoryRouter>);
test('PDF/A does not offer a simulated archival conversion', () => {
  wrap(<PdfToPdfa />);
  expect(screen.getByRole('status')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /convert to pdf\/a/i })).toBeNull();
});
test('Office route points to dedicated tools rather than generating placeholder slides', () => {
  wrap(<OfficeToPdf />);
  expect(screen.getByRole('link', { name: /powerpoint text to pdf/i }).getAttribute('href')).toBe('/tools/ppt-to-pdf');
  expect(screen.queryByRole('button', { name: /^convert to pdf$/i })).toBeNull();
});
