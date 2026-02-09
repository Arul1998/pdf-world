import JSZip from 'jszip';

export interface PDFFile {
  id: string;
  name: string;
  file: File;
  pageCount?: number;
  size: number;
  thumbnail?: string;
}

export const generateId = () => Math.random().toString(36).substring(2, 9);

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const readFileAsDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const downloadBlob = (data: Uint8Array | string, filename: string, mimeType: string = 'application/pdf') => {
  let blob: Blob;

  if (typeof data === 'string') {
    const byteString = atob(data.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    blob = new Blob([ab], { type: mimeType });
  } else {
    blob = new Blob([new Uint8Array(data)], { type: mimeType });
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadMultiple = async (files: { data: Uint8Array | string; name: string; mimeType?: string }[]) => {
  const zip = new JSZip();

  for (const file of files) {
    if (typeof file.data === 'string') {
      const base64 = file.data.split(',')[1];
      zip.file(file.name, base64, { base64: true });
    } else {
      zip.file(file.name, file.data);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `pdf-world-${new Date().toISOString().split('T')[0]}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
