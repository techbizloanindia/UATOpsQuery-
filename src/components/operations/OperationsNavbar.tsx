'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { FaSignOutAlt, FaBars, FaTimes } from 'react-icons/fa';
import { useAuth } from '@/contexts/AuthContext';

export default function OperationsNavbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  const toggleMobileMenu = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <nav className="bg-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="relative h-10 w-32 sm:h-12 sm:w-40">
                <Image
                  src="/logo.png"
                  alt="Bizloan India - Operations Query Management System"
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
              className="text-gray-500 hover:text-cyan-600 focus:outline-none flex items-center"
              aria-label="Logout"
              onClick={handleLogout}
            >
              <FaSignOutAlt className="h-4 w-4" />
              <span className="sr-only">Logout</span>
            </button>
            <div className="md:hidden">
              <button
                type="button"
                className="text-gray-500 hover:text-cyan-600 focus:outline-none"
                aria-controls="mobile-menu"
                aria-expanded={mobileMenuOpen}
                onClick={toggleMobileMenu}
              >
                {mobileMenuOpen ? (
                  <FaTimes className="h-6 w-6" aria-hidden="true" />
                ) : (
                  <FaBars className="h-6 w-6" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden" id="mobile-menu">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-gray-200">
            <div className="flex items-center px-3 py-2">
              <span className="text-sm font-medium text-gray-600 mr-2">
                {user?.name || user?.employeeId}
              </span>
              <button 
                className="text-red-500 hover:text-red-700 font-medium flex items-center"
                onClick={handleLogout}
              >
                <FaSignOutAlt className="mr-1" /> Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
} 