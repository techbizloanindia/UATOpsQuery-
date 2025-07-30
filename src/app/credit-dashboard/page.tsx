'use client';

import React from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import CreditDashboard from '@/components/credit/CreditDashboard';

export default function CreditDashboardPage() {
  return (
    <ProtectedRoute allowedRoles={['credit']}>
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-0 sm:p-8">
        <CreditDashboard />
      </div>
    </ProtectedRoute>
  );
} 