'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, MoreHorizontal } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type Ticket = {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  tenants: { name: string };
  created_at: string;
};

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
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
      const { data, error: err } = await supabase
        .from('support_tickets')
        .select('*, tenants(name)')
        .order('created_at', { ascending: false });

      if (err) throw err;
      setTickets(data || []);
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
      
      // Get first tenant for now - in real app, user would select
      const { data: memberships } = await supabase
        .from('memberships')
        .select('tenant_id')
        .eq('user_id', user?.id)
        .limit(1);

      if (!memberships?.[0]) throw new Error('No tenant found');

      const { error: err } = await supabase
        .from('support_tickets')
        .insert([{
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          status: 'open',
          tenant_id: memberships[0].tenant_id,
          created_by: user?.id,
        }] as any);

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
      const { error: err } = await supabase
        .from('support_tickets')
        .update({ status: newStatus } as any)
        .eq('id', ticketId);

      if (err) throw err;
      await fetchTickets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ticket');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-red-100 text-red-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const stats = {
    open: tickets.filter((t) => t.status === 'open').length,
    pending: tickets.filter((t) => t.status === 'pending').length,
    resolved: tickets.filter((t) => t.status === 'resolved').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Support Tickets</h1>
          <p className="text-gray-600 dark:text-gray-400">Fleet owner support requests</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4 mr-2" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ticket title"
                  required
                />
              </div>
              <div>
                <Label>Description</Label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ticket details"
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-800 h-24"
                />
              </div>
              <div>
                <Label>Priority</Label>
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  className="w-full px-3 py-2 border rounded-md dark:bg-gray-800"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting} className="bg-red-600">
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      {success && <Alert className="bg-green-50 text-green-800 border-green-200"><AlertDescription>{success}</AlertDescription></Alert>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-lg">Open</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-red-600">{stats.open}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Pending</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-yellow-600">{stats.pending}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">Resolved</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-green-600">{stats.resolved}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tickets</CardTitle>
          <CardDescription>{tickets.length} total</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Fleet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-10">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tickets.map((ticket) => (
                    <TableRow key={ticket.id}>
                      <TableCell className="font-medium">{ticket.title}</TableCell>
                      <TableCell>{ticket.tenants?.name}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(ticket.status)}>
                          {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(ticket.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {ticket.status !== 'resolved' && (
                              <DropdownMenuItem onClick={() => updateStatus(ticket.id, 'resolved')} className="cursor-pointer">
                                Mark Resolved
                              </DropdownMenuItem>
                            )}
                            {ticket.status !== 'pending' && (
                              <DropdownMenuItem onClick={() => updateStatus(ticket.id, 'pending')} className="cursor-pointer">
                                Mark Pending
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
