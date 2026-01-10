"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Plus, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";

// User Categories
const USER_CATEGORIES = {
    OSP_PROJECTS: {
        name: 'OSP Projects',
        roles: ['OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'AREA_COORDINATOR', 'QC_OFFICER']
    },
    NEW_CONNECTION: {
        name: 'New Connection',
        roles: ['MANAGER']
    },
    SERVICE_ASSURANCE: {
        name: 'Service Assurance',
        roles: ['SA_MANAGER', 'SA_ASSISTANT']
    },
    OFFICE_ADMIN: {
        name: 'Office Admin',
        roles: ['OFFICE_ADMIN', 'OFFICE_ADMIN_ASSISTANT']
    },
    INVOICE: {
        name: 'Invoice Section',
        roles: ['INVOICE_MANAGER', 'INVOICE_ASSISTANT']
    },
    STORES: {
        name: 'Stores',
        roles: ['STORES_MANAGER', 'STORES_ASSISTANT']
    },
    PROCUREMENT: {
        name: 'Procurement',
        roles: ['PROCUREMENT_OFFICER']
    },
    FINANCE: {
        name: 'Finance',
        roles: ['FINANCE_MANAGER', 'FINANCE_ASSISTANT']
    },
    ADMIN: {
        name: 'Administration',
        roles: ['SUPER_ADMIN', 'ADMIN']
    }
};

const ALL_ROLES = [
    { value: 'SUPER_ADMIN', label: 'Super Admin', category: 'ADMIN' },
    { value: 'ADMIN', label: 'Admin', category: 'ADMIN' },
    { value: 'OSP_MANAGER', label: 'OSP Manager', category: 'OSP_PROJECTS' },
    { value: 'AREA_MANAGER', label: 'Area Manager', category: 'OSP_PROJECTS' },
    { value: 'ENGINEER', label: 'Engineer', category: 'OSP_PROJECTS' },
    { value: 'ASSISTANT_ENGINEER', label: 'Assistant Engineer', category: 'OSP_PROJECTS' },
    { value: 'AREA_COORDINATOR', label: 'Area Coordinator', category: 'OSP_PROJECTS' },
    { value: 'QC_OFFICER', label: 'QC Officer', category: 'OSP_PROJECTS' },
    { value: 'MANAGER', label: 'Manager', category: 'NEW_CONNECTION' },
    { value: 'SA_MANAGER', label: 'SA Manager', category: 'SERVICE_ASSURANCE' },
    { value: 'SA_ASSISTANT', label: 'SA Assistant', category: 'SERVICE_ASSURANCE' },
    { value: 'OFFICE_ADMIN', label: 'Office Admin', category: 'OFFICE_ADMIN' },
    { value: 'OFFICE_ADMIN_ASSISTANT', label: 'Office Admin Assistant', category: 'OFFICE_ADMIN' },
    { value: 'INVOICE_MANAGER', label: 'Invoice Manager', category: 'INVOICE' },
    { value: 'INVOICE_ASSISTANT', label: 'Invoice Assistant', category: 'INVOICE' },
    { value: 'STORES_MANAGER', label: 'Stores Manager', category: 'STORES' },
    { value: 'STORES_ASSISTANT', label: 'Stores Assistant', category: 'STORES' },
    { value: 'PROCUREMENT_OFFICER', label: 'Procurement Officer', category: 'PROCUREMENT' },
    { value: 'FINANCE_MANAGER', label: 'Finance Manager', category: 'FINANCE' },
    { value: 'FINANCE_ASSISTANT', label: 'Finance Assistant', category: 'FINANCE' }
];

export default function UsersCategoryPage() {
    const queryClient = useQueryClient();
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) setCurrentUser(JSON.parse(stored));
    }, []);

    // Fetch users
    const { data: users = [], isLoading } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await fetch('/api/users?page=1&limit=1000');
            const data = await res.json();
            return data.users || (Array.isArray(data) ? data : []);
        }
    });

    // Get user's category
    const getUserCategory = (role: string) => {
        const roleInfo = ALL_ROLES.find(r => r.value === role);
        return roleInfo?.category || 'OTHER';
    };

    // Filter users based on selected category and permissions
    const filteredUsers = users.filter((user: any) => {
        const userCategory = getUserCategory(user.role);

        // Super Admin & Admin can see all
        if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN') {
            if (selectedCategory === 'ALL') return true;
            return userCategory === selectedCategory;
        }

        // Other users can only see their own category
        const currentUserCategory = getUserCategory(currentUser?.role);
        return userCategory === currentUserCategory;
    });

    // Get available categories for current user
    const availableCategories = Object.entries(USER_CATEGORIES).filter(([key]) => {
        if (currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN') return true;
        return getUserCategory(currentUser?.role) === key;
    });

    const getRoleBadgeColor = (role: string) => {
        if (role === 'SUPER_ADMIN') return 'bg-purple-100 text-purple-700';
        if (role === 'ADMIN') return 'bg-blue-100 text-blue-700';
        if (role.includes('MANAGER')) return 'bg-green-100 text-green-700';
        return 'bg-slate-100 text-slate-700';
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0 h-full">
                <Header />
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Header */}
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">User Management by Category</h1>
                            <p className="text-slate-500">View users organized by department</p>
                        </div>

                        {/* Category Tabs */}
                        <div className="flex gap-2 overflow-x-auto pb-2">
                            {(currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN') && (
                                <button
                                    onClick={() => setSelectedCategory('ALL')}
                                    className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${selectedCategory === 'ALL'
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    All Users ({users.length})
                                </button>
                            )}
                            {availableCategories.map(([key, category]) => {
                                const count = users.filter((u: any) => getUserCategory(u.role) === key).length;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => setSelectedCategory(key)}
                                        className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors ${selectedCategory === key
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-white text-slate-600 hover:bg-slate-100'
                                            }`}
                                    >
                                        {category.name} ({count})
                                    </button>
                                );
                            })}
                        </div>

                        {/* Users Table */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Users className="w-5 h-5" />
                                    {selectedCategory === 'ALL' ? 'All Users' : USER_CATEGORIES[selectedCategory as keyof typeof USER_CATEGORIES]?.name}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {isLoading ? (
                                    <div className="text-center p-8 text-slate-500">Loading...</div>
                                ) : filteredUsers.length === 0 ? (
                                    <div className="text-center p-8 text-slate-500">No users found in this category</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-100 border-b">
                                                <tr>
                                                    <th className="px-4 py-3 text-left">Name</th>
                                                    <th className="px-4 py-3 text-left">Username</th>
                                                    <th className="px-4 py-3 text-left">Email</th>
                                                    <th className="px-4 py-3 text-left">Role</th>
                                                    <th className="px-4 py-3 text-left">Category</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y">
                                                {filteredUsers.map((user: any) => (
                                                    <tr key={user.id} className="hover:bg-slate-50">
                                                        <td className="px-4 py-3 font-medium">{user.name}</td>
                                                        <td className="px-4 py-3">{user.username}</td>
                                                        <td className="px-4 py-3">{user.email || '-'}</td>
                                                        <td className="px-4 py-3">
                                                            <Badge className={getRoleBadgeColor(user.role)}>
                                                                {ALL_ROLES.find(r => r.value === user.role)?.label || user.role}
                                                            </Badge>
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <Badge variant="outline">
                                                                {USER_CATEGORIES[getUserCategory(user.role) as keyof typeof USER_CATEGORIES]?.name}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Info Box */}
                        <Card className="bg-blue-50 border-blue-200">
                            <CardContent className="p-4">
                                <p className="text-sm text-blue-900">
                                    <strong>Access Control:</strong> {currentUser?.role === 'SUPER_ADMIN' || currentUser?.role === 'ADMIN'
                                        ? 'You have full access to view all users across all categories.'
                                        : `You can only view users in your category: ${USER_CATEGORIES[getUserCategory(currentUser?.role) as keyof typeof USER_CATEGORIES]?.name}`
                                    }
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </main>
        </div>
    );
}
