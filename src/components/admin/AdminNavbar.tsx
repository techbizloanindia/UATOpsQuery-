'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

const AdminNavbar = () => {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="relative h-10 w-32 sm:h-12 sm:w-40">
                <Image
                  src="/logo.png"
                  alt="Bizloan India - Admin Dashboard"
                  fill
                  sizes="(max-width: 640px) 128px, 160px"
                  style={{ 
                    objectFit: 'contain',
                    objectPosition: 'left'
                  }}
                  priority
                />
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-600 hidden sm:block">
              {user?.name || user?.employeeId}
            </span>
            <button 
              className="text-gray-500 hover:text-cyan-600 focus:outline-none"
              onClick={handleLogout}
              aria-label="Logout"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="sr-only">Logout</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default AdminNavbar; 