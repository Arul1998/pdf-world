import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { MemoryRouter } from 'react-router-dom';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() } }));
vi.mock('../src/lib/pdf/pdfjs-setup', () => ({ pdfjsLib: {} }));
// Thumbnail rendering needs a browser canvas; keep file validation and password
// operations real and only skip this unrelated preview rendering.
vi.mock('../src/lib/pdf/pdf-render', async importOriginal => ({
  ...await importOriginal<object>(), generatePdfThumbnail: async () => '',
}));
vi.mock('../src/lib/pdf/pdf-core', async importOriginal => ({
  ...await importOriginal<object>(), downloadBlob: vi.fn(),
}));
import { downloadBlob } from '../src/lib/pdf/pdf-core';
import UnlockPdf from '../src/pages/tools/UnlockPdf';
import ProtectPdf from '../src/pages/tools/ProtectPdf';
afterEach(() => { cleanup(); vi.mocked(downloadBlob).mockClear(); vi.mocked(toast.error).mockClear(); });
async function file(name = 'same.pdf') {
  const doc = await PDFDocument.create(); doc.addPage([200, 300]);
  return new File([new Uint8Array(await doc.save())], name);
}
async function select(element: React.ReactNode, files: File[]) {
  const view = render(<MemoryRouter>{element}</MemoryRouter>);
  fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files } });
  await waitFor(() => expect(screen.queryByText(/processing files/i)).toBeNull());
  await screen.findAllByText(files[0].name);
  return view;
}
test('unlocking an entirely failed batch never shows a success result', async () => {
  await select(<UnlockPdf />, [new File(['broken'], 'bad.pdf'), new File(['broken'], 'other.pdf')]);
  fireEvent.change(screen.getByLabelText('PDF Password'), { target: { value: 'Correct-123!' } });
  fireEvent.click(screen.getByRole('button', { name: /unlock.*download zip/i }));
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
  expect(screen.queryByText(/PDFs? unlocked!/i)).toBeNull();
  expect(downloadBlob).not.toHaveBeenCalled();
});
test('unlocking a partial batch reports only downloaded successes', async () => {
  await select(<UnlockPdf />, [await file(), new File(['broken'], 'bad.pdf')]);
  fireEvent.change(screen.getByLabelText('PDF Password'), { target: { value: 'Correct-123!' } });
  fireEvent.click(screen.getByRole('button', { name: /unlock.*download zip/i }));
  expect(await screen.findByText('1 PDF unlocked!')).toBeTruthy();
  expect(screen.getByText(/1.*failed/i)).toBeTruthy();
  const bytes = vi.mocked(downloadBlob).mock.calls[0][0] as Uint8Array;
  const zip = await JSZip.loadAsync(bytes);
  expect(zip.file('same_unlocked.pdf')).not.toBeNull();
  expect(JSON.parse(await zip.file('_conversion-results.json')!.async('string'))).toMatchObject({ succeeded: 1, failed: 1 });
});
test('protection batches retain files with identical output names', async () => {
  await select(<ProtectPdf />, [await file(), await file()]);
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Correct-123!' } });
  fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'Correct-123!' } });
  fireEvent.click(screen.getByRole('button', { name: /protect.*download zip/i }));
  await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
  const zip = await JSZip.loadAsync(vi.mocked(downloadBlob).mock.calls[0][0] as Uint8Array);
  expect(zip.file('same_protected.pdf')).not.toBeNull();
  expect(zip.file('same_protected_2.pdf')).not.toBeNull();
});
