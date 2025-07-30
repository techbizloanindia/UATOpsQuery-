'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FaSignOutAlt } from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';

const SalesNavbar = () => {
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
              <Link href="/" className="flex items-center">
                <div className="relative h-10 w-32 sm:h-12 sm:w-40">
                  <Image
                    src="/logo.png"
                    alt="Bizloan India - Sales Query Management System"
                    fill
                    sizes="(max-width: 640px) 128px, 160px"
                    style={{ 
                      objectFit: 'contain',
                      objectPosition: 'left'
                    }}
                    priority
                  />
                </div>
              </Link>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div>
              <label htmlFor="branch-filter-nav" className="sr-only">Filter by Branch</label>
              <select 
                id="branch-filter-nav" 
                className="block w-full pl-3 pr-8 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm"
                style={{ color: 'black' }}
              >
                <option>All Branches</option>
                <option>Gurugram</option>
                <option>Nangloi</option>
                <option>Faridabad</option>
              </select>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium hidden md:block" style={{ color: 'black' }}>
                {user?.name || user?.employeeId}
              </span>
              <button 
                className="hover:text-cyan-600 focus:outline-none"
                aria-label="Logout"
                style={{ backgroundColor: 'transparent', padding: 0, color: 'black' }}
                onClick={handleLogout}
              >
                <FaSignOutAlt className="text-lg" />
                <span className="sr-only">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default SalesNavbar; 