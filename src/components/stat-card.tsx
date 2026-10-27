import React, { type ComponentType } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { IconProps } from '@/components/icons';

interface StatCardProps {
  title: string;
  value: string;
  description: string;
  Icon: ComponentType<IconProps>;
  /** Show placeholder bars instead of a misleading 0 / empty count. */
  loading?: boolean;
}

export function StatCard({ title, value, description, Icon, loading = false }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <div role="status" aria-label={`Loading ${title}`}>
            <span className="sr-only">{`Loading ${title}…`}</span>
            <Skeleton className="h-8 w-24" />
            <Skeleton className="mt-2 h-3 w-28" />
          </div>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
