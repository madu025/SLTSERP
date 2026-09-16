import { getS3Client, getS3Config } from '@/lib/s3-client';
import { supabase } from '@/lib/supabase/client';
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
    url: string;
    key: string;
    filename: string;
    size: number;
    mimeType: string;
    storage: 's3' | 'supabase' | 'local';
}

export class StorageService {
    /**
     * Upload a file to S3 storage with automatic fallback to Supabase / Local storage.
     */
    static async uploadFile(input: UploadFileInput): Promise<UploadFileResult> {
        const { fileBuffer, fileName, mimeType = 'application/octet-stream', folder = 'documents' } = input;
        
        // Generate a clean, unique object key
        const ext = (path.extname(fileName) || '.jpg').toLowerCase();
        const baseCleanName = path.basename(fileName, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const uniqueFileName = `${timestamp}-${randomStr}-${baseCleanName}${ext}`;
        const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
        const key = `${cleanFolder}/${uniqueFileName}`;

        // 1. Try Primary S3 Storage
        const s3 = getS3Client();
        const s3Config = getS3Config();

        if (s3 && s3Config) {
            const targetBucket = input.bucket || s3Config.bucket;
            try {
                const s3Result = await s3.putObject({
                    bucket: targetBucket,
                    key,
                    body: fileBuffer,
                    contentType: mimeType,
                });

                const publicPrefix = s3Config.publicUrlPrefix.replace(/\/+$/, '');
                const fileUrl = s3Result.url || `${publicPrefix}/${key}`;

                return {
                    success: true,
                    url: fileUrl,
                    key,
                    filename: uniqueFileName,
                    size: fileBuffer.length,
                    mimeType,
                    storage: 's3'
                };
            } catch (s3Error: unknown) {
                const errMsg = s3Error instanceof Error ? s3Error.message : String(s3Error);
                console.warn('[STORAGE-SERVICE] S3 upload failed, attempting fallback:', errMsg);
            }
        }

        // 2. Fallback to Supabase Storage
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

        if (supabaseKey && supabaseUrl) {
            try {
                const targetBucket = input.bucket || 'grn-documents';
                const { error: supError } = await supabase.storage
                    .from(targetBucket)
                    .upload(uniqueFileName, fileBuffer, {
                        contentType: mimeType,
                        upsert: true
                    });

                if (!supError) {
                    const { data: publicUrlData } = supabase.storage
                        .from(targetBucket)
                        .getPublicUrl(uniqueFileName);

                    return {
                        success: true,
                        url: publicUrlData.publicUrl,
                        key: uniqueFileName,
                        filename: uniqueFileName,
                        size: fileBuffer.length,
                        mimeType,
                        storage: 'supabase'
                    };
                } else {
                    console.warn('[STORAGE-SERVICE] Supabase storage upload failed:', supError.message);
                }
            } catch (supErr: unknown) {
                const errMsg = supErr instanceof Error ? supErr.message : String(supErr);
                console.warn('[STORAGE-SERVICE] Supabase storage exception:', errMsg);
            }
        }

        // 3. Fallback to Local Filesystem
        try {
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
                storage: 'local'
            };
        } catch (localErr: unknown) {
            const msg = localErr instanceof Error ? localErr.message : String(localErr);
            throw new Error(`Failed to store document in any storage provider: ${msg}`);
        }
    }

    /**
     * Delete a file from S3 Storage.
     */
    static async deleteFile(key: string, bucket?: string): Promise<boolean> {
        const s3 = getS3Client();
        const s3Config = getS3Config();

        if (s3 && s3Config) {
            try {
                await s3.deleteObject({
                    bucket: bucket || s3Config.bucket,
                    key,
                });
                return true;
            } catch (err: unknown) {
                console.error('[STORAGE-SERVICE] Failed to delete S3 file:', err);
                return false;
            }
        }
        return false;
    }
}
