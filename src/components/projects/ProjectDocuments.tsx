import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, History, Send, Download, FileText, CheckCircle2, Clock, XCircle, type LucideIcon } from 'lucide-react';
import { format } from 'date-fns';

import { toast } from 'sonner';
interface Project {
    id: string;
    name: string;
}

interface DocumentVersion {
    id: string;
    versionNumber: number;
    fileUrl: string;
    changeSummary: string | null;
    uploadedById: string;
    createdAt: string;
}

interface ProjectDoc {
    id: string;
    title: string;
    description: string | null;
    category: string;
    status: string;
    currentVersion: number;
    fileUrl: string;
    uploadedBy: {
        id: string;
        name: string;
        email: string;
    };
    versions: DocumentVersion[];
    createdAt: string;
    updatedAt: string;
}

interface ProjectDocumentsProps {
    project: Project;
}

export default function ProjectDocuments({ project }: ProjectDocumentsProps) {
    const [documents, setDocuments] = useState<ProjectDoc[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Upload Dialog State
    const [isUploadOpen, setIsUploadOpen] = useState(false);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('DRAWING');
    const [fileUrl, setFileUrl] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const submissionLock = useRef(false);
    const loadSequence = useRef(0);

    // Version Dialog State
    const [isVersionOpen, setIsVersionOpen] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<ProjectDoc | null>(null);
    const [newVersionFileUrl, setNewVersionFileUrl] = useState('');
    const [changeSummary, setChangeSummary] = useState('');

    // History Dialog State
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);

    const fetchDocuments = useCallback(async () => {
        const sequence = ++loadSequence.current;
        try {
            setLoading(true);
            setLoadError(null);
            const res = await fetch(`/api/projects/${project.id}/documents`);
            if (!res.ok) throw new Error('Failed to load documents');
            if (sequence === loadSequence.current) {
                const payload = await res.json();
                const data = Array.isArray(payload) ? payload : payload.data || [];
                if (sequence === loadSequence.current) setDocuments(data);
            }
        } catch {
            if (sequence === loadSequence.current) {
                setDocuments([]);
                setLoadError('Failed to load documents. Please retry.');
            }
        } finally {
            if (sequence === loadSequence.current) setLoading(false);
        }
    }, [project.id]);

    useEffect(() => {
        const sequence = loadSequence;
        setDocuments([]);
        setSelectedDoc(null);
        setIsUploadOpen(false);
        setIsVersionOpen(false);
        setIsHistoryOpen(false);
        void fetchDocuments();
        return () => { ++sequence.current; };
    }, [fetchDocuments]);

    const handleUpload = async () => {
        if (submissionLock.current) return;
        if (!title.trim() || (!fileUrl.trim() && !selectedFile)) {
            toast.error('Title and a file or file URL are required');
            return;
        }

        try {
            submissionLock.current = true;
            setSubmitting(true);
            let resolvedFileUrl = fileUrl;
            if (selectedFile) {
                const formData = new FormData();
                formData.append('file', selectedFile);
                formData.append('bucket', 'documents');
                const uploadResponse = await fetch('/api/upload', { method: 'POST', body: formData });
                const uploadPayload = await uploadResponse.json();
                if (!uploadResponse.ok) {
                    toast.error(uploadPayload.error?.message || uploadPayload.error || 'File upload failed');
                    return;
                }
                resolvedFileUrl = uploadPayload.url || uploadPayload.data?.url || '';
                if (!resolvedFileUrl) throw new Error('Upload returned no file URL');
            }
            const res = await fetch(`/api/projects/${project.id}/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title,
                    description,
                    category,
                    fileUrl: resolvedFileUrl
                })
            });

            if (res.ok) {
                setIsUploadOpen(false);
                resetUploadForm();
                fetchDocuments();
            } else {
                toast.error('Failed to upload document');
            }
        } catch {
            toast.error('Failed to upload document');
        } finally {
            submissionLock.current = false;
            setSubmitting(false);
        }
    };

    const handleNewVersion = async () => {
        if (submissionLock.current) return;
        if (!selectedDoc || !newVersionFileUrl.trim()) {
            toast.error('Revision file URL is required');
            return;
        }

        try {
            submissionLock.current = true;
            setSubmitting(true);
            const res = await fetch(`/api/projects/${project.id}/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentId: selectedDoc.id,
                    fileUrl: newVersionFileUrl,
                    changeSummary
                })
            });

            if (res.ok) {
                setIsVersionOpen(false);
                setNewVersionFileUrl('');
                setChangeSummary('');
                fetchDocuments();
            } else {
                toast.error('Failed to save new version');
            }
        } catch {
            toast.error('Failed to save new version');
        } finally {
            submissionLock.current = false;
            setSubmitting(false);
        }
    };

    const handleSubmitApproval = async (doc: ProjectDoc) => {
        if (submissionLock.current) return;
        if (!confirm(`Submit "${doc.title}" for management approval review?`)) return;

        submissionLock.current = true;
        setSubmitting(true);
        try {
            const res = await fetch(`/api/projects/${project.id}/approvals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'DOCUMENT',
                    referenceId: doc.id,
                    title: `Review Document: ${doc.title} (v${doc.currentVersion})`,
                    description: doc.description || `Approval review for category ${doc.category}`,
                    steps: [
                        { stepNumber: 1, roleRequired: 'ENGINEER' },
                        { stepNumber: 2, roleRequired: 'AREA_MANAGER' }
                    ]
                })
            });

            if (res.ok) {
                toast.success('Document submitted for approval workflow.');
                fetchDocuments();
            } else {
                toast.error('Failed to submit approval request');
            }
        } catch {
            toast.error('Failed to submit approval request');
        } finally {
            submissionLock.current = false;
            setSubmitting(false);
        }
    };

    const resetUploadForm = () => {
        setTitle('');
        setDescription('');
        setCategory('DRAWING');
        setFileUrl('');
        setSelectedFile(null);
    };

    const getStatusBadge = (status: string) => {
        const configs: Record<string, { className: string; icon: LucideIcon }> = {
            DRAFT: { className: 'bg-slate-100 text-slate-800', icon: Clock },
            UNDER_REVIEW: { className: 'bg-blue-100 text-blue-900', icon: Clock },
            APPROVED: { className: 'bg-green-100 text-green-900', icon: CheckCircle2 },
            REJECTED: { className: 'bg-red-100 text-red-900', icon: XCircle }
        };

        const config = configs[status] || configs.DRAFT;
        const Icon = config.icon;

        return (
            <Badge className={`text-xs ${config.className}`}>
                <Icon className="w-3 h-3 mr-1" />
                {status.replace(/_/g, ' ')}
            </Badge>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">Project Documents</h3>
                    <p className="text-sm text-slate-500">Repository for project plans, drawings, and contract deliverables.</p>
                </div>
                <Button onClick={() => setIsUploadOpen(true)} className="gap-2">
                    <Plus className="w-4 h-4" /> Add Document
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-12 text-slate-500">Loading documents...</div>
            ) : loadError ? (
                <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
                    <p>{loadError}</p>
                    <Button variant="outline" className="mt-2" onClick={() => void fetchDocuments()}>Retry</Button>
                </div>
            ) : documents.length === 0 ? (
                <Card className="border-dashed border-2">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <FileText className="w-12 h-12 text-slate-350 mb-3" />
                        <h4 className="font-semibold text-slate-700">No Documents Uploaded</h4>
                        <p className="text-xs text-slate-500 max-w-sm mt-1">Upload technical specification sheets, project drawings, or invoices.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Document</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Category</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Version</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Uploaded By</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Last Updated</th>
                                <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                            {documents.map((doc) => (
                                <tr key={doc.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900">{doc.title}</p>
                                            {doc.description && <p className="text-xs text-slate-500 mt-0.5">{doc.description}</p>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant="outline">{doc.category}</Badge>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-700 font-medium">
                                        v{doc.currentVersion}
                                    </td>
                                    <td className="px-6 py-4">
                                        {getStatusBadge(doc.status)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {doc.uploadedBy.name}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500">
                                        {format(new Date(doc.updatedAt), 'MMM dd, yyyy')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center justify-center gap-1.5">
                                            <Button variant="outline" size="sm" asChild className="h-8 p-2">
                                                <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                                    <Download className="w-4 h-4" />
                                                </a>
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => { setSelectedDoc(doc); setIsVersionOpen(true); }} className="h-8 text-xs gap-1">
                                                <Plus className="w-3.5 h-3.5" /> Version
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => { setSelectedDoc(doc); setIsHistoryOpen(true); }} className="h-8 text-xs gap-1">
                                                <History className="w-3.5 h-3.5" /> Logs
                                            </Button>
                                            {doc.status === 'DRAFT' && (
                                                <Button disabled={submitting} variant="default" size="sm" onClick={() => handleSubmitApproval(doc)} className="h-8 text-xs gap-1 bg-blue-600 hover:bg-blue-700">
                                                    <Send className="w-3.5 h-3.5" /> Submit
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Document Dialog */}
            <Dialog open={isUploadOpen} onOpenChange={(open) => { if (!submissionLock.current) setIsUploadOpen(open); }}>
                <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add Document</DialogTitle>
                        <DialogDescription>Register a new drawing, contract, or BOQ specification.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-2">
                            <Label>Document Title *</Label>
                            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fiber Distribution Node Layout" />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief file content overview" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Select value={category} onValueChange={setCategory}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="CAD_DRAWING">CAD drawing</SelectItem>
                                        <SelectItem value="DRAWING">Technical Drawing</SelectItem>
                                        <SelectItem value="CAD_AS_BUILT">CAD as-built</SelectItem>
                                        <SelectItem value="QGIS_AS_BUILT">QGIS as-built</SelectItem>
                                        <SelectItem value="BOQ">BOQ Specification</SelectItem>
                                        <SelectItem value="CONTRACT">Legal Contract</SelectItem>
                                        <SelectItem value="SPECIFICATION">Spec sheet</SelectItem>
                                        <SelectItem value="OTHER">Other document</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Upload file (optional if using a URL)</Label>
                            <Input type="file" accept=".dxf,.dwg,.pdf,.zip,.geojson,.gpkg" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                        </div>
                        <div className="space-y-2">
                            <Label>File URL (S3/Cloud storage path) *</Label>
                            <Input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} placeholder="https://s3.amazonaws.com/sltserp/drawings/fdn-1.pdf" />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button disabled={submitting} variant="outline" onClick={() => setIsUploadOpen(false)}>Cancel</Button>
                            <Button disabled={submitting} onClick={handleUpload}>{submitting ? 'Saving...' : 'Save Document'}</Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Upload New Version Dialog */}
            <Dialog open={isVersionOpen} onOpenChange={(open) => { if (!submissionLock.current) setIsVersionOpen(open); }}>
                <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Upload New Version</DialogTitle>
                        <DialogDescription>Publishing a new revision for: <strong>{selectedDoc?.title}</strong></DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-3">
                        <div className="space-y-2">
                            <Label>Revision File URL *</Label>
                            <Input value={newVersionFileUrl} onChange={(e) => setNewVersionFileUrl(e.target.value)} placeholder="https://..." />
                        </div>
                        <div className="space-y-2">
                            <Label>Change log summary</Label>
                            <Input value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} placeholder="e.g. Updated layout near OPMC store crossing" />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button disabled={submitting} variant="outline" onClick={() => setIsVersionOpen(false)}>Cancel</Button>
                            <Button disabled={submitting} onClick={handleNewVersion}>{submitting ? 'Publishing...' : 'Publish Version'}</Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Version Logs / History Dialog */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Version History Log</DialogTitle>
                        <DialogDescription>List of revisions published for: {selectedDoc?.title}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2 max-h-[300px] overflow-y-auto">
                        {selectedDoc?.versions.map((ver) => (
                            <div key={ver.id} className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50/50">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">Version {ver.versionNumber}</p>
                                    {ver.changeSummary && <p className="text-xs text-slate-500 mt-0.5">{ver.changeSummary}</p>}
                                    <p className="text-[10px] text-slate-400 mt-1">{format(new Date(ver.createdAt), 'MMM dd, yyyy HH:mm')}</p>
                                </div>
                                <Button variant="outline" size="sm" asChild className="h-8 w-8 p-0">
                                    <a href={ver.fileUrl} target="_blank" rel="noopener noreferrer">
                                        <Download className="w-4 h-4" />
                                    </a>
                                </Button>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button onClick={() => setIsHistoryOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
