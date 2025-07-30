'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  FaCheckCircle, 
  FaExclamationTriangle, 
  FaInfoCircle, 
  FaClock, 
  FaTimes,
  FaArrowRight,
  FaUpload,
  FaComments,
  FaFileAlt,
  FaUndo,
  FaExternalLinkAlt,
  FaUser,
  FaBuilding
} from 'react-icons/fa';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import EmptyState from './EmptyState';
import RevertMessageBox from '../shared/RevertMessageBox';
import { StatusBadge, StatusText } from '../shared/StatusUtils';

interface Query {
  id: number;
  appNo: string;
  customerName: string;
  queries: Array<{
    id: string;
    text: string;
    status: 'pending' | 'approved' | 'deferred' | 'otc' | 'resolved';
    timestamp?: string;
    sender?: string;
    senderRole?: string;
  }>;
  sendTo: string[];
  submittedBy: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'deferred' | 'otc' | 'resolved';
  branch: string;
  branchCode: string;
  lastUpdated: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionReason?: string;
  amount?: string;
  appliedOn?: string;
  title?: string;
  queryIndex?: number;
  queryText?: string;
  queryId?: string;
  assignedTo?: string; // Added assignedTo field for OTC/Deferral actions
}

interface HistoryMessage {
  id: string;
  queryId: number;
  message: string;
  sender: string;
  senderRole: string;
  timestamp: string;
  team?: string;
  actionType?: string;
  isSystemMessage?: boolean;
}

// Fetch only resolved queries (approved, deferred, otc) with real-time data
const fetchAllQueries = async (): Promise<Query[]> => {
  // Add a cache-busting parameter to ensure we get fresh data
  const timestamp = new Date().getTime();
  const response = await fetch(`/api/queries?status=resolved&_=${timestamp}`);
  const result = await response.json();
  
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to fetch queries');
  }
  
  // Return only resolved queries
  return result.data || [];
};

