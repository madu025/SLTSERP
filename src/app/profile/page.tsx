"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, Mail, Shield, MapPin, Building2, Users, Lock, Eye, EyeOff } from 'lucide-react';

interface ProfileData {
    id: string;
    username: string;
    email: string;
    name: string;
    role: string;
    employeeId?: string;
    createdAt: string;
    updatedAt: string;
    accessibleOpmcs: Array<{
        id: string;
        rtom: string;
        region: string;
        province: string;
    }>;
    assignedStore?: {
        id: string;
        name: string;
        type: string;
        location: string;
    };
    sectionAssignments: Array<{
        section: {
            id: string;
            name: string;
            code: string;
        };
        role: {
            id: string;
            name: string;
            code: string;
        };
        isPrimary: boolean;
    }>;
    supervisor?: {
        id: string;
        name: string;
        username: string;
        role: string;
    };
}

export default function ProfilePage() {
    const router = useRouter();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [editMode, setEditMode] = useState(false);
    const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

    // Edit form state
    const [editForm, setEditForm] = useState({
        name: '',
        email: ''
    });

    // Password change state
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [saveLoading, setSaveLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (!storedUser) {
            router.push('/login');
            return;
        }

        const user = JSON.parse(storedUser);
        fetchProfile(user.id);
    }, []);

    const fetchProfile = async (userId: string) => {
        try {
            const res = await fetch(`/api/profile?userId=${userId}`);
            if (!res.ok) throw new Error('Failed to fetch profile');

            const data = await res.json();
            setProfile(data);
            setEditForm({
                name: data.name || '',
                email: data.email || ''
            });
        } catch (error) {
            console.error('Error fetching profile:', error);
            setMessage({ type: 'error', text: 'Failed to load profile' });
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async () => {
        if (!profile) return;

        setSaveLoading(true);
        setMessage(null);

        try {
            const res = await fetch(`/api/profile?userId=${profile.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || 'Failed to update profile');
            }

            const updatedData = await res.json();
            setProfile({ ...profile, ...updatedData });
            setEditMode(false);
            setMessage({ type: 'success', text: 'Profile updated successfully!' });

            // Update localStorage
            const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
            localStorage.setItem('user', JSON.stringify({ ...storedUser, name: updatedData.name, email: updatedData.email }));
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setSaveLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!profile) return;

        setMessage(null);

        // Validation
        if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
            setMessage({ type: 'error', text: 'All password fields are required' });
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            setMessage({ type: 'error', text: 'New passwords do not match' });
            return;
        }

        if (passwordForm.newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters' });
            return;
        }

        setPasswordLoading(true);

        try {
            const res = await fetch('/api/profile/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: profile.id,
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword
                })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Failed to change password');
            }

            setMessage({ type: 'success', text: 'Password changed successfully!' });
            setPasswordDialogOpen(false);
            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setPasswordLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex bg-slate-50">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
                </main>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen flex bg-slate-50">
                <Sidebar />
                <main className="flex-1 flex items-center justify-center">
                    <p className="text-slate-500">Failed to load profile</p>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex bg-white">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                <Header />
                <div className="flex-1 overflow-y-auto p-6 lg:p-8">
                    <div className="max-w-4xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">My Profile</h1>
                                <p className="text-sm text-slate-500 mt-1">Manage your account settings and preferences</p>
                            </div>
                            <Button
                                onClick={() => setPasswordDialogOpen(true)}
                                variant="outline"
                                className="gap-2"
                            >
                                <Lock className="w-4 h-4" />
                                Change Password
                            </Button>
                        </div>

                        {/* Message */}
                        {message && (
                            <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                                {message.text}
                            </div>
                        )}

                        {/* Basic Information Card */}
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-slate-900">Basic Information</h2>
                                {!editMode ? (
                                    <Button onClick={() => setEditMode(true)} variant="outline" size="sm">
                                        Edit
                                    </Button>
                                ) : (
                                    <div className="flex gap-2">
                                        <Button onClick={() => setEditMode(false)} variant="outline" size="sm">
                                            Cancel
                                        </Button>
                                        <Button onClick={handleUpdateProfile} size="sm" disabled={saveLoading}>
                                            {saveLoading ? 'Saving...' : 'Save'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-700">Username</Label>
                                    <p className="text-slate-900">{profile.username}</p>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-700">Full Name</Label>
                                    {editMode ? (
                                        <Input
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        />
                                    ) : (
                                        <p className="text-slate-900">{profile.name || '-'}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-700">Email</Label>
                                    {editMode ? (
                                        <Input
                                            type="email"
                                            value={editForm.email}
                                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                        />
                                    ) : (
                                        <p className="text-slate-900">{profile.email}</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-sm font-medium text-slate-700">Role</Label>
                                    <Badge className="bg-primary text-white">{profile.role.replace(/_/g, ' ')}</Badge>
                                </div>
                                {profile.employeeId && (
                                    <div className="space-y-2">
                                        <Label className="text-sm font-medium text-slate-700">Employee ID</Label>
                                        <p className="text-slate-900">{profile.employeeId}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Assigned OPMCs */}
                        {profile.accessibleOpmcs && profile.accessibleOpmcs.length > 0 && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-200">
                                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                        <MapPin className="w-5 h-5" />
                                        Assigned Areas (OPMCs)
                                    </h2>
                                </div>
                                <div className="p-6">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {profile.accessibleOpmcs.map((opmc) => (
                                            <div key={opmc.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                                <p className="font-semibold text-slate-900">{opmc.rtom}</p>
                                                <p className="text-xs text-slate-600">{opmc.region} - {opmc.province}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Assigned Store */}
                        {profile.assignedStore && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-200">
                                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                        <Building2 className="w-5 h-5" />
                                        Assigned Store
                                    </h2>
                                </div>
                                <div className="p-6">
                                    <div className="flex items-start gap-4">
                                        <div className="flex-1">
                                            <p className="font-semibold text-slate-900">{profile.assignedStore.name}</p>
                                            <p className="text-sm text-slate-600 mt-1">{profile.assignedStore.location}</p>
                                            <Badge variant="outline" className="mt-2">{profile.assignedStore.type}</Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Section Assignments */}
                        {profile.sectionAssignments && profile.sectionAssignments.length > 0 && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-200">
                                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                        <Users className="w-5 h-5" />
                                        Section Assignments
                                    </h2>
                                </div>
                                <div className="p-6">
                                    <div className="space-y-3">
                                        {profile.sectionAssignments.map((assignment, idx) => (
                                            <div key={idx} className="p-4 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                                                <div>
                                                    <p className="font-semibold text-slate-900">{assignment.section.name}</p>
                                                    <p className="text-sm text-slate-600 mt-1">Role: {assignment.role.name}</p>
                                                </div>
                                                {assignment.isPrimary && (
                                                    <Badge className="bg-emerald-500 text-white">Primary</Badge>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Supervisor */}
                        {profile.supervisor && (
                            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-200">
                                    <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                                        <Shield className="w-5 h-5" />
                                        Supervisor
                                    </h2>
                                </div>
                                <div className="p-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                                            <User className="w-6 h-6 text-primary" />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-slate-900">{profile.supervisor.name}</p>
                                            <p className="text-sm text-slate-600">@{profile.supervisor.username}</p>
                                            <Badge variant="outline" className="mt-1">{profile.supervisor.role.replace(/_/g, ' ')}</Badge>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Account Information */}
                        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-slate-500">Member Since</p>
                                    <p className="font-medium text-slate-900">{new Date(profile.createdAt).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <p className="text-slate-500">Last Updated</p>
                                    <p className="font-medium text-slate-900">{new Date(profile.updatedAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Password Change Dialog */}
            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogDescription>
                            Enter your current password and choose a new password.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="current-password">Current Password</Label>
                            <div className="relative">
                                <Input
                                    id="current-password"
                                    type={showCurrentPassword ? "text" : "password"}
                                    value={passwordForm.currentPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new-password">New Password</Label>
                            <div className="relative">
                                <Input
                                    id="new-password"
                                    type={showNewPassword ? "text" : "password"}
                                    value={passwordForm.newPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirm-password">Confirm New Password</Label>
                            <div className="relative">
                                <Input
                                    id="confirm-password"
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={passwordForm.confirmPassword}
                                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleChangePassword} disabled={passwordLoading}>
                            {passwordLoading ? 'Changing...' : 'Change Password'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
