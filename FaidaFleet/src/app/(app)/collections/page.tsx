
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Loader2, Trash, Edit } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { ReconciliationButton } from './reconciliation-client';
function CollectionsPage() {
  const [collections, setCollections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({
    vehicleId: '',
    driverId: '',
    amount: '',
    paymentMethod: 'cash',
    transactionCode: '',
    date: '',
    shift: 'morning',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchCollections = async () => {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        // Get tenant membership
        const membershipResp = await supabase
          .from('memberships')
          .select('tenant_id')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .single();
        const membership: any = membershipResp.data;
        if (!membership) throw new Error('No tenant found');
        const tenantId: any = membership.tenant_id;
        // Fetch collections

        const { data, error: fetchError } = await supabase
          .from('collections')
          .select('*, vehicles(registration_number)')
          .eq('tenant_id', tenantId)
          .order('date', { ascending: false });
        if (fetchError) throw fetchError;
        setCollections(data || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCollections();
  }, []);

  // ...rest of the CollectionsPage component (form, handlers, return JSX)...

}

export default CollectionsPage;
