'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { SafeDialog, SafeDialogContent } from '@/components/safe-dialog';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { requireRows } from '@/lib/supabase/mutations';
import { assertUuid } from '@/lib/validation';
import { useToast } from '@/hooks/use-toast';

type AdminRole = 'super_admin' | 'admin' | 'moderator';

type AdminUser = {
  id: string;
  email: string;
  full_name: string;
  role: AdminRole;
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
  const [users, setUsers] = useState<AdminUser[]>(preview ? (previewAdmins as unknown as AdminUser[]) : []);
  const [loading, setLoading] = useState(!preview);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(preview ? 'super_admin' : null);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState<{ email: string; full_name: string; role: AdminRole; permissions: string[] }>({
    email: '',
    full_name: '',
    role: 'admin',
    permissions: [],
  });
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    void fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      if (isAdminUiPreview()) {
        setUsers(previewAdmins as unknown as AdminUser[]);
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
      setError(null);
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
    try {
      if (!formData.email || !formData.full_name) throw new Error('Email and name are required');
      if (editingId) {
        assertUuid(editingId, 'Admin user');
        await requireRows(
          supabase.from('admin_users').update({
            email: formData.email.trim(),
            full_name: formData.full_name.trim(),
            role: formData.role,
            permissions: formData.permissions,
          }).eq('id', editingId).select('id'),
          'admin user',
          'update',
        );
        toast({ title: 'Admin user updated', description: `${formData.full_name} was saved.` });
      } else {
        const result = await addAdminUser({
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          permissions: formData.permissions,
        });
        if (!result.success) throw new Error(result.error || 'Failed to create admin user');
        toast({ title: 'Admin user created', description: result.message || 'The admin can now sign in.' });
      }
      setDialogOpen(false);
      await fetchUsers();
    } catch (err) {
      toast({
        title: editingId ? 'Could not update admin user' : 'Could not create admin user',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      assertUuid(deleteTarget.id, 'Admin user');
      await requireRows(
        supabase.from('admin_users').delete().eq('id', deleteTarget.id).select('id'),
        'admin user',
        'delete',
      );
      toast({ title: 'Admin user deleted', description: `${deleteTarget.full_name} was removed.` });
      setDeleteTarget(null);
      await fetchUsers();
    } catch (err) {
      toast({
        title: 'Could not delete admin user',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      assertUuid(userId, 'Admin user');
      await requireRows(
        supabase.from('admin_users').update({ is_active: !currentStatus }).eq('id', userId).select('id'),
        'admin user',
        'update',
      );
      await fetchUsers();
    } catch (err) {
      toast({
        title: 'Could not update admin user',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Admin users"
        description="System admins sign in with email and password, not a PIN. Use Fleet owners and Drivers to set fleet PINs."
        actions={
          currentUserRole === 'super_admin' ? (
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4" />
              Add admin
            </Button>
          ) : null
        }
      />

      <AdminFeedback error={error} />
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
              <DropdownMenuItem onClick={() => handleOpenDialog(user)} className="min-h-11 cursor-pointer">
                <Edit className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleUserStatus(user.id, user.is_active)} className="min-h-11 cursor-pointer">
                {user.is_active ? 'Deactivate' : 'Activate'}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDeleteTarget(user)} className="min-h-11 cursor-pointer text-destructive">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <SafeDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <SafeDialogContent className="max-w-md">
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
              <select value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value as AdminRole })} className={adminSelectClass}>
                <option value="super_admin">Super admin</option>
                <option value="admin">Admin</option>
                <option value="moderator">Moderator</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting}>{submitting ? 'Saving…' : editingId ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </SafeDialogContent>
      </SafeDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title="Delete admin user?"
        description={deleteTarget ? `${deleteTarget.full_name} (${deleteTarget.email}) will lose administrator access immediately.` : undefined}
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
