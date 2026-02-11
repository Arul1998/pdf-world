import * as pdfjsLib from 'pdfjs-dist/webpack.mjs';
import { readFileAsArrayBuffer } from './pdf-core';

export type TextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontName: string;
};

export type PageText = {
  pageIndex: number;
  items: TextItem[];
  fullText: string;
};

export type DiffChange = {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
};

export type PageDiff = {
  pageIndex: number;
  changes: DiffChange[];
  addedCount: number;
  removedCount: number;
};

export type CompareResult = {
  pages: PageDiff[];
  totalChanges: number;
  text1Pages: PageText[];
  text2Pages: PageText[];
};

/** Extract text content from all pages of a PDF */
export const extractPdfText = async (
  file: File,
  onProgress?: (page: number, total: number) => void
): Promise<PageText[]> => {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  try {
    const pages: PageText[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      onProgress?.(i, pdf.numPages);
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });

      const items: TextItem[] = textContent.items
        .filter((item: any) => item.str && item.str.trim())
        .map((item: any) => ({
          text: item.str,
          x: item.transform[4],
          y: viewport.height - item.transform[5],
          width: item.width,
          height: item.height,
          fontName: item.fontName || '',
        }));

      const fullText = textContent.items
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      pages.push({ pageIndex: i - 1, items, fullText });
    }

    return pages;
  } finally {
    pdf.destroy();
  }
};

