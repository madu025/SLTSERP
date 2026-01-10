'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, UploadCloud, CheckCircle, FileText, XCircle, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Toaster, toast } from 'sonner';

export default function PublicUploadPage() {
    const params = useParams();
    const token = params.token as string;

    const [loading, setLoading] = useState(true);
    const [valid, setValid] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [contractorName, setContractorName] = useState('');
    const [documents, setDocuments] = useState({
        photoUrl: '',
        nicFrontUrl: '',
        nicBackUrl: '',
        policeReportUrl: '',
        gramaCertUrl: '',
        bankPassbookUrl: '',
        brCertUrl: '',
        bankName: '',
        bankBranch: '',
        bankAccountNumber: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!token) return;

        // Validate Token
        fetch(`/api/contractors/public?token=${token}`)
            .then(res => {
                if (!res.ok) {
                    return res.json().then(d => { throw new Error(d.message || 'Invalid link'); });
                }
                return res.json();
            })
            .then(data => {
                if (data.isValid) {
                    setValid(true);
                    setContractorName(data.contractor.name);
                    // Pre-fill if already exists
                    setDocuments(data.contractor.documents || {});
                } else {
                    setValid(false);
                    setErrorMsg(data.message);
                }
            })
            .catch(err => {
                setValid(false);
                setErrorMsg(err.message);
            })
            .finally(() => setLoading(false));
    }, [token]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Basic validation
        if (file.size > 5 * 1024 * 1024) {
            toast.error("File is too large (Max 5MB)");
            return;
        }

        const formData = new FormData();
        formData.append('file', file);

        const toastId = toast.loading("Uploading...");

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();

            setDocuments(prev => ({ ...prev, [field]: data.url }));
            toast.success("Uploaded successfully!", { id: toastId });
        } catch (err) {
            toast.error("Upload failed. Please try again.", { id: toastId });
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/contractors/public', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, documents })
            });

            if (!res.ok) throw new Error("Submission failed");

            setSuccess(true);
            toast.success("Documents submitted successfully!");
        } catch (err) {
            toast.error("Failed to submit documents. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) {
        return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
    }

    if (!valid || success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="max-w-md w-full text-center p-6">
                    <div className="flex justify-center mb-4">
                        {success ? <CheckCircle className="w-16 h-16 text-green-500" /> : <XCircle className="w-16 h-16 text-red-500" />}
                    </div>
                    <h2 className="text-xl font-bold mb-2">{success ? "Submission Successful!" : "Invalid or Expired Link"}</h2>
                    <p className="text-slate-600">
                        {success
                            ? "Thank you! Your documents have been securely submitted for review."
                            : errorMsg || "This link is no longer valid. Please request a new one."}
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-10 px-4">
            <Toaster position="top-center" />
            <div className="max-w-2xl mx-auto">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-bold text-slate-900">Document Submission</h1>
                    <p className="text-slate-600">Secure upload for <span className="font-semibold text-blue-600">{contractorName}</span></p>
                    <div className="mt-2 flex items-center justify-center gap-2 text-xs text-amber-600 bg-amber-50 py-1 px-3 rounded-full w-fit mx-auto">
                        <ShieldCheck className="w-3 h-3" /> Secure & Encrypted Link
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Required Documents</CardTitle>
                        <CardDescription>Please clear photos or scans of the following documents.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">

                        {/* Photo */}
                        <div className="grid grid-cols-1 gap-2">
                            <Label>Contractor Photograph</Label>
                            <div className="flex items-center gap-4 border p-3 rounded-lg bg-slate-50">
                                {documents.photoUrl ? (
                                    <img src={documents.photoUrl} alt="Photo" className="w-16 h-16 object-cover rounded shadow-sm" />
                                ) : (
                                    <div className="w-16 h-16 bg-slate-200 rounded flex items-center justify-center text-slate-400"><FileText className="w-6 h-6" /></div>
                                )}
                                <div className="flex-1">
                                    <Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'photoUrl')} />
                                </div>
                            </div>
                        </div>

                        {/* BR Certificate */}
                        <div className="grid grid-cols-1 gap-2">
                            <Label>Business Registration (BR) Certificate</Label>
                            <div className="flex items-center gap-4 border p-3 rounded-lg bg-slate-50">
                                {documents.brCertUrl ? (
                                    <div className="w-16 h-16 bg-green-50 rounded flex items-center justify-center text-green-600 border border-green-200"><CheckCircle className="w-8 h-8" /></div>
                                ) : (
                                    <div className="w-16 h-16 bg-slate-200 rounded flex items-center justify-center text-slate-400"><FileText className="w-6 h-6" /></div>
                                )}
                                <div className="flex-1">
                                    <p className="text-xs text-slate-500 mb-1">If available, upload a clear copy.</p>
                                    <Input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileUpload(e, 'brCertUrl')} />
                                </div>
                            </div>
                        </div>

                        {/* NIC Front & Back */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>NIC Front Side</Label>
                                <div className="border p-3 rounded-lg bg-slate-50 text-center">
                                    {documents.nicFrontUrl && <img src={documents.nicFrontUrl} alt="NIC Front" className="h-24 w-full object-contain mb-2 bg-white border" />}
                                    <Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'nicFrontUrl')} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>NIC Back Side</Label>
                                <div className="border p-3 rounded-lg bg-slate-50 text-center">
                                    {documents.nicBackUrl && <img src={documents.nicBackUrl} alt="NIC Back" className="h-24 w-full object-contain mb-2 bg-white border" />}
                                    <Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'nicBackUrl')} />
                                </div>
                            </div>
                        </div>

                        {/* Bank Details */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Bank Name</Label>
                                <Input placeholder="e.g. BOC" value={documents.bankName || ''} onChange={(e) => setDocuments(prev => ({ ...prev, bankName: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Branch</Label>
                                <Input placeholder="e.g. Colpetty" value={documents.bankBranch || ''} onChange={(e) => setDocuments(prev => ({ ...prev, bankBranch: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label>Account Number</Label>
                                <Input placeholder="Account No" value={documents.bankAccountNumber || ''} onChange={(e) => setDocuments(prev => ({ ...prev, bankAccountNumber: e.target.value }))} />
                            </div>
                        </div>

                        {/* Bank Passbook */}
                        <div className="grid grid-cols-1 gap-2">
                            <Label>Bank Passbook (First Page)</Label>
                            <div className="border p-3 rounded-lg bg-slate-50">
                                {documents.bankPassbookUrl && <img src={documents.bankPassbookUrl} alt="Passbook" className="h-32 w-full object-contain mb-2 bg-white border" />}
                                <Input type="file" accept="image/*" onChange={(e) => handleFileUpload(e, 'bankPassbookUrl')} />
                            </div>
                        </div>

                        {/* Other Docs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Police Report</Label>
                                <div className="border p-3 rounded-lg bg-slate-50">
                                    {documents.policeReportUrl && <div className="text-xs text-green-600 flex items-center gap-1 mb-2"><CheckCircle className="w-3 h-3" /> Uploaded</div>}
                                    <Input type="file" onChange={(e) => handleFileUpload(e, 'policeReportUrl')} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Grama Niladhari Cert</Label>
                                <div className="border p-3 rounded-lg bg-slate-50">
                                    {documents.gramaCertUrl && <div className="text-xs text-green-600 flex items-center gap-1 mb-2"><CheckCircle className="w-3 h-3" /> Uploaded</div>}
                                    <Input type="file" onChange={(e) => handleFileUpload(e, 'gramaCertUrl')} />
                                </div>
                            </div>
                        </div>

                        <div className="pt-4">
                            <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...
                                    </>
                                ) : (
                                    <>
                                        <UploadCloud className="w-4 h-4 mr-2" /> Submit All Documents
                                    </>
                                )}
                            </Button>
                            <p className="text-xs text-center text-slate-500 mt-2">
                                By submitting, you confirm that these documents are authentic and accurate.
                            </p>
                        </div>

                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
