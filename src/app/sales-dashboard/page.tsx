'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SalesDashboardRedirect() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/sales');
  }, [router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-lg">Redirecting to Sales Dashboard...</p>
    </div>
  );
} 