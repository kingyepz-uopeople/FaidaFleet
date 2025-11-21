'use client';

import React, { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Search, MoreHorizontal, Trash2, Edit, Plus } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  role: 'super_admin' | 'admin' | 'moderator';
  permissions: string[];
  is_active: boolean;
  created_at: string;
  last_login: string | null;
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  super_admin: 'Full system access',
  admin: 'Manage fleets and drivers',
  moderator: 'View and support only',
};

const PERMISSION_OPTIONS = [
  { id: 'manage_fleets', label: 'Manage Fleet Owners' },
  { id: 'manage_drivers', label: 'Manage Drivers' },
  { id: 'manage_plans', label: 'Manage Plans' },
  { id: 'view_analytics', label: 'View Analytics' },
  { id: 'manage_users', label: 'Manage Admin Users' },
  { id: 'manage_settings', label: 'Manage Settings' },
];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([
    {
      id: '1',
      email: 'admin@faidafleet.com',
      full_name: 'System Admin',
      role: 'super_admin',
      permissions: PERMISSION_OPTIONS.map((p) => p.id),
      is_active: true,
      created_at: '2024-01-01',
      last_login: '2024-11-21',
    },
  ]);
  const [filteredUsers, setFilteredUsers] = useState<AdminUser[]>(users);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'admin' as const,
    permissions: [] as string[],
  });

  useEffect(() => {
    const filtered = users.filter((user) =>
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  const handleOpenDialog = (user?: AdminUser) => {
    if (user) {
      setEditingId(user.id);
      setFormData({
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        permissions: user.permissions,
      });
    } else {
      setEditingId(null);
      setFormData({
        email: '',
        full_name: '',
        role: 'admin',
        permissions: [],
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!formData.email || !formData.full_name) {
        throw new Error('Email and name are required');
      }

      if (editingId) {
        setUsers(
          users.map((u) =>
            u.id === editingId
              ? {
                  ...u,
                  email: formData.email,
                  full_name: formData.full_name,
                  role: formData.role,
                  permissions: formData.permissions,
                }
              : u
          )
        );
        setSuccess('Admin user updated successfully');
      } else {
        const newUser: AdminUser = {
          id: Date.now().toString(),
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          permissions: formData.permissions,
          is_active: true,
          created_at: new Date().toISOString().split('T')[0],
          last_login: null,
        };
        setUsers([newUser, ...users]);
        setSuccess('Admin user created successfully');
      }

      setDialogOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = (userId: string) => {
    if (userId === '1') {
      setError('Cannot delete the system admin account');
      setTimeout(() => setError(null), 3000);
      return;
    }

    if (!window.confirm('Are you sure you want to delete this admin user?')) return;

    setUsers(users.filter((u) => u.id !== userId));
    setSuccess('Admin user deleted successfully');
    setTimeout(() => setSuccess(null), 3000);
  };

  const toggleUserStatus = (userId: string) => {
    if (userId === '1') {
      setError('Cannot deactivate the system admin account');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setUsers(
      users.map((u) => (u.id === userId ? { ...u, is_active: !u.is_active } : u))
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'super_admin':
        return 'bg-red-100 text-red-800';
      case 'admin':
        return 'bg-blue-100 text-blue-800';
      case 'moderator':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Users</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage system admin accounts and permissions</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()} className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Admin User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Admin User' : 'Create Admin User'}</DialogTitle>
              <DialogDescription>
                {editingId ? 'Update admin user details' : 'Add a new system administrator'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="admin@company.com"
                  required
                />
              </div>
              <div>
                <Label htmlFor="full_name">Full Name *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>
              <div>
                <Label htmlFor="role">Role *</Label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md dark:bg-gray-800 dark:border-gray-600"
                  required
                >
                  <option value="super_admin">Super Admin - Full Access</option>
                  <option value="admin">Admin - Manage Fleets & Drivers</option>
                  <option value="moderator">Moderator - View & Support Only</option>
                </select>
              </div>
              <div>
                <Label>Permissions</Label>
                <div className="space-y-2 mt-2">
                  {PERMISSION_OPTIONS.map((perm) => (
                    <label key={perm.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.permissions.includes(perm.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              permissions: [...formData.permissions, perm.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              permissions: formData.permissions.filter((p) => p !== perm.id),
                            });
                          }
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="bg-red-600 hover:bg-red-700">
                  {submitting ? 'Saving...' : editingId ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="bg-green-50 text-green-800 border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          placeholder="Search by email or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Users</CardTitle>
          <CardDescription>Total: {filteredUsers.length} users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="w-10">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No admin users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name}</TableCell>
                      <TableCell className="text-sm">{user.email}</TableCell>
                      <TableCell>
                        <Badge className={getRoleColor(user.role)}>
                          {user.role.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{user.permissions.length} permissions</TableCell>
                      <TableCell>
                        <Badge
                          className={
                            user.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleOpenDialog(user)}
                              className="cursor-pointer"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {user.id !== '1' && (
                              <DropdownMenuItem
                                onClick={() => toggleUserStatus(user.id)}
                                className="cursor-pointer"
                              >
                                {user.is_active ? 'Deactivate' : 'Activate'}
                              </DropdownMenuItem>
                            )}
                            {user.id !== '1' && (
                              <DropdownMenuItem
                                onClick={() => handleDelete(user.id)}
                                className="cursor-pointer text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Role Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Role Reference</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(ROLE_DESCRIPTIONS).map(([role, desc]) => (
            <div key={role} className="flex items-start gap-3 pb-3 border-b last:pb-0 last:border-0">
              <Badge className={getRoleColor(role)}>
                {role.replace('_', ' ').toUpperCase()}
              </Badge>
              <p className="text-sm text-gray-600 dark:text-gray-400">{desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
