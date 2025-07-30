'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FaArrowLeft, FaSync, FaCheck, FaHandshake, FaPause, FaSearch, FaClock, FaUser, FaComments, FaPaperPlane, FaBell, FaWifi, FaPlay, FaPauseCircle, FaUndo } from 'react-icons/fa';
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
  title?: string;
  priority?: 'high' | 'medium' | 'low';
  tat?: string;
  queryId?: string; // Individual query ID
  queryIndex?: number; // Query number within application
}

interface ChatMessage {
  id: string;
  queryId: number;
  message: string;
  sender: string;
  senderRole: string;
  timestamp: string;
  team?: string;
  responseText?: string;
  isSystemMessage?: boolean; // Added for system messages
  actionType?: string; // Added for action type (e.g., 'revert')
}

// View types for the three-view interface
type ViewType = 'applications' | 'queries' | 'chat';

// Fetch queries function - Now fetches from real queries API
const fetchQueries = async (): Promise<Query[]> => {
  try {
    // Fetch from the actual queries API where AddQuery submits data
  const response = await fetch('/api/queries?status=pending');
  const result = await response.json();
  
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to fetch queries');
  }
  
    // Convert the API response to the format expected by the component
    const queries = result.data.map((queryData: any) => ({
      id: queryData.id,
      appNo: queryData.appNo,
      customerName: queryData.customerName,
      title: queryData.queries[0]?.text || `Query ${queryData.id}`,
      queries: queryData.queries.map((q: any) => ({
        id: q.id,
        text: q.text,
        timestamp: q.timestamp || queryData.submittedAt,
        sender: q.sender || queryData.submittedBy
      })),
      sendTo: queryData.sendTo,
      submittedBy: queryData.submittedBy,
      submittedAt: queryData.submittedAt,
      status: queryData.status,
      branch: queryData.branch,
      branchCode: queryData.branchCode,
      markedForTeam: queryData.markedForTeam,
      tat: '24 hours', // Default TAT
      priority: 'medium' // Default priority
    }));
    
    return queries;
  } catch (error) {
    console.error('Error fetching queries:', error);
    throw error;
  }
};

