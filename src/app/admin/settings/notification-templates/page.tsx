'use client';

import { useState, useEffect, useCallback } from 'react';
import RoleGuard from '@/components/RoleGuard';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ROLE_GROUPS } from '@/config/roles';
import { Mail, Plus, Edit2, Trash2, Eye, Save, X, Copy, Send } from 'lucide-react';
import { toast } from 'sonner';

const SENDING_STATE: Record<string, boolean> = {};


interface NotificationTemplate {
  id: string;
  code: string;
  title: string;
  message: string;
  subject: string | null;
  htmlBody: string | null;
  entityType: string | null;
  isActive: boolean;
  channels: string[];
  createdAt: string;
  updatedAt: string;
}

interface TemplateCodeDef {
  code: string;
  label: string;
  description: string;
  category: string;
  placeholders: string[];
  defaultEntityType: string;
}

const PLACEHOLDERS = [
  { key: '{{user}}', label: 'User Name' },
  { key: '{{userEmail}}', label: 'User Email' },
  { key: '{{userRole}}', label: 'User Role' },
  { key: '{{entityType}}', label: 'Entity Type' },
  { key: '{{entityId}}', label: 'Entity ID' },
  { key: '{{entityName}}', label: 'Entity Name' },
  { key: '{{action}}', label: 'Action (Approved/Rejected)' },
  { key: '{{status}}', label: 'Status' },
  { key: '{{amount}}', label: 'Amount (LKR)' },
  { key: '{{date}}', label: 'Date' },
  { key: '{{approveUrl}}', label: 'Approve URL' },
  { key: '{{rejectUrl}}', label: 'Reject URL' },
  { key: '{{expiryHours}}', label: 'Expiry Hours' },
  { key: '{{priority}}', label: 'Priority' },
  { key: '{{purpose}}', label: 'Purpose' },
  { key: '{{fromStore}}', label: 'From Store' },
  { key: '{{toStore}}', label: 'To Store' },
  { key: '{{items}}', label: 'Items (HTML list)' },
  { key: '{{title}}', label: 'Title' },
  { key: '{{message}}', label: 'Message' },
  { key: '{{actionUrl}}', label: 'Action URL' },
  { key: '{{unreadCount}}', label: 'Unread Count' },
  { key: '{{notifications}}', label: 'Notifications (HTML)' },
  { key: '{{itemCount}}', label: 'Item Count' },
  { key: '{{storeName}}', label: 'Store Name' },
];

