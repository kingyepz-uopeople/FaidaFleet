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
import { Plus, MoreHorizontal } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AdminFeedback,
  AdminKpi,
  AdminPageHeader,
  AdminRecordList,
  AdminSearch,
  RowActionsTrigger,
  StatusBadge,
  adminSelectClass,
  formatDate,
  titleCase,
} from '@/components/admin-ui';
import { isAdminUiPreview, previewTickets } from '@/lib/admin-preview';

type Ticket = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  tenants: { name: string };
  created_at: string;
};

function statusTone(status: string) {
  if (status === 'open') return 'danger' as const
  if (status === 'resolved') return 'success' as const
  if (status === 'pending') return 'warning' as const
  return 'neutral' as const
}

export default function SupportPage() {
  const preview = isAdminUiPreview();
  const [tickets, setTickets] = useState<Ticket[]>(preview ? previewTickets : []);
  const [loading, setLoading] = useState(!preview);
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      if (isAdminUiPreview()) {
        setTickets(previewTickets);
        return;
      }
      const { data, error: err } = await supabase
        .from('support_tickets')
        .select('*, tenants(name)')
        .order('created_at', { ascending: false });
      if (err) throw err;
      setTickets((data || []) as Ticket[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: memberships } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user?.id || '')
        .limit(1);
      if (!memberships?.[0]) throw new Error('No tenant found');
      const { error: err } = await supabase.from('support_tickets').insert([{
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        status: 'open',
        tenant_id: memberships[0].tenant_id,
        created_by: user?.id,
      }]);
      if (err) throw err;
      setSuccess('Ticket created successfully');
      setDialogOpen(false);
      setFormData({ title: '', description: '', priority: 'medium' });
      await fetchTickets();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (ticketId: string, newStatus: string) => {
    try {
      const { error: err } = await supabase.from('support_tickets').update({ status: newStatus }).eq('id', ticketId);
      if (err) throw err;
      await fetchTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ticket');
    }
  };

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return tickets.filter((t) => !needle || t.title.toLowerCase().includes(needle) || t.tenants?.name?.toLowerCase().includes(needle));
  }, [query, tickets]);

  const stats = {
    open: tickets.filter((t) => t.status === 'open').length,
    pending: tickets.filter((t) => t.status === 'pending').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
  };

  return (
    <>
      <AdminPageHeader
        title="Support"
        description="Fleet owner support requests."
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4" />
                New ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create support ticket</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div className="space-y-2">
                  <Label>Title *</Label>
                  <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" />
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <select value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: e.target.value })} className={adminSelectClass}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>Create</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <AdminFeedback error={error} success={success} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AdminKpi title="Open" value={String(stats.open)} />
        <AdminKpi title="Pending" value={String(stats.pending)} />
        <AdminKpi title="Resolved" value={String(stats.resolved)} />
      </div>
      <AdminSearch value={query} onChange={setQuery} placeholder="Search tickets or fleets…" />

      <AdminRecordList
        rows={filtered}
        rowKey={(row) => row.id}
        loading={loading}
        emptyTitle="No tickets"
        emptyDescription="New support requests appear here."
        columns={[
          { id: 'title', header: 'Title', cell: (row) => <span className="font-medium">{row.title}</span> },
          { id: 'fleet', header: 'Fleet', cell: (row) => row.tenants?.name || '—' },
          { id: 'status', header: 'Status', cell: (row) => <StatusBadge tone={statusTone(row.status)}>{titleCase(row.status)}</StatusBadge> },
          { id: 'priority', header: 'Priority', cell: (row) => titleCase(row.priority), hideOnMobile: true },
          { id: 'created', header: 'Created', cell: (row) => formatDate(row.created_at), hideOnMobile: true },
        ]}
        actions={(ticket) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <RowActionsTrigger><MoreHorizontal className="h-4 w-4" /></RowActionsTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ticket.status !== 'resolved' && (
                <DropdownMenuItem onClick={() => updateStatus(ticket.id, 'resolved')} className="cursor-pointer min-h-11">Mark resolved</DropdownMenuItem>
              )}
              {ticket.status !== 'pending' && (
                <DropdownMenuItem onClick={() => updateStatus(ticket.id, 'pending')} className="cursor-pointer min-h-11">Mark pending</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />
    </>
  );
}
