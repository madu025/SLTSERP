import crypto from 'crypto';

export interface S3Config {
    endpoint: string;
    bucket: string;
    region: string;
    accessKey: string;
    secretKey: string;
    forcePathStyle: boolean;
    publicUrlPrefix: string;
}

export interface PutObjectOptions {
    bucket?: string;
    key: string;
    body: Buffer;
    contentType?: string;
}

export interface DeleteObjectOptions {
    bucket?: string;
    key: string;
}

export interface S3OperationResult {
    success: boolean;
    url?: string;
    error?: string;
}

/**
 * Pure Node.js S3 Client with AWS Signature Version 4.
 * Zero external dependencies (eliminates @aws-sdk bundle weight and npm lockfile conflicts).
 */
export class NativeS3Client {
    private readonly config: S3Config;

    constructor(config: S3Config) {
        this.config = config;
    }

    private hmacSha256(key: Buffer | string, data: string): Buffer {
        return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
    }

    private sha256Hex(data: Buffer | string): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    private getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Buffer {
        const kDate = this.hmacSha256(`AWS4${key}`, dateStamp);
        const kRegion = this.hmacSha256(kDate, regionName);
        const kService = this.hmacSha256(kRegion, serviceName);
        return this.hmacSha256(kService, 'aws4_request');
    }

    /**
     * Upload an object to S3 / MinIO storage.
     */
    async putObject(options: PutObjectOptions): Promise<S3OperationResult> {
        const bucket = options.bucket || this.config.bucket;
        const cleanKey = options.key.replace(/^\/+/, '');
        const contentType = options.contentType || 'application/octet-stream';
        const body = options.body;

        const endpointUrl = new URL(this.config.endpoint);
        const host = endpointUrl.host;
        const port = endpointUrl.port;
        const protocol = endpointUrl.protocol;

        // Path-style: /bucket/key vs Virtual-hosted style: key with bucket.host
        let pathname = `/${bucket}/${cleanKey}`;
        let requestHost = host;

        if (!this.config.forcePathStyle) {
            requestHost = `${bucket}.${host}`;
            pathname = `/${cleanKey}`;
        }

        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
        const dateStamp = amzDate.substring(0, 8);
        const contentHash = this.sha256Hex(body);

        const canonicalUri = pathname.split('/').map(segment => encodeURIComponent(segment)).join('/');
        const canonicalQuery = '';

        const headersToSign: Record<string, string> = {
            'content-type': contentType,
            'host': requestHost + (port && !host.includes(':') ? `:${port}` : ''),
            'x-amz-content-sha256': contentHash,
            'x-amz-date': amzDate,
        };

        const sortedHeaderKeys = Object.keys(headersToSign).sort();
        const canonicalHeaders = sortedHeaderKeys.map(k => `${k}:${headersToSign[k]}\n`).join('');
        const signedHeaders = sortedHeaderKeys.join(';');

        const canonicalRequest = [
            'PUT',
            canonicalUri,
            canonicalQuery,
            canonicalHeaders,
            signedHeaders,
            contentHash
        ].join('\n');

        const algorithm = 'AWS4-HMAC-SHA256';
        const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
        const stringToSign = [
            algorithm,
            amzDate,
            credentialScope,
            this.sha256Hex(canonicalRequest)
        ].join('\n');

        const signingKey = this.getSignatureKey(this.config.secretKey, dateStamp, this.config.region, 's3');
        const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

        const authorizationHeader = `${algorithm} Credential=${this.config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const fullUrl = `${protocol}//${requestHost}${canonicalUri}`;

        const response = await fetch(fullUrl, {
            method: 'PUT',
            headers: {
                ...headersToSign,
                'Authorization': authorizationHeader,
                'Content-Length': String(body.length),
            },
            body: new Uint8Array(body),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`S3 PutObject failed [${response.status} ${response.statusText}]: ${errorText.substring(0, 200)}`);
        }

        const publicPrefix = this.config.publicUrlPrefix.replace(/\/+$/, '');
        const publicUrl = `${publicPrefix}/${cleanKey}`;

        return {
            success: true,
            url: publicUrl,
        };
    }

