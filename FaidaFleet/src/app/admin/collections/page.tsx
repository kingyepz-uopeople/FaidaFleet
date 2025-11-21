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
        .limit(500);

      setCollections(data || []);
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

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Collections</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">KES {totalAmount.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Records</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{filteredCollections.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Avg Per Record</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">KES {filteredCollections.length > 0 ? (totalAmount / filteredCollections.length).toFixed(0) : 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Collections Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Collections</CardTitle>
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
                    <TableHead>Date</TableHead>
                    <TableHead>Driver</TableHead>
                    <TableHead>Fleet</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment Method</TableHead>
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
                        <TableCell>{new Date(collection.date).toLocaleDateString()}</TableCell>
                        <TableCell>{collection.drivers?.full_name}</TableCell>
                        <TableCell>{collection.tenants?.name}</TableCell>
                        <TableCell className="font-semibold">KES {collection.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{collection.payment_method.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={collection.reconciled ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
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
