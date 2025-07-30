'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (!user || !user.isAuthenticated) {
        // Redirect to login if not authenticated
        router.push('/login');
      } else {
        // Redirect to appropriate dashboard based on user role
        switch (user.role) {
          case 'sales':
            router.push('/sales');
            break;
          case 'credit':
            router.push('/credit-dashboard');
            break;
          case 'operations':
            router.push('/operations');
            break;
          case 'admin':
            router.push('/admin-dashboard');
            break;
          default:
            router.push('/login');
        }
      }
    }
  }, [user, isLoading, router]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting
  return null;
}
