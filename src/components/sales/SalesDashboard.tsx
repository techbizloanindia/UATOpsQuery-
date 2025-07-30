/**
 * OpsQuery - Real-time Query Management System
 * Copyright (c) 2024 OpsQuery Development Team
 * 
 * Licensed under the MIT License.
 * 
 * @fileoverview Sales Dashboard - Main interface for Sales team with real-time messaging
 * @author OpsQuery Development Team
 * @version 2.0.0
 */

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaArrowLeft, FaSync, FaCheckCircle, FaExclamationCircle, FaClock, FaSignOutAlt } from 'react-icons/fa';
import LoadingState from '../operations/LoadingState';
import ErrorState from '../operations/ErrorState';
import EmptyState from '../operations/EmptyState';
import SalesQueryResolved from './SalesQueryResolved';
import SalesHeader from './SalesHeader';
import { StatusBadge, StatusText } from '../shared/StatusUtils';
import { useAuth } from '@/contexts/AuthContext';
import RevertMessageBox from '../shared/RevertMessageBox';

interface QueryMessage {
  id: string;
  text: string;
  timestamp?: string;
  sender?: string;
  senderRole?: string;
  status?: 'pending' | 'approved' | 'deferred' | 'otc' | 'resolved';
}

interface Query {
  id: number;
  appNo: string;
  customerName: string;
  queries: QueryMessage[];
  sendTo: string[];
  submittedBy: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'deferred' | 'otc' | 'resolved';
  branch: string;
  branchCode: string;
  employeeId?: string;
  markedForTeam?: string;
  sendToSales?: boolean;
  sendToCredit?: boolean;
  allowMessaging?: boolean;
  lastUpdated: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionReason?: string;
}

interface HistoryEntry {
  type: string;
  time: string;
  text: string;
  sender?: string;
  senderRole?: string;
  isSystemMessage?: boolean;
  actionType?: string;
}

type ViewType = 'applications' | 'queries' | 'history';
type TabType = 'my-queries' | 'query-resolved';

// Fetch queries assigned to Sales team
const fetchSalesQueries = async (): Promise<Query[]> => {
  const response = await fetch('/api/queries?team=sales');
  const result = await response.json();
  
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to fetch sales queries');
  }
  
  return result.data.filter((query: Query) => 
    query.sendToSales || 
    query.sendTo.includes('Sales') || 
    query.markedForTeam === 'sales' || 
    query.markedForTeam === 'both'
  );
};

// Fetch chat messages for a specific query
const fetchChatMessages = async (queryId: number): Promise<HistoryEntry[]> => {
  try {
    // Use query-actions API to get complete history including revert actions
    const response = await fetch(`/api/query-actions?queryId=${queryId}&type=messages`);
    if (!response.ok) {
      return [];
    }
  const result = await response.json();
  
    // Convert messages to history format
    return result.data?.map((msg: any) => {
      let type = `${msg.senderRole || 'System'} Response`;
      
      // Special handling for revert actions
      if (msg.actionType === 'revert' || msg.message?.includes('reverted')) {
        type = 'Revert Action';
      }
      
      return {
        type,
      time: new Date(msg.timestamp || Date.now()).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
        text: msg.text || msg.message || msg.responseText || '',
      sender: msg.sender,
        senderRole: msg.senderRole,
        isSystemMessage: msg.isSystemMessage || false,
        actionType: msg.actionType
      };
    }) || [];
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    return [];
  }
};

