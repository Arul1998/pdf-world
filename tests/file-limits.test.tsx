// jsdom cannot render PDFs; these tests exercise page controls and input validation.
vi.mock('../src/lib/pdf/pdfjs-setup', () => ({ pdfjsLib: {} }));
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FileDropZone } from '../src/components/FileDropZone';
afterEach(cleanup);
test('rejects a batch whose total exceeds the configured memory budget', async () => {
  const change = vi.fn();
  const { container } = render(<FileDropZone accept={['.txt']} files={[]} onFilesChange={change} maxTotalSize={5} />);
  fireEvent.change(container.querySelector('input')!, { target: { files: [new File(['123'], 'a.txt'), new File(['456'], 'b.txt')] } });
  expect(await screen.findByText(/combined file size/i)).toBeTruthy();
  expect(change).not.toHaveBeenCalled();
});
test('includes existing files in the batch size limit', async () => {
  const change = vi.fn();
  const existing = new File(['1234'], 'a.txt');
  const { container } = render(<FileDropZone accept={['.txt']} files={[{ id: 'a', name: 'a.txt', file: existing, size: 4 }]} onFilesChange={change} maxTotalSize={5} />);
  fireEvent.change(container.querySelector('input')!, { target: { files: [new File(['12'], 'b.txt')] } });
  expect(await screen.findByText(/combined file size/i)).toBeTruthy();
  expect(change).not.toHaveBeenCalled();
});
