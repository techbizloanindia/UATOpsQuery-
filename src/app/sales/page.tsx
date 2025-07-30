'use client';

import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import SalesDashboard from '@/components/sales/SalesDashboard';

export default function SalesPage() {
  return (
    <ProtectedRoute allowedRoles={['sales']}>
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-0 sm:p-8">
        <SalesDashboard />
      </div>
    </ProtectedRoute>
  );
} 