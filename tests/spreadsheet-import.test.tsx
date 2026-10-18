import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JSZip from 'jszip';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
vi.mock('../src/lib/pdf/pdfjs-setup', () => ({ pdfjsLib: {} }));
vi.mock('../src/lib/pdf/pdf-core', async importOriginal => ({ ...await importOriginal<object>(), downloadBlob: vi.fn() }));
import { downloadBlob } from '../src/lib/pdf/pdf-core';
import ExcelToPdf from '../src/pages/tools/ExcelToPdf';
afterEach(cleanup);
test('spreadsheet import still exports sheet labels and numeric cells after the parser upgrade', async () => {
  // Hand-written OOXML fixture avoids computing expected data with SheetJS.
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sales" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/worksheets/sheet1.xml', '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Amount</t></is></c></row><row r="2"><c r="A2"><v>123.45</v></c></row></sheetData></worksheet>');
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  const file = new File([new Uint8Array(bytes)], 'sales.xlsx');
  // jsdom omits Blob.arrayBuffer, which real browsers provide.
  Object.defineProperty(file, 'arrayBuffer', { value: async () => new Uint8Array(bytes).buffer });
  const view = render(<MemoryRouter><ExcelToPdf /></MemoryRouter>);
  fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files: [file] } });
  await screen.findByText('sales.xlsx');
  fireEvent.click(screen.getByRole('button', { name: /^convert to pdf$/i }));
  await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
  const dir = mkdtempSync(join(tmpdir(), 'spreadsheet-output-'));
  try {
    const path = join(dir, 'sales.pdf');
    writeFileSync(path, vi.mocked(downloadBlob).mock.calls[0][0] as Uint8Array);
    const text = execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' });
    for (const value of ['Sheet: Sales', 'Amount', '123.45']) expect(text).toContain(value);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
