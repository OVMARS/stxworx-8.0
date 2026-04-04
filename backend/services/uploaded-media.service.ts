import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const MAX_MEDIA_SIZE_BYTES = 10 * 1024 * 1024;

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
};

const EXTENSION_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  zip: 'application/zip',
};

export type UploadedMediaInput = {
  dataUrl: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export type SavedUploadedMedia = {
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
};

export type UploadedMediaDirectory = 'jobs' | 'proposals';

function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const parts = normalized.split('.');
  return parts.length > 1 ? parts.at(-1) || '' : '';
}

function sanitizeBaseName(fileName: string) {
  const extension = getFileExtension(fileName);
  const suffix = extension ? `.${extension}` : '';
  const baseName = (suffix ? fileName.slice(0, -suffix.length) : fileName)
    .trim()
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  return baseName || 'upload';
}

function parseUploadedMedia(upload: UploadedMediaInput) {
  const match = upload.dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error('Unsupported media payload');
  }

  const declaredMimeType = upload.mimeType.trim().toLowerCase();
  const payloadMimeType = match[1].trim().toLowerCase();
  const base64Payload = match[2];

  if (declaredMimeType && payloadMimeType !== declaredMimeType) {
    throw new Error('Uploaded media payload does not match its MIME type');
  }

  const buffer = Buffer.from(base64Payload, 'base64');
  if (!buffer.length) {
    throw new Error('Uploaded media payload is empty');
  }

  if (!Number.isFinite(upload.size) || upload.size <= 0 || upload.size > MAX_MEDIA_SIZE_BYTES) {
    throw new Error('Uploaded media is too large');
  }

  if (buffer.length !== upload.size) {
    throw new Error('Uploaded media size metadata does not match the payload');
  }

  const fileExtension = getFileExtension(upload.fileName);
  const safeMimeType = declaredMimeType || payloadMimeType;
  let extension = MIME_EXTENSION_MAP[safeMimeType] || '';
  let mimeType = safeMimeType;

  if (!extension && safeMimeType === 'application/octet-stream' && fileExtension) {
    const fallbackMimeType = EXTENSION_MIME_MAP[fileExtension];
    if (fallbackMimeType) {
      extension = fileExtension === 'jpeg' ? 'jpg' : fileExtension;
      mimeType = fallbackMimeType;
    }
  }

  if (!extension && fileExtension && EXTENSION_MIME_MAP[fileExtension] === safeMimeType) {
    extension = fileExtension === 'jpeg' ? 'jpg' : fileExtension;
  }

  if (!extension || !mimeType) {
    throw new Error('Unsupported uploaded media type');
  }

  return {
    buffer,
    extension,
    mimeType,
  };
}

export async function saveUploadedMedia(upload: UploadedMediaInput, directory: UploadedMediaDirectory): Promise<SavedUploadedMedia> {
  const { buffer, extension, mimeType } = parseUploadedMedia(upload);
  const uploadRoot = path.resolve(process.cwd(), 'uploads', directory);
  await mkdir(uploadRoot, { recursive: true });

  const baseName = sanitizeBaseName(upload.fileName);
  const fileName = `${Date.now()}-${randomUUID()}-${baseName}.${extension}`;
  const filePath = path.join(uploadRoot, fileName);
  await writeFile(filePath, buffer);

  return {
    url: `/uploads/${directory}/${fileName}`,
    fileName: upload.fileName.trim() || fileName,
    mimeType,
    size: buffer.length,
  };
}
