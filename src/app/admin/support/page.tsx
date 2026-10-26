'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { isAdminUiPreview, previewTickets, previewTenants } from '@/lib/admin-preview';
import { SafeDialog, SafeDialogContent } from '@/components/safe-dialog';
import { requireRows } from '@/lib/supabase/mutations';
import { assertUuid } from '@/lib/validation';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/lib/database.types';

type TicketRow = Database['public']['Tables']['support_tickets']['Row'] & {
  tenants: { name: string } | null;
};

type TenantOption = { id: string; name: string };
type TicketStatus = Database['public']['Tables']['support_tickets']['Row']['status'];
type TicketPriority = NonNullable<Database['public']['Tables']['support_tickets']['Row']['priority']>;

const PRIORITIES: TicketPriority[] = ['low', 'medium', 'high'];

type TicketForm = {
  title: string;
  description: string;
  priority: TicketPriority;
  tenant_id: string;
};

const EMPTY_FORM: TicketForm = { title: '', description: '', priority: 'medium', tenant_id: '' };

function statusTone(status: string) {
  if (status === 'open') return 'danger' as const
  if (status === 'resolved') return 'success' as const
  if (status === 'pending') return 'warning' as const
  return 'neutral' as const
}

export default function SupportPage() {
  const preview = isAdminUiPreview();
  const [tickets, setTickets] = useState<TicketRow[]>(preview ? (previewTickets as unknown as TicketRow[]) : []);
  const [tenants, setTenants] = useState<TenantOption[]>(preview ? previewTenants.map((t) => ({ id: t.id, name: t.name })) : []);
  const [loading, setLoading] = useState(!preview);
  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<TicketForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    void fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchTickets = async () => {
    try {
      if (isAdminUiPreview()) {
        setTickets(previewTickets as unknown as TicketRow[]);
        setTenants(previewTenants.map((t) => ({ id: t.id, name: t.name })));
        return;
      }
      const [ticketsRes, tenantsRes] = await Promise.all([
        supabase
          .from('support_tickets')
          .select('*, tenants(name)')
          .order('created_at', { ascending: false }),
        supabase.from('tenants').select('id, name').eq('is_active', true).order('name'),
      ]);
      if (ticketsRes.error) throw ticketsRes.error;
      if (tenantsRes.error) throw tenantsRes.error;
      setTickets((ticketsRes.data as unknown as TicketRow[]) || []);
      setTenants(tenantsRes.data || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = () => {
    setFormData({ ...EMPTY_FORM, tenant_id: tenants[0]?.id || '' });
    setDialogOpen(true);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      assertUuid(formData.tenant_id, 'Fleet company');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to create a ticket.');

      await requireRows(
        supabase
          .from('support_tickets')
          .insert([{
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            priority: formData.priority,
            status: 'open' as TicketStatus,
            tenant_id: formData.tenant_id,
            created_by: user.id,
          }])
          .select('id'),
        'support ticket',
        'create',
      );
      toast({ title: 'Ticket created', description: 'The support team can now see this request.' });
      setDialogOpen(false);
      setFormData(EMPTY_FORM);
      await fetchTickets();
    } catch (err) {
      toast({
        title: 'Could not create ticket',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (ticketId: string, newStatus: TicketStatus) => {
    try {
      assertUuid(ticketId, 'Ticket');
      await requireRows(
        supabase.from('support_tickets').update({ status: newStatus }).eq('id', ticketId).select('id'),
        'support ticket',
        'update',
      );
      toast({ title: 'Ticket updated', description: `Status changed to ${titleCase(newStatus)}.` });
      await fetchTickets();
    } catch (err) {
      toast({
        title: 'Could not update ticket',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
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
          <Button onClick={handleOpenDialog}>
            <Plus className="h-4 w-4" />
            New ticket
          </Button>
        }
      />

      <AdminFeedback error={error} />
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
          { id: 'priority', header: 'Priority', cell: (row) => titleCase(row.priority || 'medium'), hideOnMobile: true },
          { id: 'created', header: 'Created', cell: (row) => formatDate(row.created_at), hideOnMobile: true },
        ]}
        actions={(ticket) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <RowActionsTrigger><MoreHorizontal className="h-4 w-4" /></RowActionsTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {ticket.status !== 'resolved' && (
                <DropdownMenuItem onClick={() => updateStatus(ticket.id, 'resolved')} className="min-h-11 cursor-pointer">Mark resolved</DropdownMenuItem>
              )}
              {ticket.status !== 'pending' && (
                <DropdownMenuItem onClick={() => updateStatus(ticket.id, 'pending')} className="min-h-11 cursor-pointer">Mark pending</DropdownMenuItem>
              )}
              {ticket.status !== 'open' && (
                <DropdownMenuItem onClick={() => updateStatus(ticket.id, 'open')} className="min-h-11 cursor-pointer">Reopen ticket</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      />

      <SafeDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <SafeDialogContent>
          <DialogHeader>
            <DialogTitle>Create support ticket</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ticket-tenant">Fleet company *</Label>
              <select
                id="ticket-tenant"
                value={formData.tenant_id}
                onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                className={adminSelectClass}
                required
              >
                <option value="" disabled>Select a fleet company</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-title">Title *</Label>
              <Input id="ticket-title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-description">Description</Label>
              <textarea
                id="ticket-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-priority">Priority</Label>
              <select
                id="ticket-priority"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as TicketPriority })}
                className={adminSelectClass}
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{titleCase(p)}</option>)}
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>Cancel</Button>
              <Button type="submit" disabled={submitting || tenants.length === 0}>
                {submitting ? 'Creating…' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </SafeDialogContent>
      </SafeDialog>
    </>
  );
}
