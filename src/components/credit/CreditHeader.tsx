'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { FaSignOutAlt, FaSync, FaBell } from 'react-icons/fa';

interface CreditHeaderProps {
  onRefresh?: () => void;
  autoRefresh?: boolean;
  onToggleAutoRefresh?: () => void;
  newQueriesCount?: number;
}

const CreditHeader: React.FC<CreditHeaderProps> = ({ 
  onRefresh, 
  autoRefresh = true, 
  onToggleAutoRefresh,
  newQueriesCount = 0 
}) => {
  const { user, logout } = useAuth();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [, setForceUpdate] = useState<number>(0);

  // Format last updated time
  const formatLastUpdated = () => {
    const now = new Date();
    const diff = now.getTime() - lastUpdated.getTime();
    const seconds = Math.floor(diff / 1000);
    
    // When auto-refresh is OFF, show minimum 10 minutes
    if (!autoRefresh) {
      const minutes = Math.max(10, Math.floor(seconds / 60));
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      return `${hours}h ago`;
    }
    
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Update last updated time every second without causing re-renders
  useEffect(() => {
    const interval = setInterval(() => {
      // Use a counter to force re-render without changing lastUpdated
      setForceUpdate(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Update timestamp when refresh is called
  useEffect(() => {
    if (onRefresh) {
      setLastUpdated(new Date());
    }
  }, [onRefresh]);

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
    }
  };

  return (
    <header className="bg-gradient-to-r from-green-700 to-green-600 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white">Credit Dashboard</h1>
          <div className="flex items-center gap-2 text-sm text-green-100 mt-1">
            <span>Welcome, {user?.name || user?.employeeId || 'Credit User'}</span>
            <span>•</span>
            <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
              👤 Multiple
            </span>
            {user?.employeeId && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  🆔 {user.employeeId}
                </span>
              </>
            )}
            {user?.branch && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                  🏢 {user.branch} {user.branchCode && `(${user.branchCode})`}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Real-time controls */}
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-100">Last updated: {formatLastUpdated()}</span>
            
            <button
              onClick={onToggleAutoRefresh}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                autoRefresh 
                  ? 'bg-green-100 text-green-700 border border-green-300' 
                  : 'bg-gray-100 text-gray-700 border border-gray-300'
              }`}
            >
              <FaSync className={autoRefresh ? 'animate-spin' : ''} />
              {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
            </button>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-white hover:text-green-100 hover:bg-green-600 rounded-lg transition-colors"
          >
            <FaSignOutAlt />
            Logout
          </button>
        </div>
      </div>

      {newQueriesCount > 0 && (
        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg inline-flex">
          <FaBell className="animate-pulse" />
          <span className="font-medium">{newQueriesCount} New Quer{newQueriesCount > 1 ? 'ies' : 'y'}</span>
        </div>
      )}
    </header>
  );
};

export default CreditHeader; 