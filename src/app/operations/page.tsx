'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import OperationsDashboard from '@/components/operations/OperationsDashboard';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      staleTime: 0, // Always consider data stale for real-time updates
      retry: 3,
    },
  },
});

export default function OperationsPage() {
  return (
    <ProtectedRoute allowedRoles={['operations']}>
      <QueryClientProvider client={queryClient}>
        <OperationsDashboard />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ProtectedRoute>
  );
} 