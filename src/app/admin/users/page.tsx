'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { MoreHorizontal, Trash2, Edit, Plus } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { addAdminUser } from './actions';
import {
  AdminFeedback,
  AdminPageHeader,
  AdminRecordList,
  AdminSearch,
  RowActionsTrigger,
  StatusBadge,
  adminSelectClass,
  titleCase,
} from '@/components/admin-ui';
import { isAdminUiPreview, previewAdmins } from '@/lib/admin-preview';

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

function roleTone(role: string) {
  if (role === 'super_admin') return 'danger' as const
  if (role === 'admin') return 'info' as const
  return 'neutral' as const
}

export default function AdminUsersPage() {
  const preview = isAdminUiPreview();
  const [users, setUsers] = useState<AdminUser[]>(preview ? previewAdmins : []);
  const [loading, setLoading] = useState(!preview);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(preview ? 'super_admin' : null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'admin' as 'super_admin' | 'admin' | 'moderator',
    permissions: [] as string[],
  });
  const supabase = createClient();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      if (isAdminUiPreview()) {
        setUsers(previewAdmins);
        setCurrentUserRole('super_admin');
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: myAdmin } = await supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        if (myAdmin) setCurrentUserRole(myAdmin.role);
      }
      const { data, error: err } = await supabase.from('admin_users').select('*').order('created_at', { ascending: false });
      if (err) throw err;
      setUsers((data || []) as AdminUser[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    return users.filter((user) => user.email.toLowerCase().includes(needle) || user.full_name.toLowerCase().includes(needle));
  }, [searchQuery, users]);

  const handleOpenDialog = (user?: AdminUser) => {
    if (user) {
      setEditingId(user.id);
      setFormData({ email: user.email, full_name: user.full_name, role: user.role, permissions: user.permissions || [] });
    } else {
      setEditingId(null);
      setFormData({ email: '', full_name: '', role: 'admin', permissions: [] });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (!formData.email || !formData.full_name) throw new Error('Email and name are required');
      if (editingId) {
        const { error: err } = await supabase.from('admin_users').update({
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          permissions: formData.permissions,
        }).eq('id', editingId);
        if (err) throw err;
        setSuccess('Admin user updated successfully');
      } else {
        const result = await addAdminUser({
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          permissions: formData.permissions,
        });
        if (!result.success) throw new Error(result.error || 'Failed to create admin user');
        setSuccess(result.message || 'Admin user created successfully');
      }
      setDialogOpen(false);
      await fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (userId: string) => {
    if (!window.confirm('Are you sure you want to delete this admin user?')) return;
    try {
      const { error: err } = await supabase.from('admin_users').delete().eq('id', userId);
      if (err) throw err;
      setSuccess('Admin user deleted successfully');
      await fetchUsers();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error: err } = await supabase.from('admin_users').update({ is_active: !currentStatus }).eq('id', userId);
      if (err) throw err;
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Admin users"
        description="System admins sign in with email and password, not a PIN. Use Fleet owners and Drivers to set fleet PINs."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            {currentUserRole === 'super_admin' && (
              <DialogTrigger asChild>
                <Button onClick={() => handleOpenDialog()}>
                  <Plus className="h-4 w-4" />
                  Add admin
                </Button>
              </DialogTrigger>
            )}
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit admin' : 'Create admin'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input type="email" autoComplete="username" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Full name *</Label>
                  <Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as AdminUser['role'] })} className={adminSelectClass}>
                    <option value="super_admin">Super admin</option>
                    <option value="admin">Admin</option>
                    <option value="moderator">Moderator</option>
                  </select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editingId ? 'Update' : 'Create'}</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <AdminFeedback error={error} success={success} />
      <AdminSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search by email or name…" />

      <AdminRecordList
        rows={filteredUsers}
        rowKey={(row) => row.id}
        loading={loading}
        emptyTitle="No admin users"
        columns={[
          { id: 'name', header: 'Name', cell: (row) => <span className="font-medium">{row.full_name}</span> },
          { id: 'email', header: 'Email', cell: (row) => row.email },
          { id: 'role', header: 'Role', cell: (row) => <StatusBadge tone={roleTone(row.role)}>{titleCase(row.role)}</StatusBadge> },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</StatusBadge> },
        ]}
        actions={(user) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <RowActionsTrigger><MoreHorizontal className="h-4 w-4" /></RowActionsTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleOpenDialog(user)} className="cursor-pointer min-h-11">
                <Edit className="h-4 w-4 mr-2" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleUserStatus(user.id, user.is_active)} className="cursor-pointer min-h-11">
                {user.is_active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(user.id)} className="cursor-pointer min-h-11 text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </>
  );
}
