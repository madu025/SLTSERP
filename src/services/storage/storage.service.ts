import { getS3Client, getS3Config } from '@/lib/s3-client';
import path from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';

export interface UploadFileInput {
    fileBuffer: Buffer;
    fileName: string;
    mimeType?: string;
    folder?: string;
    bucket?: string;
}

export interface UploadFileResult {
    success: boolean;
    /** Authenticated application download URL. */
    url: string;
    key: string;
    filename: string;
    size: number;
    mimeType: string;
    storage: 's3' | 'local';
}

function requiresCoolifyStorage(): boolean {
    return process.env.NODE_ENV === 'production' || process.env.STORAGE_REQUIRE_S3 === 'true';
}

function storageNotConfiguredError(): Error {
    return new Error(
        'Coolify S3/MinIO storage is not configured. Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, and S3_SECRET_KEY before uploading files.'
    );
}

function storageUrl(key: string): string {
    const encodedKey = key.split('/').map(encodeURIComponent).join('/');
    return `/api/storage/${encodedKey}`;
}

export class StorageService {
    /**
     * Store every production upload in the configured Coolify S3-compatible
     * service (MinIO/R2/S3). Local storage is an explicit development-only
     * fallback and is never silently used in production.
     */
    static async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
        const { fileBuffer, fileName, mimeType = 'application/octet-stream', folder = 'documents' } = input;

        const ext = (path.extname(fileName) || '.bin').toLowerCase();
        const baseCleanName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const uniqueFileName = `${timestamp}-${randomStr}-${baseCleanName}${ext}`;
        const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
        const key = `${cleanFolder}/${uniqueFileName}`;

        const s3 = getS3Client();
        const s3Config = getS3Config();

        if (s3 && s3Config) {
            const targetBucket = input.bucket || s3Config.bucket;
            try {
                await s3.putObject({
                    bucket: targetBucket,
                    key,
                    body: fileBuffer,
                    contentType: mimeType,
                });

                return {
                    success: true,
                    url: storageUrl(key),
                    key,
                    filename: uniqueFileName,
                    size: fileBuffer.length,
                    mimeType,
                    storage: 's3',
                };
            } catch (s3Error: unknown) {
                const errMsg = s3Error instanceof Error ? s3Error.message : String(s3Error);
                console.error('[STORAGE-SERVICE] Coolify S3/MinIO upload failed:', errMsg);
                throw new Error(`Coolify storage upload failed: ${errMsg}`);
            }
        }

        if (requiresCoolifyStorage()) {
            throw storageNotConfiguredError();
        }

        // Development-only fallback. Production must never split files across
        // local disk, Supabase, and object storage.
        if (process.env.STORAGE_ALLOW_LOCAL_FALLBACK !== 'true') {
            throw storageNotConfiguredError();
        }

        const uploadDir = path.join(process.cwd(), 'public', 'uploads', cleanFolder);
        if (!existsSync(uploadDir)) {
            await mkdir(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, uniqueFileName);
        await writeFile(filePath, fileBuffer);

        return {
            success: true,
            url: `/api/files/${cleanFolder}/${uniqueFileName}`,
            key,
            filename: uniqueFileName,
            size: fileBuffer.length,
            mimeType,
            storage: 'local',
        };
    }

    /** Download an object for server-side processing or authenticated streaming. */
    static async downloadFile(key: string, bucket?: string): Promise<{ body: Buffer; contentType?: string; contentLength?: number }> {
        const s3 = getS3Client();
        const s3Config = getS3Config();
        if (!s3 || !s3Config) {
            throw storageNotConfiguredError();
        }

        return s3.getObject({
            bucket: bucket || s3Config.bucket,
            key: key.replace(/^\/+/, ''),
        });
    }

    /** Delete an object from Coolify S3/MinIO. */
    static async deleteFile(key: string, bucket?: string): Promise<boolean> {
        const s3 = getS3Client();
        const s3Config = getS3Config();

        if (!s3 || !s3Config) {
            if (requiresCoolifyStorage()) throw storageNotConfiguredError();
            return false;
        }

        try {
            await s3.deleteObject({
                bucket: bucket || s3Config.bucket,
                key: key.replace(/^\/+/, ''),
            });
            return true;
        } catch (err: unknown) {
            console.error('[STORAGE-SERVICE] Failed to delete Coolify S3/MinIO file:', err);
            return false;
        }
    }
}
