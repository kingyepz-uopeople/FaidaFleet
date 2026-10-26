'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MoreHorizontal, Trash2, Edit, Plus } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { assertMutation, assertMutationRow } from '@/lib/db';
import { toastError, toastSuccess } from '@/lib/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { addAdminUser } from './actions';
import { FormDialog } from '@/components/form-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import {
  AdminFeedback,
  AdminPageHeader,
  AdminRecordList,
  AdminSearch,
  RowActionsTrigger,
  StatusBadge,
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
  if (role === 'super_admin') return 'danger' as const;
  if (role === 'admin') return 'info' as const;
  return 'neutral' as const;
}

const EMPTY_FORM = {
  email: '',
  full_name: '',
  role: 'admin' as AdminUser['role'],
  permissions: [] as string[],
};

export default function AdminUsersPage() {
  const preview = isAdminUiPreview();
  const [users, setUsers] = useState<AdminUser[]>(preview ? previewAdmins : []);
  const [loading, setLoading] = useState(!preview);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(preview ? 'super_admin' : null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        setCurrentUserId(user.id);
        const { data: myAdmin } = await supabase
          .from('admin_users')
          .select('role')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .maybeSingle();
        if (myAdmin) setCurrentUserRole(myAdmin.role);
      }
      const { data, error: err } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setUsers((data || []) as AdminUser[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load admin users';
      setError(message);
      toastError(message, 'Could not load admin users');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const needle = searchQuery.toLowerCase();
    return users.filter(
      (user) =>
        user.email.toLowerCase().includes(needle) || (user.full_name || '').toLowerCase().includes(needle),
    );
  }, [searchQuery, users]);

  const openCreate = () => {
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setEditingId(user.id);
    setFormData({
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      permissions: user.permissions || [],
    });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      if (!formData.email.trim() || !formData.full_name.trim()) {
        throw new Error('Email and name are required');
      }
      if (editingId) {
        const result = await supabase
          .from('admin_users')
          .update({
            email: formData.email.trim().toLowerCase(),
            full_name: formData.full_name.trim(),
            role: formData.role,
            permissions: formData.permissions,
          })
          .eq('id', editingId)
          .select('id');

        assertMutationRow(result, 'Could not update the admin user');
        setSuccess('Admin user updated.');
        toastSuccess('Admin user updated.', 'Saved');
      } else {
        const result = await addAdminUser({
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          permissions: formData.permissions,
        });
        if (!result.success) throw new Error(result.error || 'Could not create the admin user');
        setSuccess(result.message || 'Admin user created.');
        toastSuccess(result.message || 'Admin user created.', 'Saved');
      }
      setDialogOpen(false);
      await fetchUsers();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not save the admin user';
      setFormError(message);
      toastError(message, 'Could not save the admin user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (user: AdminUser) => {
    if (user.id === currentUserId) {
      toastError('You cannot delete the account you are signed in with.', 'Not allowed');
      return;
    }
    if (!window.confirm(`Remove admin access for ${user.email}? The auth account is not deleted.`)) return;
    try {
      const result = await supabase.from('admin_users').delete().eq('id', user.id).select('id');
      assertMutation(result, 'Could not delete the admin user');
      setSuccess('Admin user deleted.');
      toastSuccess('Admin user deleted.', 'Deleted');
      await fetchUsers();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      toastError(err, 'Could not delete the admin user');
    }
  };

  const toggleUserStatus = async (user: AdminUser) => {
    if (user.id === currentUserId) {
      toastError('You cannot deactivate the account you are signed in with.', 'Not allowed');
      return;
    }
    try {
      const result = await supabase
        .from('admin_users')
        .update({ is_active: !user.is_active })
        .eq('id', user.id)
        .select('id');
      assertMutation(result, 'Could not update the admin user');
      toastSuccess(user.is_active ? 'Admin deactivated.' : 'Admin activated.');
      await fetchUsers();
    } catch (err) {
      toastError(err, 'Could not update the admin user');
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Admin users"
        description="System admins sign in with email and password, not a PIN. Use Fleet owners and Drivers to set fleet PINs."
        actions={
          currentUserRole === 'super_admin' ? (
            <Button type="button" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add admin
            </Button>
          ) : undefined
        }
      />

      <AdminFeedback error={error} success={success} />
      <AdminSearch value={searchQuery} onChange={setSearchQuery} placeholder="Search by email or name…" />

      <AdminRecordList
        rows={filteredUsers}
        rowKey={(row) => row.id}
        loading={loading}
        emptyTitle="No admin users"
        emptyDescription="Add an admin to give someone access to this console."
        columns={[
          { id: 'name', header: 'Name', cell: (row) => <span className="font-medium">{row.full_name || '—'}</span> },
          { id: 'email', header: 'Email', cell: (row) => row.email },
          { id: 'role', header: 'Role', cell: (row) => <StatusBadge tone={roleTone(row.role)}>{titleCase(row.role)}</StatusBadge> },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge tone={row.is_active ? 'success' : 'neutral'}>{row.is_active ? 'Active' : 'Inactive'}</StatusBadge> },
        ]}
        actions={(user) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <RowActionsTrigger>
                <MoreHorizontal className="h-4 w-4" />
              </RowActionsTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(user)} className="min-h-11 cursor-pointer">
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleUserStatus(user)} className="min-h-11 cursor-pointer">
                {user.is_active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDelete(user)} className="min-h-11 cursor-pointer text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingId ? 'Edit admin' : 'Create admin'}
        description={
          editingId
            ? 'Change the name, role, or status of this administrator.'
            : 'An invitation email is sent so the new admin can set their password.'
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin_email">Email *</Label>
            <Input
              id="admin_email"
              type="email"
              autoComplete="off"
              value={formData.email}
              onChange={(event) => setFormData({ ...formData, email: event.target.value })}
              required
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin_name">Full name *</Label>
            <Input
              id="admin_name"
              value={formData.full_name}
              onChange={(event) => setFormData({ ...formData, full_name: event.target.value })}
              required
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin_role">Role</Label>
            <NativeSelect
              id="admin_role"
              value={formData.role}
              onChange={(event) => setFormData({ ...formData, role: event.target.value as AdminUser['role'] })}
              disabled={submitting}
            >
              <option value="super_admin">Super admin</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
            </NativeSelect>
          </div>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" className="min-h-11" disabled={submitting}>
              {submitting ? 'Saving…' : editingId ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
      </FormDialog>
    </>
  );
}