const DEFAULT_HTML_TEMPLATE = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h2 { color: #1e40af; margin-bottom: 10px; }
    .info { background: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .actions { margin-top: 25px; }
    .btn { display: inline-block; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-right: 10px; font-weight: bold; }
    .btn-approve { background-color: #22c55e; color: white; }
    .btn-reject { background-color: #ef4444; color: white; }
    .footer { margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Approval Required: {{entityType}} #{{entityId}}</h2>
    <p>Dear {{user}},</p>
    <p>You have been assigned to review and approve this request.</p>
    <div class="info">
      <strong>Entity:</strong> {{entityName}}<br>
      <strong>Type:</strong> {{entityType}}<br>
      <strong>Status:</strong> {{status}}
    </div>
    <div class="actions">
      <a href="{{approveUrl}}" class="btn btn-approve">Approve</a>
      <a href="{{rejectUrl}}" class="btn btn-reject">Reject</a>
    </div>
    <div class="footer">
      <p>This action link expires in {{expiryHours}} hours.</p>
      <p>If you did not request this, please ignore this email.</p>
    </div>
  </div>
</body>
</html>`;

export default function NotificationTemplatesPage() {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [templateCodes, setTemplateCodes] = useState<TemplateCodeDef[]>([]);
  const [selectedCodeDef, setSelectedCodeDef] = useState<TemplateCodeDef | null>(null);
  const [useCustomCode, setUseCustomCode] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    code: '',
    title: '',
    message: '',
    subject: '',
    htmlBody: '',
    entityType: '',
    isActive: true,
    channels: ['EMAIL']
  });

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notification-templates');
      if (!res.ok) throw new Error('Failed to fetch templates');
      const json = await res.json();
      setTemplates(json.data || json || []);
    } catch (err) {
      toast.error('Could not load templates');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTemplateCodes = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notification-templates/codes');
      if (!res.ok) throw new Error('Failed to fetch template codes');
      const json = await res.json();
      setTemplateCodes(json.data?.codes || json.codes || []);
    } catch (err) {
      console.error('Could not load template codes', err);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchTemplateCodes();
  }, [fetchTemplates, fetchTemplateCodes]);

  const handleCodeSelect = (code: string) => {
    if (code === '__custom__') {
      setUseCustomCode(true);
      setSelectedCodeDef(null);
      setFormData({ ...formData, code: '' });
      return;
    }
    setUseCustomCode(false);
    const def = templateCodes.find(t => t.code === code) || null;
    setSelectedCodeDef(def);
    if (def) {
      setFormData({
        ...formData,
        code: def.code,
        title: def.label,
        entityType: def.defaultEntityType
      });
    }
  };

  const handleEdit = (template: NotificationTemplate) => {
    setEditingTemplate(template);
    setFormData({
      code: template.code,
      title: template.title,
      message: template.message,
      subject: template.subject || '',
      htmlBody: template.htmlBody || '',
      entityType: template.entityType || '',
      isActive: template.isActive,
      channels: template.channels || ['EMAIL']
    });
    setShowEditor(true);
  };

  const handleNew = () => {
    setEditingTemplate(null);
    setSelectedCodeDef(null);
    setUseCustomCode(false);
    setFormData({
      code: '',
      title: '',
      message: '',
      subject: '',
      htmlBody: DEFAULT_HTML_TEMPLATE,
      entityType: '',
      isActive: true,
      channels: ['EMAIL']
    });
    setShowEditor(true);
  };

  const handleSave = async () => {
    if (!formData.code || !formData.title || !formData.message) {
      toast.error('Code, title, and message are required');
      return;
    }

    setSaving(true);
    try {
      const url = '/api/admin/notification-templates';
      const method = editingTemplate ? 'PUT' : 'POST';
      const body = editingTemplate 
        ? { ...formData, id: editingTemplate.id }
        : formData;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || errorData.data?.error || 'Failed to save template');
      }

      toast.success(editingTemplate ? 'Template updated!' : 'Template created!');
      setShowEditor(false);
      fetchTemplates();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save template';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const res = await fetch(`/api/admin/notification-templates?id=${id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to delete');
      toast.success('Template deleted');
      fetchTemplates();
    } catch (err) {
      toast.error('Failed to delete template');
    }
  };

  const handlePreview = (template: NotificationTemplate) => {
    const sampleVars: Record<string, string> = {
      user: 'Sanjewa Perera',
      userEmail: 'sanjewa@slts.lk',
      userRole: 'STORES_MANAGER',
      entityType: 'Material Request',
      entityId: 'REQ-2026-0042',
      entityName: 'FTTH Installation - Kaduwela Zone A',
      action: 'PENDING',
      status: 'PENDING_APPROVAL',
      amount: '45,500',
      date: new Date().toLocaleDateString(),
      approveUrl: '#approve',
      rejectUrl: '#reject',
      expiryHours: '48',
      items: '<li>Cat5e UTP Cable &mdash; 5 Box</li><li>Drop Wire Retainer &mdash; 10 pcs</li><li>C Hook &mdash; 25 pcs</li><li>Fiber Drop Wire 100m &mdash; 3 Roll</li>',
      priority: 'HIGH',
      purpose: 'FTTH Installation - Kaduwela Zone A',
      fromStore: 'Kaduwela Main Store',
      toStore: 'Contractor Site - Sanjewa FTTH'
    };

    let html = template.htmlBody || template.message;
    Object.entries(sampleVars).forEach(([key, val]) => {
      html = html.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'g'), val);
    });
    setPreviewHtml(html);
    setShowPreview(true);
  };

  const [sendingTest, setSendingTest] = useState<Record<string, boolean>>({});

  const handleSendTest = async (template: NotificationTemplate) => {
    setSendingTest(prev => ({ ...prev, [template.id]: true }));
    try {
      const res = await fetch('/api/admin/notification-templates/test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: template.id })
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || errorData.data?.error || 'Failed to send test email');
      }

      const result = await res.json();
      toast.success(`Test email sent! MessageId: ${result.data?.messageId || result.messageId || 'OK'}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send test email';
      toast.error(message);
    } finally {
      setSendingTest(prev => ({ ...prev, [template.id]: false }));
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    const textarea = document.querySelector('textarea[name="htmlBody"]') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.htmlBody;
      const newText = text.substring(0, start) + placeholder + text.substring(end);
      setFormData({ ...formData, htmlBody: newText });
    }
  };

  const toggleChannel = (channel: string) => {
    const channels = formData.channels.includes(channel)
      ? formData.channels.filter(c => c !== channel)
      : [...formData.channels, channel];
    setFormData({ ...formData, channels });
  };

  return (
    <RoleGuard allowedRoles={ROLE_GROUPS.ADMINS as unknown as string[]}>
      <div className="flex h-screen bg-slate-50 overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto p-6">
            <div className="max-w-7xl mx-auto space-y-6">
              
              {/* Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border shadow-sm">
                <div>
                  <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Mail className="w-6 h-6 text-indigo-600" />
                    Email Templates
                  </h1>
                  <p className="text-slate-500 text-sm mt-1">
                    Manage customizable email templates for approval notifications.
                  </p>
                </div>
                <button
                  onClick={handleNew}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Template
                </button>
              </div>

              {/* Template List */}
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                {loading ? (
                  <div className="p-8 text-center text-slate-500">Loading templates...</div>
                ) : templates.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    No templates found. Create your first email template.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-slate-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Code</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Title</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Entity Type</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Channels</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {templates.map((template) => (
                          <tr key={template.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono">{template.code}</code>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-slate-800">{template.title}</div>
                              <div className="text-xs text-slate-500 truncate max-w-xs">{template.message}</div>
                            </td>
                            <td className="px-4 py-3 text-sm text-slate-600">{template.entityType || '-'}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                {template.channels.map(ch => (
                                  <span key={ch} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded">{ch}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-1 rounded ${template.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                {template.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handlePreview(template)}
                                  className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                                  title="Preview"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleSendTest(template)}
                                  disabled={sendingTest[template.id]}
                                  className="p-1.5 text-slate-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
                                  title="Send Test Email"
                                >
                                  <Send className={`w-4 h-4 ${sendingTest[template.id] ? 'animate-pulse' : ''}`} />
                                </button>
                                <button
                                  onClick={() => handleEdit(template)}
                                  className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(template.id)}
                                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Editor Modal */}
              {showEditor && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                    <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
                      <h2 className="text-lg font-bold text-slate-800">
                        {editingTemplate ? 'Edit Template' : 'New Template'}
                      </h2>
                      <button onClick={() => setShowEditor(false)} className="p-2 hover:bg-slate-100 rounded">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-6 space-y-6">
                      {/* Code Selector */}
                      {!editingTemplate && (
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Template Type</label>
                          <select
                            value={useCustomCode ? '__custom__' : (formData.code || '')}
                            onChange={(e) => handleCodeSelect(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                          >
                            <option value="" disabled>Select a template type...</option>
                            {['APPROVAL', 'ALERT', 'NOTIFICATION', 'INVENTORY'].map(cat => {
                              const codes = templateCodes.filter(t => t.category === cat);
                              if (codes.length === 0) return null;
                              return (
                                <optgroup key={cat} label={cat}>
                                  {codes.map(t => (
                                    <option key={t.code} value={t.code}>
                                      {t.label} ({t.code})
                                    </option>
                                  ))}
                                </optgroup>
                              );
                            })}
                            <option value="__custom__">Custom Code (advanced)</option>
                          </select>
                          {selectedCodeDef && (
                            <p className="text-xs text-slate-500 mt-1">{selectedCodeDef.description}</p>
                          )}
                        </div>
                      )}

                      {/* Basic Info */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Code (Unique ID)</label>
                          <input
                            type="text"
                            value={formData.code}
                            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                            disabled={!!editingTemplate || (!useCustomCode && !!selectedCodeDef)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100"
                            placeholder="APPROVAL_MATERIAL_REQUEST"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">Entity Type</label>
                          <input
                            type="text"
                            value={formData.entityType}
                            onChange={(e) => setFormData({ ...formData, entityType: e.target.value })}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                            placeholder="MATERIAL_REQUEST, SERVICE_ORDER"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                          placeholder="Material Request Approval"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Email Subject</label>
                        <input
                          type="text"
                          value={formData.subject}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                          placeholder="Action Required: {{entityType}} #{{entityId}}"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Message (Plain Text)</label>
                        <textarea
                          value={formData.message}
                          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                          placeholder="Please approve or reject the {{entityType}} request."
                        />
                      </div>

                      {/* HTML Body */}
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <label className="block text-sm font-medium text-slate-700">HTML Body</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => handlePreview({ ...formData, id: '', createdAt: '', updatedAt: '' } as NotificationTemplate)}
                              className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" /> Preview
                            </button>
                          </div>
                        </div>
                        <textarea
                          name="htmlBody"
                          value={formData.htmlBody}
                          onChange={(e) => setFormData({ ...formData, htmlBody: e.target.value })}
                          rows={12}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                          placeholder="<!DOCTYPE html>..."
                        />
                      </div>

                      {/* Placeholder Picker */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Insert Placeholder
                          {selectedCodeDef && (
                            <span className="ml-2 text-xs font-normal text-indigo-600">
                              (filtered for {selectedCodeDef.code})
                            </span>
                          )}
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {PLACEHOLDERS.filter(p => {
                            if (!selectedCodeDef) return true;
                            const key = p.key.replace(/^\{\{|\}\}$/g, '');
                            return selectedCodeDef.placeholders.includes(key);
                          }).map(p => (
                            <button
                              key={p.key}
                              type="button"
                              onClick={() => insertPlaceholder(p.key)}
                              className="text-xs bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 px-2 py-1 rounded transition-colors"
                              title={p.label}
                            >
                              {p.key}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Channels */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Channels</label>
                        <div className="flex gap-4">
                          {['EMAIL', 'IN_APP', 'SMS'].map(ch => (
                            <label key={ch} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData.channels.includes(ch)}
                                onChange={() => toggleChannel(ch)}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="text-sm">{ch}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Active Toggle */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium">Active</span>
                      </label>
                    </div>

                    <div className="sticky bottom-0 bg-white border-t p-4 flex justify-end gap-3">
                      <button
                        onClick={() => setShowEditor(false)}
                        className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 disabled:opacity-50"
                      >
                        <Save className="w-4 h-4" />
                        {saving ? 'Saving...' : 'Save Template'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Modal */}
              {showPreview && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                  <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden">
                    <div className="border-b p-4 flex justify-between items-center">
                      <h2 className="text-lg font-bold text-slate-800">Email Preview</h2>
                      <button onClick={() => setShowPreview(false)} className="p-2 hover:bg-slate-100 rounded">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)]">
                      <div 
                        className="border rounded-lg overflow-hidden"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>
          </main>
        </div>
      </div>
    </RoleGuard>
  );
}