    /**
     * Delete an object from S3 / MinIO storage.
     */
    async deleteObject(options: DeleteObjectOptions): Promise<S3OperationResult> {
        const bucket = options.bucket || this.config.bucket;
        const cleanKey = options.key.replace(/^\/+/, '');

        const endpointUrl = new URL(this.config.endpoint);
        const host = endpointUrl.host;
        const port = endpointUrl.port;
        const protocol = endpointUrl.protocol;

        let pathname = `/${bucket}/${cleanKey}`;
        let requestHost = host;

        if (!this.config.forcePathStyle) {
            requestHost = `${bucket}.${host}`;
            pathname = `/${cleanKey}`;
        }

        const now = new Date();
        const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
        const dateStamp = amzDate.substring(0, 8);
        const contentHash = this.sha256Hex('');

        const canonicalUri = pathname.split('/').map(segment => encodeURIComponent(segment)).join('/');
        const canonicalQuery = '';

        const headersToSign: Record<string, string> = {
            'host': requestHost + (port && !host.includes(':') ? `:${port}` : ''),
            'x-amz-content-sha256': contentHash,
            'x-amz-date': amzDate,
        };

        const sortedHeaderKeys = Object.keys(headersToSign).sort();
        const canonicalHeaders = sortedHeaderKeys.map(k => `${k}:${headersToSign[k]}\n`).join('');
        const signedHeaders = sortedHeaderKeys.join(';');

        const canonicalRequest = [
            'DELETE',
            canonicalUri,
            canonicalQuery,
            canonicalHeaders,
            signedHeaders,
            contentHash
        ].join('\n');

        const algorithm = 'AWS4-HMAC-SHA256';
        const credentialScope = `${dateStamp}/${this.config.region}/s3/aws4_request`;
        const stringToSign = [
            algorithm,
            amzDate,
            credentialScope,
            this.sha256Hex(canonicalRequest)
        ].join('\n');

        const signingKey = this.getSignatureKey(this.config.secretKey, dateStamp, this.config.region, 's3');
        const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex');

        const authorizationHeader = `${algorithm} Credential=${this.config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

        const fullUrl = `${protocol}//${requestHost}${canonicalUri}`;

        const response = await fetch(fullUrl, {
            method: 'DELETE',
            headers: {
                ...headersToSign,
                'Authorization': authorizationHeader,
            },
        });

        if (!response.ok && response.status !== 404) {
            const errorText = await response.text();
            throw new Error(`S3 DeleteObject failed [${response.status} ${response.statusText}]: ${errorText.substring(0, 200)}`);
        }

        return { success: true };
    }
}

let cachedClient: NativeS3Client | null = null;
let cachedConfig: S3Config | null = null;

export function getS3Config(): S3Config | null {
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET || 'sltserp-documents';
    const accessKey = process.env.S3_ACCESS_KEY;
    const secretKey = process.env.S3_SECRET_KEY;

    if (!endpoint || !accessKey || !secretKey) {
        return null;
    }

    const region = process.env.S3_REGION || 'ap-southeast-1';
    const forcePathStyle = process.env.S3_FORCE_PATH_STYLE !== 'false';
    const publicUrlPrefix = process.env.S3_PUBLIC_URL_PREFIX || `${endpoint.replace(/\/+$/, '')}/${bucket}`;

    return {
        endpoint,
        bucket,
        region,
        accessKey,
        secretKey,
        forcePathStyle,
        publicUrlPrefix,
    };
}

export function getS3Client(): NativeS3Client | null {
    const config = getS3Config();
    if (!config) {
        return null;
    }

    if (
        !cachedClient ||
        !cachedConfig ||
        cachedConfig.endpoint !== config.endpoint ||
        cachedConfig.bucket !== config.bucket ||
        cachedConfig.accessKey !== config.accessKey
    ) {
        cachedConfig = config;
        cachedClient = new NativeS3Client(config);
    }

    return cachedClient;
}