export default function QueryRaised() {
  // View state management
  const [currentView, setCurrentView] = useState<ViewType>('applications');
  const [selectedAppNo, setSelectedAppNo] = useState<string>('');
  const [selectedQuery, setSelectedQuery] = useState<Query | null>(null);
  const [appQueries, setAppQueries] = useState<Array<Query & { queryIndex: number; queryText: string; queryId: string }>>([]);
  
  // UI state
  const [searchTerm, setSearchTerm] = useState('');
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'deferral' | 'otc' | 'revert' | null>(null);
  const [selectedPerson, setSelectedPerson] = useState('');
  const [actionRemarks, setActionRemarks] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Real-time state
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [newQueryCount, setNewQueryCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connected');
  
  // Chat functionality
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  // Available people for actions
  const availablePeople = [
    'Sumit Khari', 'Aashish Srivastava', 'Punit Chadha', 
    'Abhishek Mishra', 'Aarti Pujara', 'Mohan Keswani', 'Vikram Diwan'
  ];
  
  // Fetch queries with real-time updates
  const { data: queries, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['pendingQueries'],
    queryFn: async () => {
      setConnectionStatus('connecting');
      try {
        const result = await fetchQueries();
        setConnectionStatus('connected');
        setLastUpdated(new Date());
        return result;
      } catch (error) {
        setConnectionStatus('disconnected');
        throw error;
      }
    },
    refetchOnWindowFocus: true,
    staleTime: 10000, // 10 seconds
    refetchInterval: autoRefresh ? 15000 : false, // Auto-refresh every 15 seconds when enabled
    refetchIntervalInBackground: true, // Continue refreshing in background
  });

  // Real-time refresh management for applications view
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;
    
    if (autoRefresh && currentView === 'applications') {
      refreshInterval = setInterval(async () => {
        setIsRefreshing(true);
        try {
          await refetch();
          // Simulate new query detection (in real app, this would come from WebSocket or server)
          if (Math.random() > 0.85) {
            setNewQueryCount(prev => prev + 1);
            showSuccessMessage('New query detected! 🔔');
          }
        } catch (error) {
          console.error('Auto-refresh failed:', error);
          setConnectionStatus('disconnected');
        } finally {
          setIsRefreshing(false);
        }
      }, 15000);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh, currentView, refetch]);

  // Auto-refresh app queries when in queries view
  useEffect(() => {
    let appRefreshInterval: NodeJS.Timeout;
    
    if (autoRefresh && currentView === 'queries' && selectedAppNo && queries) {
      appRefreshInterval = setInterval(async () => {
        setIsRefreshing(true);
        try {
          // Trigger a refetch of main queries and update app queries
          const result = await refetch();
          
          if (result.data) {
            // Create grouped queries from the fresh data
            const freshGrouped = new Map();
            result.data.forEach(query => {
              if (!freshGrouped.has(query.appNo)) {
                freshGrouped.set(query.appNo, []);
              }
              freshGrouped.get(query.appNo).push(query);
            });
            
            // Update app queries from the refreshed grouped data
            const updatedAppQueries = freshGrouped.get(selectedAppNo) || [];
            
            // Check for new queries
            const oldCount = appQueries.length;
            const newCount = updatedAppQueries.length;
            
            if (newCount > oldCount) {
              showSuccessMessage(`${newCount - oldCount} new query(s) added! 🔔`);
            }
            
            // Check for status changes
            const statusChanges = updatedAppQueries.filter((newQuery: Query, index: number) => {
              const oldQuery = appQueries[index];
              return oldQuery && oldQuery.status !== newQuery.status;
            });
            
            if (statusChanges.length > 0) {
              showSuccessMessage(`${statusChanges.length} query status updated! ✅`);
            }
            
            setAppQueries(updatedAppQueries);
          }
          
          setLastUpdated(new Date());
        } catch (error) {
          console.error('Failed to refresh app queries:', error);
        } finally {
          setIsRefreshing(false);
        }
      }, 20000); // Refresh every 20 seconds
    }

    return () => {
      if (appRefreshInterval) {
        clearInterval(appRefreshInterval);
      }
    };
  }, [autoRefresh, currentView, selectedAppNo, appQueries.length, refetch, queries]);

  // Auto-refresh chat messages when in chat view
  useEffect(() => {
    let chatRefreshInterval: NodeJS.Timeout;
    
    if (autoRefresh && currentView === 'chat' && selectedQuery) {
      console.log(`🔄 Starting auto-refresh for chat messages (Query ${selectedQuery.id})`);
      
      chatRefreshInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/query-actions?queryId=${selectedQuery.id}`);
          const result = await response.json();
          
          if (result.success && result.data?.messages) {
            const oldCount = chatMessages.length;
            const newMessages = result.data.messages;
            
            // Sort messages chronologically
            newMessages.sort((a: { timestamp: string }, b: { timestamp: string }) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            
            // Check for new messages
            if (newMessages.length > oldCount) {
              const newMessageCount = newMessages.length - oldCount;
              showSuccessMessage(`${newMessageCount} new message(s) received! 💬`);
              
              // Scroll to bottom when new messages arrive
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }
            
            setChatMessages(newMessages);
            setLastUpdated(new Date());
          } else {
            console.warn('No messages in refresh response:', result);
          }
        } catch (error) {
          console.error('Failed to refresh chat messages:', error);
          setConnectionStatus('disconnected');
        }
      }, 5000); // Refresh every 5 seconds for faster real-time updates
    }

    return () => {
      if (chatRefreshInterval) {
        console.log('🛑 Stopping auto-refresh for chat messages');
        clearInterval(chatRefreshInterval);
      }
    };
  }, [autoRefresh, currentView, selectedQuery, chatMessages.length]);

  // Mutations for actions
  const actionMutation = useMutation({
    mutationFn: async ({ action, queryId, person, remarks }: {
      action: string;
      queryId: string | number;
      person?: string;
      remarks: string;
    }) => {
      console.log(`🎯 Submitting ${action} action for query ${queryId}`);
      
      const requestBody: any = {
        type: 'action',
        queryId,
        action,
        remarks,
        operationTeamMember: user?.name || 'Operations User'
      };

      // Assignment is optional for all actions - all are approval stages
      if (person) {
        requestBody.assignedTo = person;
      }

      console.log('📝 Sending action request:', requestBody);

      const response = await fetch('/api/query-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Action failed:', errorData);
        throw new Error(errorData.error || 'Failed to submit action');
      }
      
      const result = await response.json();
      console.log('✅ Action completed successfully:', result);
      return result;
    },
    onSuccess: (data, variables) => {
      refetch();
      setShowActionModal(false);
      setActionRemarks('');
      setSelectedPerson('');
      
      // Invalidate relevant query caches for real-time updates
      queryClient.invalidateQueries({ queryKey: ['pendingQueries'] });
      queryClient.invalidateQueries({ queryKey: ['allQueries'] }); // For QueryResolved component
      queryClient.invalidateQueries({ queryKey: ['allQueriesForReports'] }); // For QueryReports component
      queryClient.invalidateQueries({ queryKey: ['resolvedQueries'] });
      queryClient.invalidateQueries({ queryKey: ['salesQueries'] });
      queryClient.invalidateQueries({ queryKey: ['creditQueries'] });
      
      // Show specific success messages based on action type
      let message = 'Action completed successfully! ✅';
      
      switch (variables.action) {
        case 'approve':
          message = `Single query approved successfully! Query moved to resolved section. ✅`;
          break;
        case 'deferral':
          message = `Single query deferred to ${variables.person} successfully! Query moved to resolved section. 📋`;
          break;
        case 'otc':
          message = `Single query OTC assigned to ${variables.person} successfully! Query moved to resolved section. 🏢`;
          break;
      }
      
      showSuccessMessage(message);
      
      // Refresh current view data
      if (currentView === 'queries' && selectedAppNo) {
        handleSelectApplication(selectedAppNo);
      }
      
      // Clear the selected query after successful action
      setSelectedQuery(null);
    },
    onError: (error: Error, variables) => {
      console.error('💥 Action failed:', error);
      const actionName = variables.action.charAt(0).toUpperCase() + variables.action.slice(1);
      showSuccessMessage(`❌ Error: Failed to ${variables.action} query. ${error.message}`);
    }
  });

  // Extract individual queries for display - only pending queries
  const individualQueries = React.useMemo(() => {
    if (!queries || queries.length === 0) return [];
    
    const individual: Array<Query & { queryIndex: number; queryText: string; queryId: string }> = [];
    
    queries.forEach(queryGroup => {
      queryGroup.queries.forEach((query, index) => {
        // Only include queries that are pending
        const queryStatus = query.status || queryGroup.status;
        if (queryStatus === 'pending') {
          individual.push({
            ...queryGroup,
            queryIndex: index + 1,
            queryText: query.text,
            queryId: query.id,
            id: parseInt(query.id.split('-')[0]) + index, // Unique ID for each query
            title: `Query ${index + 1} - ${queryGroup.appNo}`,
            status: queryStatus
          });
        }
      });
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

  // Filter applications based on search
  const filteredApplications = React.useMemo(() => {
    if (!queries || queries.length === 0) return [];
    
    const applications = Array.from(groupedQueries.keys());
    if (!searchTerm) return applications;
    
    return applications.filter(appNo => 
      appNo.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [groupedQueries, searchTerm, queries]);

  // Handle navigation
  const handleSelectApplication = async (appNo: string) => {
    setSelectedAppNo(appNo);
    setCurrentView('queries');
    
    // Filter individual queries from the main queries list for this application
    const appQueriesFiltered = individualQueries.filter(query => query.appNo === appNo);
      setAppQueries(appQueriesFiltered);
  };

  const handleSelectQuery = (query: Query) => {
    setSelectedQuery(query);
    setCurrentView('chat');
    // Load chat messages for this query
    loadChatMessages(query.id);
  };

  const handleBackToApplications = () => {
    setCurrentView('applications');
    setSelectedAppNo('');
    setAppQueries([]);
  };

  const handleBackToQueries = () => {
    setCurrentView('queries');
    setSelectedQuery(null);
    setChatMessages([]);
  };

  // Action handlers
  const handleAction = (type: 'approve' | 'deferral' | 'otc') => {
    setActionType(type);
    setShowActionModal(true);
  };

  const handleSubmitAction = () => {
    if (!selectedQuery) return;

    // Use the individual query ID, not the application ID
    const individualQueryId = selectedQuery.queryId || selectedQuery.id;
    
    console.log(`🎯 Processing individual query: ${individualQueryId} for app: ${selectedQuery.appNo}`);

    actionMutation.mutate({
      action: actionType!,
      queryId: individualQueryId,
      person: actionType !== 'approve' ? selectedPerson : undefined,
      remarks: actionRemarks
    });
  };
  
  const showSuccessMessage = (message = 'Success! The action was completed.') => {
    setSuccessMessage(message);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
    }, 3000);
  };

  // Toggle auto-refresh
  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh);
    showSuccessMessage(autoRefresh ? 'Auto-refresh disabled' : 'Auto-refresh enabled');
  };



  // Load chat messages with proper error handling and loading state
  const loadChatMessages = async (queryId: number) => {
    try {
      console.log(`🔄 Loading chat messages for query ${queryId}`);
      
      // Fetch all message types including responses from Sales and Credit
      const response = await fetch(`/api/query-actions?queryId=${queryId}`);
      const result = await response.json();
      
      if (result.success) {
        // Get messages array from the response
        const messages = result.data?.messages || [];
        console.log(`📬 Loaded ${messages.length} messages for query ${queryId}:`, messages);
        
        // Sort messages by timestamp to ensure chronological order (oldest first)
        messages.sort((a: { timestamp: string }, b: { timestamp: string }) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        
        setChatMessages(messages);
        
        // Scroll to bottom after loading messages
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        console.error('Failed to load chat messages:', result.error);
        showSuccessMessage('❌ Failed to load chat messages');
      }
    } catch (error) {
      console.error('Error loading chat messages:', error);
      showSuccessMessage('❌ Error loading chat messages');
    }
  };

  // Send message
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedQuery) return;

    try {
      const response = await fetch('/api/query-actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'message',
      queryId: selectedQuery.id,
      message: newMessage,
          addedBy: user?.name || 'Operations User',
          team: 'Operations'
        }),
      });

      if (response.ok) {
        setNewMessage('');
        loadChatMessages(selectedQuery.id);
        showSuccessMessage('Message sent! 📤');
      } else {
        const errorData = await response.json();
        showSuccessMessage(`❌ Error: Failed to send message. ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      showSuccessMessage('❌ Error: Failed to send message. Please try again.');
    }
  };

  // Format time
  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
      day: 'numeric'
    });
  };

  const formatLastUpdated = () => {
    return lastUpdated.toLocaleTimeString('en-US', {
      hour: '2-digit',
        minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-orange-600';
      case 'approved': return 'text-green-600';
      case 'deferred': return 'text-yellow-600';
      case 'otc': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <FaWifi className="h-4 w-4 text-green-500" />;
      case 'connecting':
        return <FaSync className="h-4 w-4 text-yellow-500 animate-spin" />;
      case 'disconnected':
        return <FaWifi className="h-4 w-4 text-red-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-600">Loading queries...</span>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <p className="text-lg font-medium">Error Loading Queries</p>
          <p className="text-sm text-gray-600">{error?.message}</p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-white overflow-hidden shadow-xl rounded-lg max-w-6xl mx-auto">
      {/* Success Message */}
      {showSuccess && (
        <div className="fixed top-5 right-5 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50 transition-transform">
          {successMessage}
        </div>
      )}

      {/* View 1: Applications List */}
      {currentView === 'applications' && (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-800">Query Raised Applications</h1>
              <div className="flex items-center space-x-2">
                {getConnectionStatusIcon()}
                <span className="text-xs text-gray-500">
                  {connectionStatus}
                </span>
              </div>
            </div>
            
            {/* Real-time Controls */}
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-xs text-gray-500">
                  Last updated: {formatLastUpdated()}
                </span>
                {isRefreshing && (
                  <span className="text-xs text-blue-600 flex items-center">
                    <FaSync className="h-3 w-3 animate-spin mr-1" />
                    Refreshing...
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
              <button 
                  onClick={toggleAutoRefresh}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    autoRefresh 
                      ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {autoRefresh ? (
                    <><FaPause className="inline h-3 w-3 mr-1" />Auto-refresh ON</>
                  ) : (
                    <><FaPlay className="inline h-3 w-3 mr-1" />Auto-refresh OFF</>
                  )}
              </button>
            </div>
            </div>
            
      {/* Search */}
            <div className="mt-4 relative">
              <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <input
          type="text"
                placeholder="Search applications..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black font-bold bg-white"
                style={{ color: '#000000', backgroundColor: '#ffffff', fontWeight: '700' }}
        />
            </div>
      </div>

          {/* Summary Stats */}
          {filteredApplications.length > 0 && (
            <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-lg font-bold text-gray-800">
                    {individualQueries.length}
                  </div>
                  <div className="text-xs text-gray-600">Total Individual Queries</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-orange-600">
                    {individualQueries.filter((q: Query) => q.status === 'pending').length}
                  </div>
                  <div className="text-xs text-gray-600">Pending</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-green-600">
                    {individualQueries.filter((q: Query) => q.status === 'approved').length}
                  </div>
                  <div className="text-xs text-gray-600">Approved</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-blue-600">
                    {filteredApplications.length}
                  </div>
                  <div className="text-xs text-gray-600">Applications</div>
                </div>
              </div>
            </div>
          )}

          {/* Application List */}
          <div className="flex-grow overflow-y-auto p-4 space-y-3">
            {filteredApplications.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FaComments className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No applications with queries found</p>
                <p className="text-xs mt-2">Queries will appear here once raised</p>
              </div>
            ) : (
              filteredApplications.map((appNo) => {
                const queries = groupedQueries.get(appNo) || [];
                const activeQueries = queries.filter((q: Query) => q.status === 'pending').length;
                const approvedQueries = queries.filter((q: Query) => q.status === 'approved').length;
                const deferredQueries = queries.filter((q: Query) => q.status === 'deferred').length;
                const otcQueries = queries.filter((q: Query) => q.status === 'otc').length;
                const totalQueries = queries.length;
                const firstQuery = queries[0]; // Get first query for customer info
            
            return (
              <div 
                    key={appNo} 
                    onClick={() => handleSelectApplication(appNo)}
                    className="p-4 bg-white border border-gray-200 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-blue-400 transition-colors duration-200 relative shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h2 className="text-lg font-semibold text-gray-800">{appNo}</h2>
                          <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
                            {totalQueries} Individual {totalQueries === 1 ? 'Query' : 'Queries'} Raised
                          </span>
                      </div>
                        
                        <p className="text-sm text-gray-600 mb-3">
                          Customer: {firstQuery?.customerName || 'Unknown Customer'}
                        </p>
                        
                        {/* Query Status Summary */}
                        <div className="flex flex-wrap gap-2 text-xs">
                          {activeQueries > 0 && (
                            <span className="bg-orange-200 text-orange-900 px-3 py-1.5 rounded-full font-bold border border-orange-400 shadow-sm">
                              📋 {activeQueries} Pending
                            </span>
                          )}
                          {approvedQueries > 0 && (
                            <span className="bg-green-200 text-green-900 px-3 py-1.5 rounded-full font-bold border border-green-400 shadow-sm">
                              ✅ {approvedQueries} Approved
                            </span>
                          )}
                          {otcQueries > 0 && (
                            <span className="bg-blue-200 text-blue-900 px-3 py-1.5 rounded-full font-bold border border-blue-400 shadow-sm">
                              🔄 {otcQueries} OTC
                            </span>
                          )}
                          {deferredQueries > 0 && (
                            <span className="bg-orange-200 text-orange-900 px-3 py-1.5 rounded-full font-bold border border-orange-400 shadow-sm">
                              ⏸️ {deferredQueries} Deferred
                            </span>
                          )}
                    </div>
                    
                        {/* Teams Involved */}
                        <div className="mt-2 text-xs text-gray-500">
                          Teams: {firstQuery?.markedForTeam === 'both' ? 'Sales, Credit' : 
                                  firstQuery?.markedForTeam === 'sales' ? 'Sales' : 
                                  firstQuery?.markedForTeam === 'credit' ? 'Credit' : 
                                  firstQuery?.sendTo?.join(', ') || 'Unknown'}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-end space-y-2">
                        <span className={`text-sm font-medium px-3 py-1 rounded-full ${
                          activeQueries > 0 
                            ? 'bg-orange-100 text-orange-700' 
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {activeQueries > 0 ? '🔴 Active' : '🟢 All Resolved'}
                        </span>
                        
                        {newQueryCount > 0 && false && (
                          <span className="animate-pulse bg-red-500 text-white text-xs px-2 py-1 rounded-full">
                            🔔 NEW
                          </span>
                        )}
                        
                        <div className="text-xs text-gray-400 text-right">
                          Last: {queries[0] ? formatDate(queries[0].submittedAt) : 'N/A'}
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
      
      {/* View 2: Queries List */}
      {currentView === 'queries' && (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center">
            <button 
              onClick={handleBackToApplications}
                className="p-2 rounded-full hover:bg-gray-200 mr-2"
            >
              <FaArrowLeft className="h-6 w-6 text-gray-600" />
            </button>
            <div>
                <h1 className="text-xl font-bold text-gray-800">
                  Individual Queries for {selectedAppNo}
                </h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>
                    {appQueries.length} individual {appQueries.length === 1 ? 'query' : 'queries'} found
                  </span>
                  <span className="text-xs">
                    Updated: {formatLastUpdated()}
                  </span>
                  {isRefreshing && (
                    <span className="text-blue-600 flex items-center">
                      <FaSync className="h-3 w-3 animate-spin mr-1" />
                      Refreshing...
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getConnectionStatusIcon()}
              <button
                onClick={() => handleSelectApplication(selectedAppNo)}
                disabled={isRefreshing}
                className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              >
                <FaSync className={`h-4 w-4 text-gray-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          
          {/* Query List */}
          <div className="flex-grow overflow-y-auto p-4 space-y-3">
            {appQueries.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No queries found for this application</p>
              </div>
            ) : (
              appQueries.map((query) => (
                <div key={`${query.id}-${query.queryIndex}`} className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                  <div 
                    onClick={() => handleSelectQuery(query)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-gray-700 text-lg">
                          Query {query.queryIndex} - {query.appNo}
                  </span>
                        <span className="text-gray-400">–</span>
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          query.status === 'pending' ? 'bg-orange-100 text-orange-800' :
                          query.status === 'approved' ? 'bg-green-100 text-green-800' :
                          query.status === 'deferred' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {query.status.charAt(0).toUpperCase() + query.status.slice(1)}
                  </span>
                </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          To: {query.markedForTeam || query.sendTo.join(', ')}
                        </span>
              </div>
                    </div>
                    
                    <h2 className="text-md font-semibold text-gray-800 mb-2">
                      {query.queryText || 'No query text available'}
                    </h2>
                    
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Last updated: {formatDate(query.submittedAt)}</span>
                      <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                        TAT: {query.tat || '24 hours'}
                      </span>
                    </div>
                  </div>
                  
                  {query.status === 'pending' && (
                    <div className="mt-4 pt-4 border-t border-gray-200 flex items-center justify-end space-x-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedQuery(query);
                          handleAction('approve');
                        }}
                        className="px-4 py-2 text-sm font-bold text-green-900 bg-green-200 border border-green-400 rounded-full hover:bg-green-300 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-sm"
                      >
                        Approved
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedQuery(query);
                          handleAction('otc');
                        }}
                        className="px-4 py-2 text-sm font-bold text-blue-900 bg-blue-200 border border-blue-400 rounded-full hover:bg-blue-300 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-sm"
                      >
                        OTC
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedQuery(query);
                          handleAction('deferral');
                        }}
                        className="px-4 py-2 text-sm font-bold text-orange-900 bg-orange-200 border border-orange-400 rounded-full hover:bg-orange-300 transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-sm"
                      >
                        Deferral
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* View 3: Chat/Remarks */}
      {currentView === 'chat' && selectedQuery && (
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
            <div className="flex items-center">
              <button 
                onClick={handleBackToQueries}
                className="p-2 rounded-full hover:bg-gray-200 mr-3"
              >
                <FaArrowLeft className="h-6 w-6 text-gray-600" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  {selectedQuery.title || selectedQuery.queries[0]?.text?.slice(0, 40) + '...' || `Query ${selectedQuery.id}`}
                </h1>
                <p className="text-sm text-gray-600">
                  App: {selectedQuery.appNo} • {selectedQuery.customerName}
                  <span className="ml-2 text-xs">
                    {autoRefresh && 'Auto-updating messages'}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {getConnectionStatusIcon()}
            </div>
          </div>
          
          {/* History Content */}
          <div className="flex-grow overflow-y-auto p-6 space-y-4 bg-gray-50">
              {/* Chat Messages */}
              {chatMessages.map((message) => {
                // Determine message type based on team/sender role
                const messageType = message.team === 'Credit' ? 'Credit Response' :
                                   message.team === 'Sales' ? 'Sales Response' : 
                                   message.isSystemMessage ? 'System Message' : 'Operations';
                
                // Check if this is a revert message
                const isRevertMessage = message.actionType === 'revert' || 
                                       (message.message && message.message.includes('🔄 Query Reverted by'));
                
                // Skip system messages or display them differently
                if (message.isSystemMessage) {
                  return (
                    <div key={message.id} className="flex justify-center mb-4">
                      <div className="bg-gradient-to-r from-gray-100 to-gray-200 px-4 py-2 rounded-full text-center text-sm text-gray-700 shadow-sm border border-gray-300 font-medium">
                        <span className="mr-2">ℹ️</span>
                      {message.message}
                      </div>
                    </div>
                  );
                }
                
                // Special styling for revert messages
                if (isRevertMessage) {
                  // Determine the actual team that performed the revert
                  let actualTeamContext: 'sales' | 'credit' | 'operations' = 'operations';
                  
                  // Check the team from the message
                  if (message.team && message.team.toLowerCase().includes('sales')) {
                    actualTeamContext = 'sales';
                  } else if (message.team && message.team.toLowerCase().includes('credit')) {
                    actualTeamContext = 'credit';
                  } else if (message.senderRole && message.senderRole.toLowerCase() === 'sales') {
                    actualTeamContext = 'sales';
                  } else if (message.senderRole && message.senderRole.toLowerCase() === 'credit') {
                    actualTeamContext = 'credit';
                  }

                  return (
                    <div key={message.id} className="mb-8">
                      <div className="relative">
                        {/* Decorative line to separate revert messages */}
                        <div className={`absolute -top-4 left-0 right-0 h-1 rounded-full ${
                          actualTeamContext === 'sales' ? 'bg-gradient-to-r from-blue-200 to-blue-400' : 
                          actualTeamContext === 'credit' ? 'bg-gradient-to-r from-green-200 to-green-400' : 
                          'bg-gradient-to-r from-purple-200 to-purple-400'
                        }`}></div>
                        <RevertMessageBox 
                          message={message} 
                          teamContext={actualTeamContext} 
                        />
                        {/* Decorative line after revert messages */}
                        <div className={`absolute -bottom-4 left-0 right-0 h-1 rounded-full ${
                          actualTeamContext === 'sales' ? 'bg-gradient-to-r from-blue-400 to-blue-200' : 
                          actualTeamContext === 'credit' ? 'bg-gradient-to-r from-green-400 to-green-200' : 
                          'bg-gradient-to-r from-purple-400 to-purple-200'
                        }`}></div>
                </div>
              </div>
                  );
                }
              
                // Get team-specific styling
                const getTeamColors = (team: string) => {
                  switch (team) {
                    case 'Credit':
                      return {
                        bg: 'bg-gradient-to-br from-green-50 via-green-100 to-emerald-50',
                        border: 'border-green-300',
                        icon: '💳',
                        titleColor: 'text-green-900',
                        textColor: 'text-green-800',
                        timestampBg: 'bg-green-200',
                        timestampText: 'text-green-800'
                      };
                    case 'Sales':
                      return {
                        bg: 'bg-gradient-to-br from-blue-50 via-blue-100 to-cyan-50',
                        border: 'border-blue-300',
                        icon: '💼',
                        titleColor: 'text-blue-900',
                        textColor: 'text-blue-800',
                        timestampBg: 'bg-blue-200',
                        timestampText: 'text-blue-800'
                      };
                    default:
                      return {
                        bg: 'bg-gradient-to-br from-purple-50 via-purple-100 to-indigo-50',
                        border: 'border-purple-300',
                        icon: '⚙️',
                        titleColor: 'text-purple-900',
                        textColor: 'text-purple-800',
                        timestampBg: 'bg-purple-200',
                        timestampText: 'text-purple-800'
                      };
                  }
                };

                const teamColors = getTeamColors(message.team || '');

                return (
                  <div key={message.id} className={`${teamColors.bg} p-5 rounded-xl shadow-lg border-2 ${teamColors.border} mb-4 transform transition-all duration-200 hover:scale-[1.01] hover:shadow-xl`}>
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 bg-white p-2 rounded-full shadow-sm border">
                        <span className="text-xl">{teamColors.icon}</span>
                    </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-3">
                          <h3 className={`font-bold text-lg ${teamColors.titleColor}`}>{messageType}</h3>
                          <span className={`text-sm ${teamColors.timestampText} ${teamColors.timestampBg} px-3 py-1 rounded-full font-semibold shadow-sm`}>
                            {new Date(message.timestamp).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric'
                            })} at {new Date(message.timestamp).toLocaleTimeString('en-US', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        <div className={`${teamColors.textColor} leading-relaxed text-base font-medium whitespace-pre-wrap break-words bg-white bg-opacity-70 p-4 rounded-lg border border-opacity-30`}>
                      {message.responseText || message.message}
                </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              <div ref={messagesEndRef} />
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
                disabled={!newMessage.trim()}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-full flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="hidden sm:inline">Send</span>
                <FaPaperPlane className="h-4 w-4 ml-0 sm:ml-2" />
              </button>
            </div>
          </div>
              </div>
      )}

      {/* Action Modal */}
      {showActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold mb-4 text-black">
              {actionType === 'approve' && 'Approve Query'}
              {actionType === 'deferral' && 'Deferral Action'}
              {actionType === 'otc' && 'OTC Action'}
              {actionType === 'revert' && 'Revert Query'}
            </h3>
            
            <div className="space-y-4">
              {(actionType === 'deferral' || actionType === 'otc') && (
                <div>
                  <label className="block text-sm font-bold text-black">Name</label>
                  <select
                    value={selectedPerson}
                    onChange={(e) => setSelectedPerson(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-3 text-black bg-white border-2 border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md font-bold"
                    style={{ color: '#000000', backgroundColor: '#ffffff', fontWeight: '700' }}
                  >
                    <option value="">Select a person</option>
                    {availablePeople.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-bold text-black">Remarks</label>
                <textarea
                  value={actionRemarks}
                  onChange={(e) => setActionRemarks(e.target.value)}
                  rows={4} 
                  className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full text-black bg-white border-2 border-gray-300 rounded-md p-3 font-bold"
                  placeholder="Enter your remarks..."
                  style={{ color: '#000000', backgroundColor: '#ffffff', fontWeight: '700' }}
                />
              </div>
              </div>
              
            <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowActionModal(false)}
                className="bg-gray-200 text-black px-4 py-2 rounded-md hover:bg-gray-300 transition-colors font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitAction}
                disabled={actionMutation.isPending}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors font-bold"
              >
                {actionMutation.isPending ? 'Processing...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
