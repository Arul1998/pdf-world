// Centralised pdf.js setup for Vite.
//
// The rest of the app must import pdf.js from THIS module (never from
// `pdfjs-dist/webpack.mjs`, which is a webpack-only build whose worker does not
// resolve under Vite and causes `getDocument` to hang).
//
// Using Vite's `?worker` suffix lets Vite bundle the worker correctly for both
// the dev server and production builds, and we hand it to pd.js as a
// `workerPort` so no fragile URL/`workerSrc` juggling is needed.
import * as pdfjsLib from 'pdfjs-dist';
// eslint-disable-next-line import/no-unresolved
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerPort) {
  pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();
}

export { pdfjsLib };
export default pdfjsLib;
