import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createReadStream } from 'fs';
import path from 'path';

const isS3Configured =
  !!process.env.STORAGE_ENDPOINT &&
  !!process.env.STORAGE_ACCESS_KEY &&
  !!process.env.STORAGE_SECRET_KEY &&
  !!process.env.STORAGE_BUCKET;

let s3Client: S3Client | null = null;
if (isS3Configured) {
  s3Client = new S3Client({
    endpoint: process.env.STORAGE_ENDPOINT,
    region: process.env.STORAGE_REGION ?? 'auto',
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY!,
      secretAccessKey: process.env.STORAGE_SECRET_KEY!,
    },
    forcePathStyle: process.env.STORAGE_PATH_STYLE === 'true',
  });
}

export async function uploadFile(
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<string> {
  const ext = path.extname(originalName) || '.jpg';
  const key = `uploads/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  if (s3Client && process.env.STORAGE_BUCKET) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.STORAGE_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: mimeType,
        ACL: 'public-read' as never,
      })
    );

    const publicUrl = process.env.STORAGE_PUBLIC_URL;
    if (publicUrl) return `${publicUrl}/${key}`;
    return `${process.env.STORAGE_ENDPOINT}/${process.env.STORAGE_BUCKET}/${key}`;
  }

  // 로컬 폴백: 파일 저장 후 서빙 URL 반환
  const { writeFile } = await import('fs/promises');
  const localPath = path.join(process.cwd(), 'uploads', path.basename(key));
  await writeFile(localPath, buffer);

  const baseUrl = process.env.API_BASE_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
  return `${baseUrl}/uploads/${path.basename(key)}`;
}
