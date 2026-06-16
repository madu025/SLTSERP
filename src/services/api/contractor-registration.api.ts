import { PublicRegistrationSchema } from '@/lib/validations/contractor.schema';

export class ContractorRegistrationApi {
    private static async handleResponse(response: Response) {
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'UNKNOWN_ERROR' }));
            throw error;
        }
        return response.json();
    }

    /**
     * Fetch initial contractor data for a token
     */
    static async getContractorByToken(token: string) {
        const res = await fetch(`/api/contractors/public-register/${token}`);
        return this.handleResponse(res);
    }

    /**
     * Save a registration draft
     */
    static async saveDraft(token: string, data: Partial<PublicRegistrationSchema>) {
        const res = await fetch(`/api/contractors/public-register/${token}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return this.handleResponse(res);
    }

    /**
     * Submit the final registration
     */
    static async submitRegistration(token: string, data: PublicRegistrationSchema) {
        const res = await fetch(`/api/contractors/public-register/${token}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return this.handleResponse(res);
    }

    /**
     * Helper to fetch static lists
     */
    static async getStaticData() {
        const [banks, branches, stores, opmcs] = await Promise.all([
            fetch('/api/banks').then(r => r.json()).catch(() => []),
            fetch('/api/branches').then(r => r.json()).catch(() => []),
            fetch('/api/inventory/stores').then(r => r.json()).catch(() => []),
            fetch('/api/opmcs').then(r => r.json()).catch(() => [])
        ]);
        
        return { banks, branches, stores, opmcs };
    }
    
    /**
     * Upload a file
     */
    static async uploadFile(file: File, fieldName: string, onProgress?: (p: number) => void) {
        return new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', '/api/upload');
            
            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    onProgress?.(percent);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    resolve(response.url);
                } else {
                    reject(new Error(`Upload failed for ${fieldName}`));
                }
            };

            xhr.onerror = () => reject(new Error(`Network error during ${fieldName} upload`));
            
            const formData = new FormData();
            formData.append('file', file);
            xhr.send(formData);
        });
    }
}
