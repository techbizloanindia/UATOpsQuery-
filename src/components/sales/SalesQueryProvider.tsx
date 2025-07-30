'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

export function SalesQueryProvider({ children }: { children: React.ReactNode }) {
  // Create a new QueryClient instance for each session
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60000, // 1 minute
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  }));

  // State for queries and messages
  const [queries, setQueries] = useState<any[]>([]);
  const [messages, setMessages] = useState<{ [key: string]: any[] }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch queries at regular intervals for real-time updates
  useEffect(() => {
    // Initial fetch
    fetchQueries();
    
    // Set up interval for real-time updates
    const intervalId = setInterval(() => {
      fetchQueries();
    }, 15000); // Refresh every 15 seconds
    
    // Clean up on unmount
    return () => clearInterval(intervalId);
  }, []);

  // Fetch queries function
  const fetchQueries = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/queries?team=Sales&status=pending');
      const data = await response.json();
      
      if (data.success) {
        const formattedQueries = data.data.map((query: any) => ({
          id: query.id.toString(),
          queryId: query.id.toString(),
          title: `Query for ${query.appNo}`,
          tat: '24 hours',
          team: 'Sales',
          messages: [], // Will be populated separately
          markedForTeam: query.sendToSales ? 'sales' : '',
          allowMessaging: query.sendToSales,
          priority: 'medium',
          status: query.status,
          customerName: query.customerName,
          caseId: query.branch,
          createdAt: query.submittedAt,
          appNo: query.appNo
        }));
        
        setQueries(formattedQueries);
        
        // Fetch messages for each query
        formattedQueries.forEach((query: { id: string }) => {
          fetchMessages(query.id);
        });
      } else {
        setError(data.error || 'Failed to fetch queries');
      }
    } catch (error) {
      console.error('Error fetching queries:', error);
      setError('Failed to fetch queries');
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages for a specific query
  const fetchMessages = async (queryId: string) => {
    try {
      const response = await fetch(`/api/query-actions?queryId=${queryId}&type=messages`);
      const data = await response.json();
      
      if (data.success) {
        setMessages(prev => ({
          ...prev,
          [queryId]: data.data.map((msg: any) => ({
            id: msg.id.toString(),
            sender: msg.sender,
            team: msg.senderRole.charAt(0).toUpperCase() + msg.senderRole.slice(1),
            text: msg.message,
            timestamp: msg.timestamp
          }))
        }));
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  return (
    <ProtectedRoute allowedRoles={['sales']}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ProtectedRoute>
  );
} 