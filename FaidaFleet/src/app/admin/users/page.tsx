'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Users</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage system admin accounts and permissions</p>
      </div>

      <Alert>
        <AlertDescription>
          Admin user management coming soon. Contact support to add new admin accounts.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Current Admin Users</CardTitle>
          <CardDescription>System administrators</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500">Feature in development</p>
        </CardContent>
      </Card>
    </div>
  );
}
