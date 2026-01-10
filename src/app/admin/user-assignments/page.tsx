"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Shield, Layers, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function UserAssignmentPage() {
    const queryClient = useQueryClient();
    const [selectedUser, setSelectedUser] = useState<string>('');
    const [showDialog, setShowDialog] = useState(false);
    const [selectedSection, setSelectedSection] = useState<string>('');
    const [selectedRole, setSelectedRole] = useState<string>('');
    const [isPrimary, setIsPrimary] = useState(false);

    // Fetch users
    const { data: users = [] } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await fetch('/api/users?page=1&limit=1000');
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            return data.users || (Array.isArray(data) ? data : []);
        }
    });

    // Fetch sections
    const { data: sections = [] } = useQuery({
        queryKey: ['sections'],
        queryFn: async () => {
            const res = await fetch('/api/admin/sections');
            if (!res.ok) throw new Error('Failed');
            return res.json();
        }
    });

    // Fetch roles for selected section
    const { data: roles = [] } = useQuery({
        queryKey: ['section-roles', selectedSection],
        queryFn: async () => {
            if (!selectedSection) return [];
            const res = await fetch(`/api/admin/sections/${selectedSection}/roles`);
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        enabled: !!selectedSection
    });

    // Fetch user assignments
    const { data: assignments = [], isLoading } = useQuery({
        queryKey: ['user-assignments', selectedUser],
        queryFn: async () => {
            if (!selectedUser) return [];
            const res = await fetch(`/api/admin/users/${selectedUser}/sections`);
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        enabled: !!selectedUser
    });

    // Assign section/role to user
    const assignMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`/api/admin/users/${selectedUser}/sections`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Section assigned!');
            queryClient.invalidateQueries({ queryKey: ['user-assignments', selectedUser] });
            handleCloseDialog();
        },
        onError: () => toast.error('Failed to assign section')
    });

    // Remove assignment
    const removeMutation = useMutation({
        mutationFn: async (assignmentId: string) => {
            const res = await fetch(`/api/admin/users/${selectedUser}/sections/${assignmentId}`, {
                method: 'DELETE'
            });
            if (!res.ok) throw new Error('Failed');
            return res.json();
        },
        onSuccess: () => {
            toast.success('Assignment removed!');
            queryClient.invalidateQueries({ queryKey: ['user-assignments', selectedUser] });
        },
        onError: () => toast.error('Failed to remove assignment')
    });

    const handleCloseDialog = () => {
        setShowDialog(false);
        setSelectedSection('');
        setSelectedRole('');
        setIsPrimary(false);
    };

    const handleAssign = () => {
        if (!selectedSection || !selectedRole) {
            toast.error('Please select section and role');
            return;
        }
        assignMutation.mutate({
            sectionId: selectedSection,
            roleId: selectedRole,
            isPrimary
        });
    };

    const selectedUserData = users.find((u: any) => u.id === selectedUser);

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900">User Section Assignment</h1>
                                <p className="text-slate-500">Assign users to sections with specific roles</p>
                            </div>
                            {selectedUser && (
                                <Button onClick={() => setShowDialog(true)} className="bg-blue-600 hover:bg-blue-700">
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Assign Section
                                </Button>
                            )}
                        </div>

                        {/* User Selector */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Select User</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Select value={selectedUser} onValueChange={setSelectedUser}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Choose a user..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {users.map((user: any) => (
                                            <SelectItem key={user.id} value={user.id}>
                                                {user.name} ({user.username})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </CardContent>
                        </Card>

                        {/* User Assignments */}
                        {selectedUser && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Shield className="w-5 h-5" />
                                        {selectedUserData?.name}'s Section Assignments
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {isLoading ? (
                                        <div className="text-center p-8 text-slate-500">Loading...</div>
                                    ) : assignments.length === 0 ? (
                                        <div className="text-center p-8 text-slate-500">
                                            No sections assigned yet. Click "Assign Section" to add one.
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {assignments.map((assignment: any) => (
                                                <div
                                                    key={assignment.id}
                                                    className="flex items-center justify-between p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <Layers className="w-5 h-5 text-blue-600" />
                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-semibold">{assignment.section.name}</span>
                                                                {assignment.isPrimary && (
                                                                    <Badge className="bg-purple-100 text-purple-700">Primary</Badge>
                                                                )}
                                                            </div>
                                                            <div className="text-sm text-slate-600 flex items-center gap-2 mt-1">
                                                                <Shield className="w-3 h-3" />
                                                                {assignment.role.name}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            if (confirm('Remove this assignment?')) {
                                                                removeMutation.mutate(assignment.id);
                                                            }
                                                        }}
                                                        className="text-red-600 hover:text-red-700"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </div>
            </main>

            {/* Assign Dialog */}
            <Dialog open={showDialog} onOpenChange={setShowDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Assign Section & Role</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-600 uppercase">Section *</label>
                            <Select value={selectedSection} onValueChange={setSelectedSection}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Choose section..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {sections.map((section: any) => (
                                        <SelectItem key={section.id} value={section.id}>
                                            {section.icon} {section.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        {selectedSection && (
                            <div>
                                <label className="text-xs font-bold text-slate-600 uppercase">Role *</label>
                                <Select value={selectedRole} onValueChange={setSelectedRole}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Choose role..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {roles.map((role: any) => (
                                            <SelectItem key={role.id} value={role.id}>
                                                {role.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <Checkbox
                                checked={isPrimary}
                                onCheckedChange={(checked) => setIsPrimary(checked as boolean)}
                            />
                            <label className="text-sm">Set as primary section</label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                        <Button
                            onClick={handleAssign}
                            disabled={assignMutation.isPending}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {assignMutation.isPending ? 'Assigning...' : 'Assign'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
