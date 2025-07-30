'use client';

import React, { useState, useEffect } from 'react';
import { FaExclamationCircle } from 'react-icons/fa';
import EmptyState from './EmptyState';
import CaseAccordion from './CaseAccordion';

interface Application {
  _id: string;
  appId: string;
  customerName: string;
  branch: string;
  status: string;
  amount?: number;
  sanctionedDate?: string;
  uploadedAt: string;
  priority: 'high' | 'medium' | 'low';
  loanType?: string;
}

interface SanctionedCasesProps {
  onRaiseQuery: (appNo: string) => void;
}

export default function SanctionedCases({ onRaiseQuery }: SanctionedCasesProps) {
  const [sanctionedCases, setSanctionedCases] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchSanctionedCases();
    
    // Set up auto-refresh interval
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(() => {
        fetchSanctionedCases(true); // Silent refresh
      }, 30000); // Refresh every 30 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoRefresh]);

  const fetchSanctionedCases = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await fetch('/api/applications?status=sanctioned');
      const result = await response.json();
      
      if (result.success) {
        setSanctionedCases(result.data);
        setLastUpdated(new Date());
        setError(null);
      } else {
        setError('Failed to fetch sanctioned cases');
        console.error('Failed to fetch sanctioned cases:', result.error);
      }
    } catch (error) {
      setError('Failed to fetch sanctioned cases');
      console.error('Error fetching sanctioned cases:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
  };

  const formatLastUpdated = () => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return lastUpdated.toLocaleTimeString();
    }
  };

  // For mobile view, create card-based layout
  const MobileView = () => (
    <div className="space-y-4 md:hidden">
      {sanctionedCases.map((application) => (
        <div key={application._id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-gray-900">{application.appId}</p>
              <p className="text-sm text-gray-600">{application.customerName}</p>
              <div className="flex items-center mt-1">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  application.priority === 'high' ? 'bg-red-100 text-red-800' :
                  application.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {application.priority.toUpperCase()}
                </span>
                {application.amount && (
                  <span className="ml-2 text-xs text-gray-500">₹{application.amount.toLocaleString()}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => onRaiseQuery(application.appId)}
              className="text-cyan-600 hover:text-cyan-800 text-sm font-medium"
            >
              Raise Query
            </button>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">Branch:</span>
              <span className="ml-1 text-gray-700 font-medium">{application.branch}</span>
            </div>
            <div>
              <span className="text-gray-500">Sanction Date:</span>
              <span className="ml-1 text-gray-700">
                {application.sanctionedDate 
                  ? new Date(application.sanctionedDate).toLocaleDateString()
                  : new Date(application.uploadedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // Loading state
  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="flex items-center space-x-2">
          <svg className="animate-spin h-6 w-6 text-cyan-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-gray-600">Loading sanctioned cases...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <FaExclamationCircle className="h-12 w-12 mx-auto mb-2" />
          <p className="text-lg font-medium">Error Loading Cases</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
        <button
          onClick={() => fetchSanctionedCases()}
          className="text-cyan-600 hover:text-cyan-800 font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (sanctionedCases.length === 0) {
    return (
      <EmptyState 
        title="No sanctioned cases"
        message="There are no sanctioned cases available at this time. Upload applications through the Bulk Upload feature in Control Panel."
        actionLabel="Refresh"
        onAction={fetchSanctionedCases}
      />
    );
  }

  return (
    <>
      {/* Header with stats */}
      <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-green-800">✅ Sanctioned Applications</h3>
            <p className="text-sm text-green-600">{sanctionedCases.length} applications ready for processing</p>
            <p className="text-xs text-gray-500 mt-1">
              Last updated: {formatLastUpdated()}
              {autoRefresh && <span className="ml-2 text-green-600">• Auto-refreshing</span>}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-800">{sanctionedCases.length}</div>
              <div className="text-xs text-green-600">Total Cases</div>
            </div>
            <div className="flex flex-col space-y-2">
              <button
                onClick={toggleAutoRefresh}
                className={`text-xs font-medium px-3 py-1 rounded-lg transition-colors ${
                  autoRefresh 
                    ? 'text-orange-600 bg-orange-100 hover:bg-orange-200' 
                    : 'text-gray-600 bg-gray-100 hover:bg-gray-200'
                }`}
              >
                {autoRefresh ? '⏸️ Pause Auto-refresh' : '▶️ Enable Auto-refresh'}
              </button>
            </div>
          </div>
        </div>
        
        {/* New Upload Notification */}
        {sanctionedCases.length > 0 && (
          <div className="mt-3 bg-white border border-green-300 rounded-lg p-3">
            <div className="flex items-center justify-center text-sm">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span className="text-green-700 font-medium">
                  Real-time updates enabled - New uploads will appear automatically
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Desktop view */}
      <div className="hidden md:block space-y-3">
        {sanctionedCases.map((application) => (
          <CaseAccordion
            key={application._id}
            appNo={application.appId}
            customerName={application.customerName}
            employeeId="Default Branch"
            status="Active"
            statusBadgeColor="bg-green-100 text-green-800"
            branch={application.branch}
            isResolved={false}
            onRaiseQuery={onRaiseQuery}
          />
        ))}
      </div>

      {/* Mobile view */}
      <div className="md:hidden space-y-3">
        {sanctionedCases.map((application) => (
          <CaseAccordion
            key={application._id}
            appNo={application.appId}
            customerName={application.customerName}
            employeeId="Default Branch"
            status="Active"
            statusBadgeColor="bg-green-100 text-green-800"
            branch={application.branch}
            isResolved={false}
            onRaiseQuery={onRaiseQuery}
          />
        ))}
      </div>
    </>
  );
} 