/** Simple word-level diff algorithm */
export const diffWords = (oldText: string, newText: string): DiffChange[] => {
  const oldWords = oldText.split(/\s+/).filter(Boolean);
  const newWords = newText.split(/\s+/).filter(Boolean);

  // LCS-based diff
  const m = oldWords.length;
  const n = newWords.length;

  // Optimization: if texts are identical, skip
  if (oldText === newText) {
    return [{ type: 'unchanged', value: oldText }];
  }

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to get diff
  const changes: DiffChange[] = [];
  let i = m, j = n;

  const tempChanges: DiffChange[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      tempChanges.push({ type: 'unchanged', value: oldWords[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tempChanges.push({ type: 'added', value: newWords[j - 1] });
      j--;
    } else {
      tempChanges.push({ type: 'removed', value: oldWords[i - 1] });
      i--;
    }
  }

  tempChanges.reverse();

  // Merge consecutive same-type changes
  for (const change of tempChanges) {
    if (changes.length > 0 && changes[changes.length - 1].type === change.type) {
      changes[changes.length - 1].value += ' ' + change.value;
    } else {
      changes.push({ ...change });
    }
  }

  return changes;
};

/** Compare two PDFs and produce a diff result */
export const comparePdfTexts = async (
  file1: File,
  file2: File,
  onProgress?: (progress: number) => void
): Promise<CompareResult> => {
  onProgress?.(10);
  const [text1Pages, text2Pages] = await Promise.all([
    extractPdfText(file1),
    extractPdfText(file2),
  ]);
  onProgress?.(50);

  const maxPages = Math.max(text1Pages.length, text2Pages.length);
  const pages: PageDiff[] = [];
  let totalChanges = 0;

  for (let i = 0; i < maxPages; i++) {
    const oldText = text1Pages[i]?.fullText || '';
    const newText = text2Pages[i]?.fullText || '';
    const changes = diffWords(oldText, newText);

    const addedCount = changes.filter(c => c.type === 'added').length;
    const removedCount = changes.filter(c => c.type === 'removed').length;
    totalChanges += addedCount + removedCount;

    pages.push({ pageIndex: i, changes, addedCount, removedCount });
    onProgress?.(50 + ((i + 1) / maxPages) * 50);
  }

  return { pages, totalChanges, text1Pages, text2Pages };
};

/** Render overlay of two PDF pages — original in grey, differences in red */
export const renderOverlayPage = async (
  file1: File,
  file2: File,
  pageIndex: number,
  scale: number = 1.5
): Promise<string> => {
  const [ab1, ab2] = await Promise.all([
    readFileAsArrayBuffer(file1),
    readFileAsArrayBuffer(file2),
  ]);

  const [pdf1, pdf2] = await Promise.all([
    pdfjsLib.getDocument({ data: ab1 }).promise,
    pdfjsLib.getDocument({ data: ab2 }).promise,
  ]);

  try {
    const pageNum = pageIndex + 1;

    // Get dimensions from whichever PDF has this page
    const hasPage1 = pageNum <= pdf1.numPages;
    const hasPage2 = pageNum <= pdf2.numPages;
    if (!hasPage1 && !hasPage2) return '';

    const refPage = hasPage1 ? await pdf1.getPage(pageNum) : await pdf2.getPage(pageNum);
    const viewport = refPage.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d')!;

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Render original page (faded)
    if (hasPage1) {
      const page1 = await pdf1.getPage(pageNum);
      const vp1 = page1.getViewport({ scale });
      const tempCanvas1 = document.createElement('canvas');
      tempCanvas1.width = vp1.width;
      tempCanvas1.height = vp1.height;
      const tempCtx1 = tempCanvas1.getContext('2d')!;
      await page1.render({ canvasContext: tempCtx1, viewport: vp1, canvas: tempCanvas1 }).promise;

      ctx.globalAlpha = 0.3;
      ctx.drawImage(tempCanvas1, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;
    }

    // Render modified page on top
    if (hasPage2) {
      const page2 = await pdf2.getPage(pageNum);
      const vp2 = page2.getViewport({ scale });
      const tempCanvas2 = document.createElement('canvas');
      tempCanvas2.width = vp2.width;
      tempCanvas2.height = vp2.height;
      const tempCtx2 = tempCanvas2.getContext('2d')!;
      await page2.render({ canvasContext: tempCtx2, viewport: vp2, canvas: tempCanvas2 }).promise;

      // Get pixel data from both to find differences
      if (hasPage1) {
        const page1 = await pdf1.getPage(pageNum);
        const vp1 = page1.getViewport({ scale });
        const diffCanvas = document.createElement('canvas');
        diffCanvas.width = vp1.width;
        diffCanvas.height = vp1.height;
        const diffCtx = diffCanvas.getContext('2d')!;
        await page1.render({ canvasContext: diffCtx, viewport: vp1, canvas: diffCanvas }).promise;

        const origData = diffCtx.getImageData(0, 0, diffCanvas.width, diffCanvas.height);
        const modData = tempCtx2.getImageData(0, 0, tempCanvas2.width, tempCanvas2.height);

        const w = Math.min(origData.width, modData.width);
        const h = Math.min(origData.height, modData.height);

        const resultData = ctx.createImageData(w, h);

        for (let p = 0; p < w * h * 4; p += 4) {
          const dr = Math.abs(origData.data[p] - modData.data[p]);
          const dg = Math.abs(origData.data[p + 1] - modData.data[p + 1]);
          const db = Math.abs(origData.data[p + 2] - modData.data[p + 2]);
          const diff = dr + dg + db;

          if (diff > 30) {
            // Difference pixel — show in red
            resultData.data[p] = 220;
            resultData.data[p + 1] = 38;
            resultData.data[p + 2] = 38;
            resultData.data[p + 3] = 255;
          } else {
            // No difference — show modified content at reduced opacity
            resultData.data[p] = modData.data[p];
            resultData.data[p + 1] = modData.data[p + 1];
            resultData.data[p + 2] = modData.data[p + 2];
            resultData.data[p + 3] = 120;
          }
        }

        // Clear and draw result
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(resultData, 0, 0);
      } else {
        // Only modified page exists — draw normally
        ctx.drawImage(tempCanvas2, 0, 0, canvas.width, canvas.height);
      }
    }

    return canvas.toDataURL('image/png');
  } finally {
    pdf1.destroy();
    pdf2.destroy();
  }
};