// Fetch real-time history for a query
const fetchQueryHistory = async (queryId: number): Promise<HistoryMessage[]> => {
  try {
    const response = await fetch(`/api/query-actions?queryId=${queryId}&type=messages`);
    if (!response.ok) {
      throw new Error('Failed to fetch query history');
    }
    const result = await response.json();
    
    // Sort messages by timestamp (oldest first)
    const messages = result.data || [];
    return messages.sort((a: HistoryMessage, b: HistoryMessage) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  } catch (error) {
    console.error('Error fetching query history:', error);
    return [];
  }
};

export default function QueryResolved() {
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'name'>('recent');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch all queries (pending and resolved)
  const { data: queries, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['allQueries'],
    queryFn: fetchAllQueries,
    refetchOnWindowFocus: true,
    staleTime: 5 * 1000, // 5 seconds
    refetchInterval: 10000, // Auto-refresh every 10 seconds for faster updates
  });

  // Fetch query history when modal is open
  const { data: queryHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['queryHistory', selectedQuery?.queryId],
    queryFn: () => fetchQueryHistory(selectedQuery!.id),
    enabled: showModal && !!selectedQuery,
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
  });
  
  // Extract individual resolved queries for display (only approved, deferred, otc)
  const individualQueries = React.useMemo(() => {
    if (!queries || !Array.isArray(queries)) return [];
    
    const individual: Array<Query & { queryIndex: number; queryText: string; queryId: string; assignedTo?: string }> = [];
    
    queries.forEach(queryGroup => {
      if (queryGroup && Array.isArray(queryGroup.queries)) {
        queryGroup.queries.forEach((query, index) => {
          // Only include queries that are actually resolved (approved, deferred, otc)
          const queryStatus = query.status || queryGroup.status;
          if (['approved', 'deferred', 'otc', 'resolved'].includes(queryStatus)) {
            // Ensure we capture the assignedTo field if it exists
            const assignedTo = (query as any).assignedTo || (queryGroup as any).assignedTo;
            
            individual.push({
              ...queryGroup,
              queryIndex: index + 1,
              queryText: query.text,
              queryId: query.id,
              id: parseInt(query.id.split('-')[0]) + index, // Unique ID for each query
              title: `Query ${index + 1} - ${queryGroup.appNo}`,
              status: queryStatus,
              assignedTo: assignedTo // Explicitly include assignedTo field
            });
          }
        });
      }
    });
    
    return individual;
  }, [queries]);

  // Filter and sort individual queries
  const filteredAndSortedQueries = React.useMemo(() => {
    if (!individualQueries) return [];
    
    const filtered = individualQueries.filter(query => 
      query.appNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      query.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      query.queryText.toLowerCase().includes(searchTerm.toLowerCase())
    );

    switch (sortBy) {
      case 'oldest':
        return filtered.sort((a, b) => 
          new Date(a.resolvedAt || a.lastUpdated).getTime() - new Date(b.resolvedAt || b.lastUpdated).getTime()
        );
      case 'name':
        return filtered.sort((a, b) => 
          a.customerName.localeCompare(b.customerName)
        );
      case 'recent':
      default:
        return filtered.sort((a, b) => 
          new Date(b.resolvedAt || b.lastUpdated).getTime() - new Date(a.resolvedAt || a.lastUpdated).getTime()
        );
    }
  }, [individualQueries, searchTerm, sortBy]);
  
  const openModal = (application: any) => {
    const query: Query = {
      id: application.queries[0]?.queryId || Date.now(),
      appNo: application.appNo,
      customerName: application.customerName,
      queries: application.queries,
      sendTo: [],
      submittedBy: application.queries[0]?.submittedBy || 'Operations Team',
      submittedAt: application.queries[0]?.submittedAt || new Date().toISOString(),
      status: 'resolved' as const,
      branch: application.branch,
      branchCode: application.branchCode,
      lastUpdated: application.latestResolvedAt,
      resolvedAt: application.latestResolvedAt,
      resolvedBy: application.queries[0]?.resolvedBy || 'Operations Team',
      resolutionReason: application.queries[0]?.resolutionReason || 'Resolved successfully',
      amount: application.amount,
      appliedOn: application.appliedOn
    };
    
    setSelectedQuery(query);
    setShowModal(true);
    document.body.style.overflow = 'hidden';
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedQuery(null);
    document.body.style.overflow = 'auto';
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
        year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMessageIcon = (message: HistoryMessage) => {
    if (message.actionType === 'revert') {
      return <FaUndo className="h-5 w-5" />;
    }
    switch (message.senderRole?.toLowerCase()) {
      case 'sales': return <FaComments className="h-5 w-5" />;
      case 'credit': return <FaCheckCircle className="h-5 w-5" />;
      case 'operations': return <FaFileAlt className="h-5 w-5" />;
      case 'system': return <FaInfoCircle className="h-5 w-5" />;
      default: return <FaComments className="h-5 w-5" />;
    }
  };

  const getMessageColor = (message: HistoryMessage) => {
    if (message.actionType === 'revert') {
      return 'bg-gradient-to-r from-orange-50 to-red-50 border-l-4 border-l-orange-500 shadow-lg';
    }
    switch (message.senderRole?.toLowerCase()) {
      case 'sales': return 'bg-gradient-to-r from-blue-50 to-cyan-50 border-l-4 border-l-blue-500 shadow-md';
      case 'credit': return 'bg-gradient-to-r from-green-50 to-emerald-50 border-l-4 border-l-green-500 shadow-md';
      case 'operations': return 'bg-gradient-to-r from-purple-50 to-indigo-50 border-l-4 border-l-purple-500 shadow-md';
      case 'system': return 'bg-gradient-to-r from-gray-50 to-slate-50 border-l-4 border-l-gray-500 shadow-md';
      default: return 'bg-gradient-to-r from-gray-50 to-slate-50 border-l-4 border-l-gray-500 shadow-md';
    }
  };

  const getMessageTitle = (message: HistoryMessage) => {
    if (message.actionType === 'revert') {
      return `🔄 Query Reverted by ${message.team || message.sender}`;
    }
    switch (message.senderRole?.toLowerCase()) {
      case 'sales': return `💼 Sales Team Response`;
      case 'credit': return `💳 Credit Team Response`;
      case 'operations': return `⚙️ Operations Team Update`;
      case 'system': return `🤖 System Message`;
      default: return `💬 ${message.sender}`;
    }
  };

  if (isLoading) {
    return <LoadingState message="Loading resolved queries..." />;
  }

  if (isError) {
    return <ErrorState message={error?.message || 'Failed to load resolved queries'} onRetry={refetch} />;
  }
    
  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container mx-auto p-4 md:p-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-black font-['Inter',sans-serif]">Query Resolved</h1>
          <div className="flex items-center mt-2 sm:mt-0 gap-4">
            <span className="text-sm font-medium text-black">
              {filteredAndSortedQueries.length} Total Queries
            </span>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'recent' | 'oldest' | 'name')}
                className="appearance-none bg-white border border-slate-300 rounded-md py-2 pl-3 pr-8 text-sm font-medium text-black hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="recent">Sort By: Recent</option>
                <option value="oldest">Sort By: Oldest</option>
                <option value="name">Sort By: Applicant Name</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by application number or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-bold bg-white"
            style={{ color: '#000000', backgroundColor: '#ffffff', fontWeight: '700' }}
          />
        </div>

        {/* All Queries Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4">
            <h2 className="text-xl font-semibold">Resolved Individual Queries (Approved, Deferred, OTC)</h2>
          </div>
          
          {filteredAndSortedQueries.length === 0 ? (
            <div className="p-8">
              <EmptyState message="No queries found" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="px-4 py-3 text-left font-semibold text-black">Query Details</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Customer Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Query Text</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Resolved Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Resolver Name (OTC/Deferral)</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedQueries.map((query: any, index: number) => (
                    <tr key={`${query.appNo}-${query.queryIndex}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-shrink-0 bg-green-100 text-green-800 rounded-full h-8 w-8 flex items-center justify-center">
                            <FaCheckCircle className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="font-mono font-semibold text-black">{query.appNo}</span>
                            <div className="text-xs text-gray-600">Query #{query.queryIndex}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-medium text-black">{query.customerName}</div>
                        <div className="text-sm text-gray-600">
                          {query.branch}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="max-w-xs">
                          <p className="text-sm text-black line-clamp-3 font-medium">
                            {query.queryText || 'No query text available'}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          query.status === 'approved' ? 'bg-green-100 text-green-800' :
                          query.status === 'deferred' ? 'bg-yellow-100 text-yellow-800' :
                          query.status === 'otc' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {query.status?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="text-sm">
                          <div className="font-medium text-black">
                            {formatDateTime(query.resolvedAt || query.lastUpdated)}
                          </div>
                          <div className="text-gray-600">
                            By: {query.resolvedBy || 'Operations Team'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {/* Resolver Name for OTC/Deferral */}
                        {(query.status === 'otc' || query.status === 'deferred') ? (
                          <span className="font-semibold text-blue-700">
                            {(query as any).assignedTo || query.resolvedBy || 'N/A'}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <button
                          onClick={() => {
                            setSelectedQuery(query);
                            setShowModal(true);
                            document.body.style.overflow = 'hidden';
                          }}
                          className="text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors duration-200 flex items-center gap-1 bg-blue-50 px-3 py-2 rounded-lg hover:bg-blue-100"
                        >
                          <FaComments className="h-4 w-4" />
                          View Message
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modern Messages Modal */}
      {showModal && selectedQuery && (
        <div
          className="fixed inset-0 bg-gradient-to-br from-slate-900/80 via-slate-800/80 to-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col transform transition-all duration-500 animate-in slide-in-from-bottom-10">
            {/* Modern Modal Header */}
            <div className="relative bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 text-white rounded-t-2xl overflow-hidden">
              <div className="absolute inset-0 bg-black/10"></div>
              <div className="relative flex justify-between items-center p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                    <FaComments className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">Query Message</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="bg-white/20 px-3 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                        {selectedQuery.appNo}
                      </span>
                      <span className="text-white/80">•</span>
                      <span className="text-white/90 text-sm">Query #{selectedQuery.queryIndex}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="bg-white/20 hover:bg-white/30 p-2 rounded-xl transition-all duration-200 backdrop-blur-sm"
                >
                  <FaTimes className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modern Modal Body */}
            <div className="p-8 overflow-y-auto flex-grow bg-gradient-to-br from-slate-50 to-blue-50/30">
              {/* Modern Application Summary */}
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200/60 mb-8 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-2 rounded-xl">
                    <FaFileAlt className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Application Summary</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                      <div className="flex items-center gap-3">
                        <div className="bg-blue-500 p-2 rounded-lg">
                          <FaUser className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-600">Applicant</p>
                          <p className="text-lg font-bold text-slate-800">{selectedQuery.customerName}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-100">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-500 p-2 rounded-lg">
                          <FaBuilding className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-600">Branch</p>
                          <p className="text-lg font-bold text-slate-800">{selectedQuery.branch}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-xl border border-purple-100">
                      <div className="flex items-center gap-3">
                        <div className="bg-purple-500 p-2 rounded-lg">
                          <span className="text-white font-bold text-sm">₹</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-600">Amount</p>
                          <p className="text-lg font-bold text-slate-800">{selectedQuery.amount || '₹5,00,000'}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-4 rounded-xl border border-orange-100">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          selectedQuery.status === 'approved' ? 'bg-green-500' :
                          selectedQuery.status === 'deferred' ? 'bg-yellow-500' :
                          selectedQuery.status === 'otc' ? 'bg-blue-500' : 'bg-gray-500'
                        }`}>
                          <FaCheckCircle className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-600">Status</p>
                          <p className="text-lg font-bold text-slate-800">{selectedQuery.status?.toUpperCase()}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modern Query Details */}
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200/60 mb-8 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="bg-gradient-to-r from-emerald-500 to-green-500 p-2 rounded-xl">
                    <FaComments className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Query Details</h3>
                </div>
                
                <div className="bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 rounded-2xl p-6 border border-emerald-200/60">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-xl ${
                        selectedQuery.status === 'approved' ? 'bg-green-500' :
                        selectedQuery.status === 'deferred' ? 'bg-yellow-500' :
                        selectedQuery.status === 'otc' ? 'bg-blue-500' : 'bg-gray-500'
                      }`}>
                        <FaCheckCircle className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="text-lg font-bold text-slate-800">Query #{selectedQuery.queryIndex}</h4>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${
                          selectedQuery.status === 'approved' ? 'bg-green-100 text-green-800' :
                          selectedQuery.status === 'deferred' ? 'bg-yellow-100 text-yellow-800' :
                          selectedQuery.status === 'otc' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {selectedQuery.status?.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-600">Resolved Date</p>
                      <p className="text-sm font-bold text-slate-800">
                        {formatDateTime(selectedQuery.resolvedAt || selectedQuery.lastUpdated)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl p-5 border border-slate-200/60 mb-4 shadow-sm">
                    <p className="text-slate-600 text-sm font-medium mb-2">Query Message:</p>
                    <p className="text-slate-800 text-base leading-relaxed font-medium">
                      "{selectedQuery.queryText}"
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white/70 rounded-xl p-4 backdrop-blur-sm">
                      <p className="text-sm font-medium text-slate-600 mb-1">Resolved by</p>
                      <p className="text-slate-800 font-bold">{selectedQuery.resolvedBy || 'Operations Team'}</p>
                    </div>
                    <div className="bg-white/70 rounded-xl p-4 backdrop-blur-sm">
                      <p className="text-sm font-medium text-slate-600 mb-1">Resolution Reason</p>
                      <p className="text-slate-800 font-bold">{selectedQuery.resolutionReason || 'Approved'}</p>
                    </div>
                  </div>
                </div>
              </div>
        
              {/* Modern Communication Messages */}
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200/60 hover:shadow-xl transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-r from-violet-500 to-purple-500 p-2 rounded-xl">
                      <FaComments className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">Communication History</h3>
                  </div>
                  {historyLoading && (
                    <div className="flex items-center gap-2 text-violet-600">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-violet-600 border-t-transparent"></div>
                      <span className="text-sm font-medium">Loading...</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-slate-100">
                  {queryHistory && queryHistory.length > 0 ? (
                    queryHistory.map((message, index) => (
                      <div key={message.id} className="relative">
                        {/* Timeline connector */}
                        {index < queryHistory.length - 1 && (
                          <div className="absolute left-6 top-16 w-0.5 h-8 bg-gradient-to-b from-slate-300 to-transparent"></div>
                        )}
                        
                        <div className={`relative p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all duration-300 ${
                          message.senderRole?.toLowerCase() === 'sales' ? 'bg-gradient-to-r from-blue-50 to-cyan-50 border-blue-200' :
                          message.senderRole?.toLowerCase() === 'credit' ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' :
                          message.senderRole?.toLowerCase() === 'operations' ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200' :
                          'bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200'
                        }`}>
                          <div className="flex items-start gap-4">
                            <div className={`p-3 rounded-xl shadow-sm ${
                              message.senderRole?.toLowerCase() === 'sales' ? 'bg-blue-500' :
                              message.senderRole?.toLowerCase() === 'credit' ? 'bg-green-500' :
                              message.senderRole?.toLowerCase() === 'operations' ? 'bg-purple-500' :
                              'bg-slate-500'
                            }`}>
                              {getMessageIcon(message)}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-3">
                                <div>
                                  <h4 className="font-bold text-slate-800 text-lg">
                                    {getMessageTitle(message).replace(/[🤖💼💳⚙️💬]/g, '').trim()}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm font-medium text-slate-600">From: {message.sender}</span>
                                    {message.team && (
                                      <>
                                        <span className="text-slate-400">•</span>
                                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                                          message.senderRole?.toLowerCase() === 'sales' ? 'bg-blue-100 text-blue-700' :
                                          message.senderRole?.toLowerCase() === 'credit' ? 'bg-green-100 text-green-700' :
                                          message.senderRole?.toLowerCase() === 'operations' ? 'bg-purple-100 text-purple-700' :
                                          'bg-slate-100 text-slate-700'
                                        }`}>
                                          {message.team}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-medium text-slate-500 bg-white px-3 py-1 rounded-full shadow-sm">
                                    {formatDateTime(message.timestamp)}
                                  </span>
                                </div>
                              </div>
                              
                              {message.actionType === 'revert' ? (
                                <RevertMessageBox 
                                  message={message} 
                                  teamContext="operations" 
                                />
                              ) : (
                                <div className="bg-white rounded-xl p-4 border border-slate-200/60 shadow-sm">
                                  <p className="text-slate-700 text-base leading-relaxed whitespace-pre-wrap break-words">
                                    {message.message}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl border border-slate-200">
                      <div className="bg-slate-100 p-4 rounded-2xl w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                        <FaComments className="h-8 w-8 text-slate-400" />
                      </div>
                      <h4 className="text-lg font-bold text-slate-800 mb-2">No Communication History</h4>
                      <p className="text-slate-600">Messages and communications between teams will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modern Modal Footer */}
            <div className="p-6 border-t border-slate-200/60 bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-b-2xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <div className="animate-pulse w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>
                  <p className="text-sm text-slate-600 font-medium">
                    Auto-refreshing every 5 seconds for real-time updates
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="bg-gradient-to-r from-slate-600 to-slate-700 hover:from-slate-700 hover:to-slate-800 text-white px-6 py-3 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <FaTimes className="h-4 w-4" />
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