export default function SalesDashboard() {
  // Tab and view state management
  const [activeTab, setActiveTab] = useState<TabType>('my-queries');
  const [currentView, setCurrentView] = useState<ViewType>('applications');
  const [selectedAppNo, setSelectedAppNo] = useState<string>('');
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [selectedQueries, setSelectedQueries] = useState<Array<Query & { queryIndex: number; queryText: string; queryId: string; title: string }>>([]);
  
  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connected');
  
  // Auto-refresh and stats
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [newQueriesCount, setNewQueriesCount] = useState(0);
  
  // Modal state
  // Removed revert modal state variables
  const [newMessage, setNewMessage] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessageText, setSuccessMessageText] = useState('');
  
  const queryClient = useQueryClient();
  const { user, logout } = useAuth();

  // Fetch query statistics for real-time updates
  const fetchSalesQueryStats = async () => {
    try {
      const response = await fetch('/api/queries?stats=true&team=sales');
      const result = await response.json();
      
      if (result.success) {
        setNewQueriesCount(result.data.pending || 0);
      }
    } catch (error) {
      console.error('Error fetching sales query stats:', error);
    }
  };

  // Initial load
  useEffect(() => {
    fetchSalesQueryStats();
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      handleRefresh();
    }, 20000); // Refresh every 20 seconds

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleRefresh = async () => {
    setLastRefreshed(new Date());
    await fetchSalesQueryStats();
    await refetch();
  };

  const handleToggleAutoRefresh = () => {
    setAutoRefresh(prev => !prev);
  };
  
  // Fetch Sales queries with real-time updates
  const { data: queries, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['salesQueries'],
    queryFn: fetchSalesQueries,
    refetchOnWindowFocus: false,
    staleTime: 10 * 1000, // 10 seconds
    refetchInterval: 20000, // Auto-refresh every 20 seconds
  });

  // Extract individual queries for display
  const individualQueries = React.useMemo(() => {
    if (!queries) return [];
    
    const individual: Array<Query & { queryIndex: number; queryText: string; queryId: string; title: string }> = [];
    
    queries.forEach(queryGroup => {
      // Only include queries marked for sales team
      if (queryGroup.markedForTeam === 'sales' || queryGroup.markedForTeam === 'both') {
        queryGroup.queries.forEach((query, index) => {
          individual.push({
            ...queryGroup,
            queryIndex: index + 1,
            queryText: query.text,
            queryId: query.id,
            id: parseInt(query.id.split('-')[0]) + index, // Unique ID for each query
            title: `Query ${index + 1} - ${queryGroup.appNo}`
          });
        });
      }
    });
    
    return individual;
  }, [queries]);

  // Group individual queries by application number for the applications view
  const groupedQueries = React.useMemo(() => {
    const grouped = new Map();
    individualQueries.forEach(query => {
      if (!grouped.has(query.appNo)) {
        grouped.set(query.appNo, []);
      }
      grouped.get(query.appNo).push(query);
    });
    return grouped;
  }, [individualQueries]);

  // Filter applications based on search term
  const filteredApplications = React.useMemo(() => {
    if (!searchTerm.trim()) return Array.from(groupedQueries.entries());
    
    return Array.from(groupedQueries.entries()).filter(([appNo, queries]) => {
      const firstQuery = queries[0];
      return (
        appNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        firstQuery?.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        firstQuery?.branch?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [groupedQueries, searchTerm]);

  // Load history when a query is selected
  useEffect(() => {
    if (selectedQuery && currentView === 'history') {
      setConnectionStatus('connecting');
      fetchChatMessages(selectedQuery.id)
        .then(data => {
          setHistoryData(data);
          setConnectionStatus('connected');
        })
        .catch(error => {
          console.error('Error loading history:', error);
          setConnectionStatus('disconnected');
          setHistoryData([]);
        });
    }
  }, [selectedQuery, currentView, user]);

  // Auto-refresh with connection monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentView === 'applications') {
        setConnectionStatus('connecting');
        refetch().then(() => {
          setConnectionStatus('connected');
        }).catch(() => {
          setConnectionStatus('disconnected');
        });
      }
    }, 25000); // Refresh every 25 seconds

    return () => clearInterval(interval);
  }, [currentView, refetch]);

  // Remove revert functionality

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { queryId: number; message: string }) => {
      console.log(`💬 Sending message from Sales team for query ${data.queryId}`);
      
      const requestBody = {
          type: 'message',
          queryId: data.queryId,
          message: data.message,
          addedBy: user?.name || 'Sales User',
          team: 'Sales'
      };
      
      console.log('📝 Sending message:', requestBody);
      
      const response = await fetch('/api/query-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      const result = await response.json();
      
      if (!response.ok || !result.success) {
        console.error('❌ Failed to send message:', result);
        throw new Error(result.error || 'Failed to send message');
      }
      
      console.log('✅ Message sent successfully:', result);
      return result;
    },
    onSuccess: () => {
      setNewMessage('');
      showSuccessNotification('Message sent successfully! 📤');
      
      // Refresh chat messages
      if (selectedQuery) {
        loadChatMessages(selectedQuery.id);
      }
    },
    onError: (error: Error) => {
      console.error('Error sending message:', error);
      showSuccessNotification(`❌ Error: ${error.message}`);
    }
  });

  // Show success notification
  const showSuccessNotification = (message: string) => {
    setSuccessMessageText(message);
    setShowSuccessMessage(true);
    setTimeout(() => {
      setShowSuccessMessage(false);
    }, 3000);
  };

  // View switching functions
  const showView = (view: ViewType) => {
    setCurrentView(view);
  };

  const handleApplicationClick = (appNo: string) => {
    const appQueries = groupedQueries.get(appNo) || [];
    setSelectedAppNo(appNo);
    setSelectedQueries(appQueries);
    showView('queries');
  };

  const handleQueryClick = (query: Query) => {
    setSelectedQuery(query);
    // Load chat messages for the selected query
    loadChatMessages(query.id);
    showView('history');
  };

  const handleBackToApplications = () => {
    setSelectedAppNo('');
    setSelectedQueries([]);
    showView('applications');
  };

  const handleBackToQueries = () => {
    setSelectedQuery(null);
    setHistoryData([]);
    showView('queries');
  };

  // Remove revert handlers

  // Load chat messages for the selected query
  const loadChatMessages = async (queryId: number) => {
    try {
      const response = await fetch(`/api/query-actions?queryId=${queryId}`);
      const result = await response.json();
      
      if (result.success) {
        const messages = result.data?.messages || [];
        messages.sort((a: { timestamp: string }, b: { timestamp: string }) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        // Convert messages to history format
        const historyEntries = messages.map((msg: any) => ({
          type: msg.team ? `${msg.team} Team Response` : 'System Message',
          time: new Date(msg.timestamp).toLocaleString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }),
          text: msg.responseText || msg.message || '',
          sender: msg.sender,
          senderRole: msg.senderRole,
          actionType: msg.actionType
        }));
        
        setHistoryData(historyEntries);
      }
    } catch (error) {
      console.error('Error loading chat messages:', error);
      showSuccessNotification('❌ Error loading messages');
    }
  };

  // Handle send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedQuery) return;

    sendMessageMutation.mutate({
      queryId: selectedQuery.id,
      message: newMessage.trim()
    });
  };

  // Handle logout
  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      logout();
    }
  };

  // Handle tab change
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    // Reset view state when switching tabs
    setCurrentView('applications');
    setSelectedAppNo('');
    setSelectedQuery(null);
    setSelectedQueries([]);
    setHistoryData([]);
  };

  // Connection status indicator
  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'bg-green-500';
      case 'connecting': return 'bg-yellow-500';
      case 'disconnected': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  // Render tab navigation
  const renderTabNavigation = () => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 mb-6">
      <nav className="flex space-x-1" aria-label="Tabs">
        <button
          onClick={() => handleTabChange('my-queries')}
          className={`
            flex-1 text-center py-3 px-4 text-sm font-medium rounded-md transition-all duration-200
            ${activeTab === 'my-queries'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }
          `}
        >
          My Queries
        </button>
        <button
          onClick={() => handleTabChange('query-resolved')}
          className={`
            flex-1 text-center py-3 px-4 text-sm font-medium rounded-md transition-all duration-200
            ${activeTab === 'query-resolved'
              ? 'bg-blue-500 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }
          `}
        >
          Query Resolved
        </button>
      </nav>
    </div>
  );

  // Render Query Resolved tab
  if (activeTab === 'query-resolved') {
    return (
      <div className="min-h-screen bg-gray-100">
        <SalesHeader 
          onRefresh={handleRefresh}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={handleToggleAutoRefresh}
          newQueriesCount={newQueriesCount}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {renderTabNavigation()}
          <SalesQueryResolved />
        </div>
      </div>
    );
  }

  if (isLoading && !queries) {
    return <LoadingState message="Loading sales queries..." />;
  }

  if (isError && !queries) {
    return <ErrorState message={error?.message || 'Failed to load sales queries'} onRetry={refetch} />;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <SalesHeader 
        onRefresh={handleRefresh}
        autoRefresh={autoRefresh}
        onToggleAutoRefresh={handleToggleAutoRefresh}
        newQueriesCount={newQueriesCount}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderTabNavigation()}
        
        <div className="h-screen w-full bg-white overflow-hidden shadow-xl rounded-lg font-['Inter',sans-serif]">

          {/* View 1: Applications List (Dashboard) */}
      {currentView === 'applications' && (
        <div className="view flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <div>
                    <h1 className="text-xl font-bold text-gray-800">My Queries</h1>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-gray-600">Sales Dashboard</span>
                      <div className={`w-2 h-2 rounded-full ${getConnectionStatusColor()}`} title={`Connection: ${connectionStatus}`}></div>
                    </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-full">
                      {filteredApplications.length} Applications
                </span>
                <button 
                  onClick={() => refetch()}
                  className="p-2 rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition-colors"
                      title="Refresh applications"
                      disabled={isLoading}
                >
                  <FaSync className={`${isLoading ? 'animate-spin' : ''}`} />
                </button>
                    <div className="hidden sm:flex items-center gap-2 ml-2 pl-2 border-l border-gray-300">
                      <span className="text-sm text-gray-600">{user?.name || user?.employeeId}</span>
                      <button
                        onClick={handleLogout}
                        className="p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors"
                        title="Logout"
                      >
                        <FaSignOutAlt />
                      </button>
                    </div>
                    {/* Mobile logout button */}
                    <button
                      onClick={handleLogout}
                      className="sm:hidden p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors ml-2"
                      title="Logout"
                    >
                      <FaSignOutAlt />
                    </button>
                  </div>
                </div>
          </div>
          
          {/* Applications List */}
              <div className="flex-grow overflow-y-auto p-4 space-y-3" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 #f1f5f9'
              }}>
                {filteredApplications.length === 0 ? (
                  <EmptyState message="No applications with queries assigned to Sales team" />
                ) : (
                  filteredApplications.map(([appNo, appQueries]) => {
                    const firstQuery = appQueries[0];
                    const isActive = appQueries.some((q: Query) => q.status === 'pending');
                
                return (
                  <div 
                    key={appNo} 
                        className="p-4 bg-gray-50 border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-colors duration-200"
                    onClick={() => handleApplicationClick(appNo)}
                  >
                    <div className="flex justify-between items-center">
                          <div>
                      <h2 className="text-md font-semibold text-gray-800">{appNo}</h2>
                            <p className="text-sm text-gray-600 mt-1">{firstQuery?.customerName || 'Unknown Customer'}</p>
                            <p className="text-xs text-gray-500">
                              {appQueries.length} individual {appQueries.length === 1 ? 'query' : 'queries'} for Sales team
                            </p>
                    </div>
                          <StatusBadge status={isActive ? 'active' : 'closed'} size="sm" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* View 2: Queries List */}
      {currentView === 'queries' && (
        <div className="view flex flex-col h-full">
          {/* Header */}
              <div className="p-4 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
                <div className="flex items-center">
            <button 
              onClick={handleBackToApplications}
                    className="p-2 rounded-full hover:bg-gray-200 mr-2 transition-colors"
            >
              <FaArrowLeft className="h-6 w-6 text-gray-600" />
            </button>
            <div>
                    <h1 className="text-xl font-bold text-gray-800">
                      Queries for <span className="text-blue-600">{selectedAppNo}</span>
                    </h1>
                    <p className="text-sm text-gray-600">
                      {selectedQueries[0]?.customerName || 'Customer'} • {selectedQueries.length} {selectedQueries.length === 1 ? 'query' : 'queries'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2">
                    <span className="text-sm text-gray-600">{user?.name || user?.employeeId}</span>
                    <button
                      onClick={handleLogout}
                      className="p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors"
                      title="Logout"
                    >
                      <FaSignOutAlt />
                    </button>
                  </div>
                  {/* Mobile logout button */}
                  <button
                    onClick={handleLogout}
                    className="sm:hidden p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors"
                    title="Logout"
                  >
                    <FaSignOutAlt />
                  </button>
            </div>
          </div>
          
          {/* Query List */}
              <div className="flex-grow overflow-y-auto p-4 space-y-3" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 #f1f5f9'
              }}>
                {selectedQueries.length === 0 ? (
                  <EmptyState message="No queries found for this application" />
                ) : (
                  selectedQueries.map((query) => {
                    const timeAgo = query.lastUpdated ? 
                      new Date(query.lastUpdated).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }) : 'Recently';

                    return (
              <div 
                key={`${query.id}-${query.queryIndex}`}
                        className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleQueryClick(query)}
              >
                        <div className="query-details">
                          <div className="flex items-start justify-between">
                            <div className="flex-grow">
                <h2 className="text-md font-semibold text-gray-800">
                                Query {query.queryIndex} - {query.appNo}
                </h2>
                              <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                {query.queryText || 'No query text available'}
                </p>
                              <div className="flex items-center gap-4 mt-2">
                  <span className="text-xs text-gray-500">
                                  Last updated: {timeAgo}
                  </span>
                                <span className="text-xs text-blue-600 font-medium">
                                  For Sales Team
                  </span>
                                <StatusBadge status={query.status} size="sm" />
                              </div>
                            </div>
                            <div className="flex items-center">
                  {query.status === 'pending' && (
                                <FaClock className="text-yellow-500 ml-2" />
                              )}
                              {query.status === 'approved' && (
                                <FaCheckCircle className="text-green-500 ml-2" />
                              )}
                              {query.status === 'deferred' && (
                                <FaExclamationCircle className="text-orange-500 ml-2" />
                              )}
                              {query.status === 'otc' && (
                                <FaCheckCircle className="text-blue-500 ml-2" />
                  )}
                </div>
              </div>
                        </div>
                      </div>
                    );
                  })
            )}
          </div>
        </div>
      )}

          {/* View 3: History/Remarks View */}
          {currentView === 'history' && (
        <div className="view flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center">
              <button 
                onClick={handleBackToQueries}
                    className="p-2 rounded-full hover:bg-gray-200 mr-3 transition-colors"
              >
                <FaArrowLeft className="h-6 w-6 text-gray-600" />
              </button>
              <div>
                    <h1 className="text-xl font-bold text-gray-800">
                      Query Details
                    </h1>
                    <p className="text-sm text-gray-600">
                      {selectedQuery?.appNo} • {selectedQuery?.customerName} • 
                      <StatusText status={selectedQuery?.status || 'pending'} className="ml-1" />
                    </p>
              </div>
            </div>
                <div className="flex items-center gap-2">
                  <div className="hidden sm:flex items-center gap-2 ml-2 pl-2 border-l border-gray-300">
                    <span className="text-sm text-gray-600">{user?.name || user?.employeeId}</span>
                    <button
                      onClick={handleLogout}
                      className="p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors"
                      title="Logout"
                    >
                      <FaSignOutAlt />
                    </button>
                  </div>
                  {/* Mobile logout button */}
                  <button
                    onClick={handleLogout}
                    className="sm:hidden p-2 rounded-full text-red-600 hover:bg-red-50 transition-colors ml-2"
                    title="Logout"
                  >
                    <FaSignOutAlt />
                  </button>
                </div>
              </div>
              
              {/* History Content */}
              <div className="flex-grow overflow-y-auto p-6 space-y-4" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 #f1f5f9'
              }}>
                {historyData.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-gray-500">No history available for this query</p>
                  </div>
                ) : (
                  historyData.map((entry, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg shadow-sm">
                      {entry.actionType === 'revert' ? (
                        <RevertMessageBox 
                          message={{
                            id: `history-${index}`,
                            message: entry.text,
                            responseText: entry.text,
                            sender: entry.sender || 'Sales Team',
                            senderRole: entry.senderRole || 'sales',
                            team: 'Sales Team',
                            timestamp: entry.time,
                            actionType: entry.actionType,
                            revertReason: entry.text
                          }} 
                          teamContext="sales" 
                        />
                      ) : (
                        <>
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="font-semibold text-gray-700">{entry.type}</h3>
                            <span className="text-xs text-gray-500">{entry.time}</span>
                          </div>
                          <p className="text-gray-600 leading-relaxed">{entry.text}</p>
                          {entry.sender && (
                            <p className="text-xs text-gray-500 mt-2">— {entry.sender}</p>
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Message Input */}
              <div className="p-4 bg-white border-t border-gray-200 flex-shrink-0">
                <div className="flex items-center space-x-4">
                  <input
                    type="text"
                    placeholder="Type a message..." 
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    className="flex-1 px-4 py-2 bg-white border-2 border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black font-bold"
                    style={{ color: '#000000', backgroundColor: '#ffffff', fontWeight: '700' }}
                  />
                  <button 
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {sendMessageMutation.isPending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white"></div>
                    ) : (
                      <>
                        <span className="hidden sm:inline">Send</span>
                        <svg className="h-4 w-4 ml-0 sm:ml-2" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              </div>
                      </div>
                    )}
                    
          {/* Success Message */}
          {showSuccessMessage && (
            <div className={`fixed top-5 right-5 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg transition-transform duration-300 z-50 ${
              showSuccessMessage ? 'translate-x-0' : 'translate-x-full'
            }`}>
              {successMessageText}
                      </div>
          )}

          {/* Revert modal removed */}
        </div>
      </div>
    </div>
  );
} 