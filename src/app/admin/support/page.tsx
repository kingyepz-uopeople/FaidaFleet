'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, MoreHorizontal } from '@/components/icons';
import { createClient } from '@/lib/supabase/client';
import { assertMutation, assertMutationRow } from '@/lib/db';
import { toastError, toastSuccess } from '@/lib/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FormDialog } from '@/components/form-dialog';
import { NativeSelect } from '@/components/ui/native-select';
import {
  AdminFeedback,
  AdminKpi,
  AdminPageHeader,
  AdminRecordList,
  AdminSearch,
  RowActionsTrigger,
  StatusBadge,
  formatDate,
  titleCase,
} from '@/components/admin-ui';
import { isAdminUiPreview, previewTickets } from '@/lib/admin-preview';

type TicketStatus = 'open' | 'pending' | 'resolved' | 'closed';
type TicketPriority = 'low' | 'medium' | 'high';

type Ticket = {
  id: string;
  title: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority | null;
  tenants: { name: string } | null;
  created_at: string;
};

type TenantOption = { id: string; name: string };

function statusTone(status: string) {
  if (status === 'open') return 'danger' as const;
  if (status === 'resolved') return 'success' as const;
  if (status === 'pending') return 'warning' as const;
  return 'neutral' as const;
}

const EMPTY_FORM = {
  title: '',
  description: '',
  priority: 'medium' as TicketPriority,
  tenantId: '',
};

export default function SupportPage() {
  const preview = isAdminUiPreview();
  const [tickets, setTickets] = useState<Ticket[]>(preview ? previewTickets : []);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(!preview);
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTickets = async () => {
    try {
      if (isAdminUiPreview()) {
        setTickets(previewTickets as Ticket[]);
        return;
      }
      const [ticketsRes, tenantsRes] = await Promise.all([
        supabase.from('support_tickets').select('*, tenants(name)').order('created_at', { ascending: false }),
        supabase.from('tenants').select('id, name').order('name'),
      ]);
      if (ticketsRes.error) throw ticketsRes.error;
      if (tenantsRes.error) throw tenantsRes.error;
      setTickets((ticketsRes.data || []) as Ticket[]);
      setTenants(tenantsRes.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load tickets';
      setError(message);
      toastError(message, 'Could not load tickets');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setFormData({ ...EMPTY_FORM, tenantId: tenants[0]?.id || '' });
    setFormError(null);
    setDialogOpen(true);
  };

  const handleCreateTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You need to sign in again.');
      if (!formData.title.trim()) throw new Error('Ticket title is required');
      if (!formData.tenantId) throw new Error('Choose the fleet this ticket belongs to');

      const result = await supabase
        .from('support_tickets')
        .insert({
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          priority: formData.priority,
          status: 'open',
          tenant_id: formData.tenantId,
          created_by: user.id,
        })
        .select('id');

      assertMutationRow(result, 'Could not create the ticket');
      setSuccess('Ticket created.');
      toastSuccess('Ticket created.', 'Saved');
      setDialogOpen(false);
      setFormData(EMPTY_FORM);
      await fetchTickets();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create the ticket';
      setFormError(message);
      toastError(message, 'Could not create the ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (ticket: Ticket, newStatus: TicketStatus) => {
    try {
      const result = await supabase
        .from('support_tickets')
        .update({ status: newStatus })
        .eq('id', ticket.id)
        .select('id');
      assertMutation(result, 'Could not update the ticket');
      toastSuccess(`Ticket marked ${newStatus}.`);
      await fetchTickets();
    } catch (err) {
      toastError(err, 'Could not update the ticket');
    }
  };

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    return tickets.filter(
      (ticket) =>
        !needle ||
        ticket.title.toLowerCase().includes(needle) ||
        ticket.tenants?.name?.toLowerCase().includes(needle),
    );
  }, [query, tickets]);

  const stats = {
    open: tickets.filter((ticket) => ticket.status === 'open').length,
    pending: tickets.filter((ticket) => ticket.status === 'pending').length,
    resolved: tickets.filter((ticket) => ticket.status === 'resolved').length,
  };

  return (
    <>
      <AdminPageHeader
        title="Support"
        description="Fleet owner support requests."
        actions={
          <Button type="button" onClick={openCreate} disabled={tenants.length === 0 && !preview}>
            <Plus className="h-4 w-4" />
            New ticket
          </Button>
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
              <RowActionsTrigger>
                <MoreHorizontal className="h-4 w-4" />
              </RowActionsTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ticket.status !== 'resolved' && (
                <DropdownMenuItem onClick={() => updateStatus(ticket, 'resolved')} className="min-h-11 cursor-pointer">
                  Mark resolved
                </DropdownMenuItem>
              )}
              {ticket.status !== 'pending' && (
                <DropdownMenuItem onClick={() => updateStatus(ticket, 'pending')} className="min-h-11 cursor-pointer">
                  Mark pending
                </DropdownMenuItem>
              )}
              {ticket.status !== 'open' && (
                <DropdownMenuItem onClick={() => updateStatus(ticket, 'open')} className="min-h-11 cursor-pointer">
                  Reopen
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <FormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Create support ticket"
        description="Log a request against the fleet it belongs to."
      >
        <form onSubmit={handleCreateTicket} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ticket_tenant">Fleet *</Label>
            <NativeSelect
              id="ticket_tenant"
              value={formData.tenantId}
              onChange={(event) => setFormData({ ...formData, tenantId: event.target.value })}
              required
              disabled={submitting}
            >
              <option value="">Select a fleet</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>{tenant.name}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket_title">Title *</Label>
            <Input
              id="ticket_title"
              value={formData.title}
              onChange={(event) => setFormData({ ...formData, title: event.target.value })}
              required
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket_description">Description</Label>
            <textarea
              id="ticket_description"
              value={formData.description}
              onChange={(event) => setFormData({ ...formData, description: event.target.value })}
              rows={4}
              disabled={submitting}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ticket_priority">Priority</Label>
            <NativeSelect
              id="ticket_priority"
              value={formData.priority}
              onChange={(event) => setFormData({ ...formData, priority: event.target.value as TicketPriority })}
              disabled={submitting}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
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
              {submitting ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </FormDialog>
    </>
  );
}
