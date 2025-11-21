'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/client';
import { Search, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Collection = {
  id: string;
  amount: number;
  date: string;
  payment_method: string;
  reconciled: boolean;
  drivers: { full_name: string };
  tenants: { name: string };
};

export default function CollectionsPage() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [filteredCollections, setFilteredCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [paymentMethodStats, setPaymentMethodStats] = useState<Record<string, number>>({});
  const supabase = createClient();

  useEffect(() => {
    fetchCollections();
  }, []);

  useEffect(() => {
    filterCollections();
  }, [searchQuery, startDate, endDate, collections]);

  const fetchCollections = async () => {
    try {
      setLoading(true);
      const { data } = await supabase
        .from('collections')
        .select('*, drivers(full_name), tenants(name)')
        .order('date', { ascending: false })
        .limit(1000);

      setCollections(data || []);

      // Calculate payment method stats
      const stats: Record<string, number> = {};
      data?.forEach((c: any) => {
        stats[c.payment_method] = (stats[c.payment_method] || 0) + c.amount;
      });
      setPaymentMethodStats(stats);
    } catch (error) {
      console.error('Error fetching collections:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterCollections = () => {
    let filtered = collections;

    if (searchQuery) {
      filtered = filtered.filter(
        (c) =>
          c.drivers?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.tenants?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (startDate) {
      filtered = filtered.filter((c) => new Date(c.date) >= new Date(startDate));
    }

    if (endDate) {
      filtered = filtered.filter((c) => new Date(c.date) <= new Date(endDate));
    }

    setFilteredCollections(filtered);
    setTotalAmount(filtered.reduce((sum, c) => sum + c.amount, 0));
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'mpesa':
        return 'bg-green-100 text-green-800';
      case 'cash':
        return 'bg-blue-100 text-blue-800';
      case 'pochi':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const reconcileStats = {
    reconciled: filteredCollections.filter((c) => c.reconciled).length,
    pending: filteredCollections.filter((c) => !c.reconciled).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Collections Monitor</h1>
          <p className="text-gray-600 dark:text-gray-400">System-wide collection tracking and reconciliation</p>
        </div>
        <Button className="bg-red-600 hover:bg-red-700">
          <Download className="h-4 w-4 mr-2" />
          Export Report
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Collections</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">KES {totalAmount.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{filteredCollections.length} records</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Reconciled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{reconcileStats.reconciled}</p>
            <p className="text-sm text-gray-500">{filteredCollections.length > 0 ? Math.round((reconcileStats.reconciled / filteredCollections.length) * 100) : 0}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-yellow-600">{reconcileStats.pending}</p>
            <p className="text-sm text-gray-500">Awaiting reconciliation</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Avg Collection</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">KES {filteredCollections.length > 0 ? Math.round(totalAmount / filteredCollections.length) : 0}</p>
            <p className="text-sm text-gray-500">Per transaction</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Search by driver or fleet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Method Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Method Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(paymentMethodStats).map(([method, amount]) => (
              <div key={method} className={`p-4 rounded-lg border ${getPaymentMethodColor(method)}`}>
                <p className="text-sm font-medium capitalize">{method}</p>
                <p className="text-2xl font-bold mt-2">KES {(amount as number).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Collections Table */}
      <Card>
        <CardHeader>
          <CardTitle>Collection Records</CardTitle>
          <CardDescription>{filteredCollections.length} records found</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center h-32">Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Driver</TableHead>
                    <TableHead>Fleet</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCollections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                        No collections found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCollections.map((collection) => (
                      <TableRow key={collection.id}>
                        <TableCell className="font-medium">{collection.drivers?.full_name}</TableCell>
                        <TableCell>{collection.tenants?.name}</TableCell>
                        <TableCell className="font-semibold">KES {collection.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={getPaymentMethodColor(collection.payment_method)}>
                            {collection.payment_method.charAt(0).toUpperCase() + collection.payment_method.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{new Date(collection.date).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <Badge
                            className={
                              collection.reconciled
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }
                          >
                            {collection.reconciled ? 'Reconciled' : 'Pending'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
