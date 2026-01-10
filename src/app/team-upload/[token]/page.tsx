'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2, UploadCloud, CheckCircle, FileText, XCircle, ShieldCheck, Shirt, Footprints, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Toaster, toast } from 'sonner';

export default function PublicTeamUploadPage() {
    const params = useParams();
    const token = params.token as string;

    const [loading, setLoading] = useState(true);
    const [valid, setValid] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [memberName, setMemberName] = useState('');

    // Form Data
    const [formData, setFormData] = useState({
        shoeSize: '',
        tshirtSize: '',
        photoUrl: '',
        passportPhotoUrl: '',
        nicUrl: '',
        policeReportUrl: '',
        gramaCertUrl: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        if (!token) return;
        fetch(`/api/team-members/public?token=${token}`)
            .then(res => {
                if (!res.ok) throw new Error('Invalid or Expired Link');
                return res.json();
            })
            .then(data => {
                if (data.isValid) {
                    setValid(true);
                    setMemberName(data.member.name);
                    setFormData({
                        shoeSize: data.member.shoeSize || '',
                        tshirtSize: data.member.tshirtSize || '',
                        photoUrl: data.member.photoUrl || '',
                        passportPhotoUrl: data.member.passportPhotoUrl || '',
                        nicUrl: data.member.nicUrl || '',
                        policeReportUrl: data.member.policeReportUrl || '',
                        gramaCertUrl: data.member.gramaCertUrl || ''
                    });
                } else {
                    setValid(false);
                    setErrorMsg(data.message);
                }
            })
            .catch(err => {
                setValid(false);
                setErrorMsg(err.message || 'Error loading page');
            })
            .finally(() => setLoading(false));
    }, [token]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error("File is too large (Max 5MB)");
            return;
        }

        const payload = new FormData();
        payload.append('file', file);
        const toastId = toast.loading("Uploading...");

        try {
            const res = await fetch('/api/upload', { method: 'POST', body: payload });
            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();

            setFormData(prev => ({ ...prev, [field]: data.url }));
            toast.success("Uploaded!", { id: toastId });
        } catch (err) {
            toast.error("Upload failed.", { id: toastId });
        }
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/team-members/public', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, data: formData })
            });

            if (!res.ok) throw new Error("Submission failed");
            setSuccess(true);
            toast.success("Submitted successfully!");
        } catch (err) {
            toast.error("Submission failed. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;

    if (!valid || success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <Card className="max-w-md w-full text-center p-6 shadow-lg">
                    <div className="flex justify-center mb-4">
                        {success ? <CheckCircle className="w-16 h-16 text-green-500" /> : <XCircle className="w-16 h-16 text-red-500" />}
                    </div>
                    <h2 className="text-xl font-bold mb-2">{success ? "Submission Successful!" : "Invalid or Expired Link"}</h2>
                    <p className="text-slate-600">
                        {success ? "Thank you! Your information has been securely updated." : errorMsg || "This link is invalid."}
                    </p>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4">
            <Toaster position="top-center" />
            <div className="max-w-xl mx-auto space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Member Details & Uploads</h1>
                    <p className="text-slate-600 mt-2">Secure submission for <span className="font-semibold text-blue-600 underline decoration-blue-300 underline-offset-4">{memberName}</span></p>
                    <div className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                        <ShieldCheck className="w-3 h-3" /> Secure Link
                    </div>
                </div>

                <Card className="shadow-xl border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b pb-4">
                        <CardTitle className="text-lg">Personal Details</CardTitle>
                        <CardDescription>Please provide your sizing information.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-slate-600"><Footprints className="w-4 h-4" /> Shoe Size</Label>
                                <Input
                                    placeholder="e.g. 9, 42"
                                    value={formData.shoeSize}
                                    onChange={e => setFormData({ ...formData, shoeSize: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2 text-slate-600"><Shirt className="w-4 h-4" /> T-Shirt Size</Label>
                                <Select value={formData.tshirtSize} onValueChange={v => setFormData({ ...formData, tshirtSize: v })}>
                                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                    <SelectContent>
                                        {['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xl border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b pb-4">
                        <CardTitle className="text-lg">Document Uploads</CardTitle>
                        <CardDescription>Upload clear photos of the required documents.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        {/* Passport Photo (Special Highlight) */}
                        <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl space-y-3">
                            <Label className="flex items-center gap-2 font-semibold text-blue-900"><Camera className="w-4 h-4" /> Passport Size Photo (For Office ID)</Label>
                            <div className="flex items-center gap-4">
                                {formData.passportPhotoUrl ? (
                                    <img src={formData.passportPhotoUrl} className="w-20 h-24 object-cover rounded-md shadow-sm border border-blue-200 bg-white" />
                                ) : (
                                    <div className="w-20 h-24 bg-blue-100/50 rounded-md border border-dashed border-blue-300 flex items-center justify-center text-blue-300">
                                        <Camera className="w-8 h-8" />
                                    </div>
                                )}
                                <Input type="file" accept="image/*" className="bg-white" onChange={e => handleFileUpload(e, 'passportPhotoUrl')} />
                            </div>
                        </div>

                        {/* Other Documents Grid */}
                        <div className="grid grid-cols-1 gap-6">
                            {[
                                { id: 'photoUrl', label: 'Casual Photo', icon: FileText }, // Or maybe just "Photo"
                                { id: 'nicUrl', label: 'NIC / ID Copy', icon: FileText },
                                { id: 'policeReportUrl', label: 'Police Certification', icon: FileText },
                                { id: 'gramaCertUrl', label: 'Grama Niladhari Cert', icon: FileText },
                            ].map((doc) => (
                                <div key={doc.id} className="space-y-2">
                                    <Label className="flex items-center gap-2 text-slate-700">
                                        <doc.icon className="w-4 h-4 text-slate-400" /> {doc.label}
                                        {formData[doc.id as keyof typeof formData] && <CheckCircle className="w-4 h-4 text-green-600 ml-auto" />}
                                    </Label>
                                    <div className="flex items-center gap-3 p-3 border rounded-lg hover:border-slate-300 transition-colors bg-slate-50/50">
                                        {formData[doc.id as keyof typeof formData] && (
                                            <a href={formData[doc.id as keyof typeof formData]} target="_blank" className="shrink-0">
                                                <img src={formData[doc.id as keyof typeof formData]} className="w-10 h-10 object-cover rounded border" />
                                            </a>
                                        )}
                                        <Input type="file" className="bg-transparent border-0 shadow-none h-auto p-0 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" onChange={e => handleFileUpload(e, doc.id)} />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-4">
                            <Button className="w-full h-12 text-lg font-semibold shadow-lg shadow-blue-900/20" onClick={handleSubmit} disabled={isSubmitting}>
                                {isSubmitting ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Saving...</> : <><UploadCloud className="w-5 h-5 mr-2" /> Submit Information</>}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
