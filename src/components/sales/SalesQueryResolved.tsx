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
  FaExternalLinkAlt
} from 'react-icons/fa';
import LoadingState from '../operations/LoadingState';
import ErrorState from '../operations/ErrorState';
import EmptyState from '../operations/EmptyState';
import RevertMessageBox from '../shared/RevertMessageBox';

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
  sendToSales?: boolean;
  markedForTeam?: string;
  title?: string;
  queryIndex?: number;
  queryText?: string;
  queryId?: string;
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

// Fetch resolved queries for Sales team
const fetchSalesResolvedQueries = async (): Promise<Query[]> => {
  const response = await fetch('/api/queries?team=sales&status=resolved');
  const result = await response.json();
  
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to fetch Sales resolved queries');
  }
  
  return result.data.filter((query: Query) => 
    (query.sendToSales || 
     query.sendTo.includes('Sales') || 
     query.markedForTeam === 'sales' || 
     query.markedForTeam === 'both') &&
    ['approved', 'deferred', 'deferral', 'otc', 'resolved'].includes(query.status)
  );
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

export default function SalesQueryResolved() {
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'name'>('recent');
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch resolved queries
  const { data: queries, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['salesResolvedQueries'],
    queryFn: fetchSalesResolvedQueries,
    refetchOnWindowFocus: true,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 20000, // Auto-refresh every 20 seconds
  });

  // Fetch query history when modal is open
  const { data: queryHistory, isLoading: historyLoading } = useQuery({
    queryKey: ['salesQueryHistory', selectedQuery?.id],
    queryFn: () => fetchQueryHistory(selectedQuery!.id),
    enabled: showModal && !!selectedQuery,
    refetchOnWindowFocus: true,
    refetchInterval: 5000, // Refresh every 5 seconds for real-time updates
  });

  // Extract individual resolved queries for display
  const individualQueries = React.useMemo(() => {
    if (!queries) return [];
    
    const individual: Array<Query & { queryIndex: number; queryText: string; queryId: string }> = [];
    
    queries.forEach(queryGroup => {
      queryGroup.queries.forEach((query, index) => {
        individual.push({
          ...queryGroup,
          queryIndex: index + 1,
          queryText: query.text,
          queryId: query.id,
          id: parseInt(query.id.split('-')[0]) + index, // Unique ID for each query
          title: `Query ${index + 1} - ${queryGroup.appNo}`,
          status: query.status || queryGroup.status
        });
      });
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
      submittedBy: application.queries[0]?.submittedBy || 'Sales Team',
      submittedAt: application.queries[0]?.submittedAt || new Date().toISOString(),
      status: 'resolved' as const,
      branch: application.branch,
      branchCode: application.branchCode,
      lastUpdated: application.latestResolvedAt,
      resolvedAt: application.latestResolvedAt,
      resolvedBy: application.queries[0]?.resolvedBy || 'Sales Team',
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-green-200 text-green-900 border-green-400';
      case 'deferred': return 'bg-orange-200 text-orange-900 border-orange-400';
      case 'otc': return 'bg-blue-200 text-blue-900 border-blue-400';
      case 'resolved': return 'bg-gray-200 text-gray-900 border-gray-400';
      default: return 'bg-gray-200 text-gray-900 border-gray-400';
    }
  };

  const getMessageIcon = (message: HistoryMessage) => {
    if (message.actionType === 'revert') {
      return <FaUndo className="h-4 w-4" />;
    }
    switch (message.senderRole?.toLowerCase()) {
      case 'sales': return <FaComments className="h-4 w-4" />;
      case 'credit': return <FaCheckCircle className="h-4 w-4" />;
      case 'operations': return <FaFileAlt className="h-4 w-4" />;
      case 'system': return <FaInfoCircle className="h-4 w-4" />;
      default: return <FaComments className="h-4 w-4" />;
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
      return `🔄 Action Reverted by ${message.sender}`;
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
    return <LoadingState message="Loading Sales resolved queries..." />;
  }

  if (isError) {
    return <ErrorState message={error?.message || 'Failed to load Sales resolved queries'} onRetry={refetch} />;
  }

  return (
    <div className="bg-slate-50 min-h-screen">
      <div className="container mx-auto p-4 md:p-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-black font-['Inter',sans-serif]">
            💼 Sales - Query Resolved
          </h1>
          <div className="flex items-center mt-2 sm:mt-0 gap-4">
            <span className="text-sm font-medium text-black">
              {filteredAndSortedQueries.length} Resolved Queries
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

        {/* Resolved Queries Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white p-4">
            <h2 className="text-xl font-semibold">💼 Sales - Individual Resolved Queries</h2>
          </div>
          
          {filteredAndSortedQueries.length === 0 ? (
            <div className="p-8">
              <EmptyState message="No resolved queries found for Sales team" />
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
                    <th className="px-4 py-3 text-left font-semibold text-black">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedQueries.map((query: any, index: number) => (
                    <tr key={`${query.appNo}-${query.queryIndex}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-shrink-0 bg-blue-100 text-blue-800 rounded-full h-8 w-8 flex items-center justify-center">
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
                            By: {query.resolvedBy || 'Sales Team'}
                          </div>
                        </div>
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
                          View Messages
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

      {/* History Modal */}
      {showModal && selectedQuery && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && closeModal()}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col transform transition-transform duration-300">
            {/* Modal Header */}
            <div className="flex justify-between items-center p-6 border-b border-slate-200 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-t-xl">
              <h2 className="text-xl font-bold">
                💬 Messages for Application: <span className="font-mono bg-white text-black px-2 py-1 rounded">{selectedQuery.appNo}</span>
              </h2>
              <button
                onClick={closeModal}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <FaTimes className="h-6 w-6" />
              </button>
            </div>

            {/* Modal Body - Messages Only */}
            <div className="p-6 overflow-y-auto flex-grow">
              {/* Application Summary */}
              <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg p-5 border border-blue-200 mb-6">
                <h3 className="font-semibold text-black text-lg mb-4 flex items-center gap-2">
                  📊 Application Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex flex-col space-y-2">
                    <div>
                      <span className="font-medium text-black">👤 Applicant:</span> 
                      <span className="text-black ml-2 font-semibold">{selectedQuery.customerName}</span>
                    </div>
                    <div>
                      <span className="font-medium text-black">🏦 Branch:</span> 
                      <span className="text-black ml-2 font-semibold">{selectedQuery.branch}</span>
                    </div>
                  </div>
                  <div className="flex flex-col space-y-2">
                    <div>
                      <span className="font-medium text-black">💰 Amount:</span> 
                      <span className="text-black ml-2 font-semibold">{selectedQuery.amount || '₹5,00,000'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-black">📊 Total Queries:</span> 
                      <span className="text-black ml-2 font-semibold">{selectedQuery.queries.length} Resolved</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* All Resolved Queries */}
              <div className="space-y-4 mb-6">
                <h3 className="font-semibold text-black text-lg mb-4 flex items-center gap-2">
                  ✅ All Resolved Queries
                </h3>
                <div className="space-y-3">
                  {selectedQuery.queries.map((query: any, index: number) => (
                    <div key={query.id} className="bg-white p-4 rounded-lg border border-l-4 border-l-blue-500 shadow-sm">
                      <div className="flex items-start justify-between mb-2">
                        <p className="font-semibold text-blue-800 flex items-center gap-2">
                          ✅ Query #{index + 1} - {query.status?.toUpperCase()}
                        </p>
                        <span className="text-xs text-black bg-blue-100 px-2 py-1 rounded">
                          {formatDateTime(query.resolvedAt || selectedQuery.resolvedAt)}
                        </span>
                      </div>
                      <p className="text-sm text-black mb-3 font-medium bg-blue-50 p-3 rounded">
                        "{query.text}"
                      </p>
                      <div className="text-xs text-black flex items-center gap-4">
                        <span>
                          <span className="font-medium">Resolved by:</span> 
                          <span className="ml-1">{query.resolvedBy || selectedQuery.resolvedBy || 'Sales Team'}</span>
                        </span>
                        <span>
                          <span className="font-medium">Reason:</span> 
                          <span className="ml-1">{query.resolutionReason || selectedQuery.resolutionReason || 'Approved'}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
        
              {/* Messages/Communication History */}
              <div>
                <h3 className="font-semibold text-black text-lg mb-4 flex items-center gap-2">
                  💬 Communication Messages
                  {historyLoading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>}
                </h3>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {queryHistory && queryHistory.length > 0 ? (
                    queryHistory.map((message) => (
                      <div key={message.id} className={`p-5 rounded-lg ${getMessageColor(message)}`}>
                        <div className="flex items-center justify-between mb-3">
                          <p className="font-bold text-base flex items-center gap-2 text-black">
                            {getMessageIcon(message)}
                            {getMessageTitle(message)}
                          </p>
                          <span className="text-xs text-black font-medium bg-white px-2 py-1 rounded">
                            {formatDateTime(message.timestamp)}
                          </span>
                        </div>
                        
                        {message.actionType === 'revert' ? (
                          <RevertMessageBox 
                            message={message} 
                            teamContext="sales" 
                          />
                        ) : (
                          <>
                            <div className="bg-white bg-opacity-70 p-4 rounded-lg border border-opacity-30">
                              <p className="text-sm text-black font-medium leading-relaxed whitespace-pre-wrap break-words">
                                {message.message}
                              </p>
                            </div>
                            <div className="mt-3 flex items-center gap-4 text-xs text-black">
                              <div className="flex items-center gap-1">
                                <span className="font-medium">From:</span> 
                                <span className="bg-white px-2 py-1 rounded font-semibold">{message.sender}</span>
                              </div>
                              {message.team && (
                                <div className="flex items-center gap-1">
                                  <span className="font-medium">Team:</span> 
                                  <span className="bg-white px-2 py-1 rounded font-semibold">{message.team}</span>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-black">
                      <FaComments className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                      <p className="text-lg font-medium text-black">No communication history available</p>
                      <p className="text-sm text-black">Messages between teams will appear here</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-gray-50 rounded-b-xl">
              <div className="flex justify-between items-center">
                <p className="text-xs text-black">
                  🔄 Auto-refreshing every 5 seconds for real-time updates
                </p>
                <button
                  onClick={closeModal}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
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
