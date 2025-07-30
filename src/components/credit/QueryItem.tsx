'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FaReply, FaPaperPlane, FaClock, FaUser, FaSync, FaComments, FaCalendarAlt, FaHistory } from 'react-icons/fa';
import { ChatMessage, TeamType } from '@/types/shared';
import { useRouter } from 'next/navigation';
import QueryReplyModal from '@/components/shared/QueryReplyModal';
import QueryChatModal from '../shared/QueryChatModal';
import { useAuth } from '@/contexts/AuthContext';

interface QueryItemProps {
  queryId: string;
  title: string;
  tat: string;
  team?: TeamType;
  messages: ChatMessage[];
  markedForTeam?: TeamType;
  allowMessaging?: boolean;
  priority?: 'high' | 'medium' | 'low';
  status: 'pending' | 'resolved' | 'in_progress';
  customerName?: string;
  caseId?: string;
  createdAt?: string;
  appNo: string;
}

interface QueryResponse {
  queryId: string;
  appNo: string;
  responseText: string;
  team: string;
  respondedBy: string;
  timestamp: string;
}

const QueryItem: React.FC<QueryItemProps> = ({
  queryId,
  title,
  tat,
  team,
  messages,
  markedForTeam,
  allowMessaging,
  priority,
  status,
  customerName,
  caseId,
  createdAt,
  appNo
}) => {
  const [responseText, setResponseText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  
  // Use this state for the chat modal
  const [showQueryChat, setShowQueryChat] = useState(false);
  
  const queryClient = useQueryClient();
  const router = useRouter();
  const { user } = useAuth();

  const handleQueryClick = () => {
    // Open the new chat modal instead of navigating
    setShowQueryChat(true);
  };

  // Submit response mutation
  const submitResponseMutation = useMutation({
    mutationFn: async (response: QueryResponse) => {
      const res = await fetch('/api/query-responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...response,
          timestamp: new Date().toISOString()
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit response');
      }
      
      return data;
    },
    onSuccess: (data) => {
      setResponseText('');
      setIsSubmitting(false);
      // Invalidate and refetch queries to show real-time updates
      queryClient.invalidateQueries({ queryKey: ['creditQueries'] });
      queryClient.invalidateQueries({ queryKey: ['salesQueries'] });
      queryClient.invalidateQueries({ queryKey: ['pendingQueries'] });
      queryClient.invalidateQueries({ queryKey: ['teamResponses'] });
      queryClient.invalidateQueries({ queryKey: ['chatMessages'] });
      
      // Show success message
      alert(data.message || 'Response submitted successfully! Operations team will see this in real-time.');
    },
    onError: (error: Error) => {
      setIsSubmitting(false);
      console.error('Error submitting response:', error);
      
      // Show specific error message based on the type of error
      if (error.message.includes('Unauthorized')) {
        alert('❌ Unauthorized Access: You cannot respond to this query as it is not marked for the Credit team. Contact Operations if you believe this is an error.');
      } else if (error.message.includes('Cannot respond')) {
        alert('❌ Query Status Error: This query is no longer accepting responses as it has been resolved or closed.');
      } else {
        alert(`❌ Error: ${error.message}`);
      }
    }
  });

  const handleSubmitResponse = () => {
    if (!responseText.trim()) {
      alert('Please enter a response');
      return;
    }

    setIsSubmitting(true);
    
    const response: QueryResponse = {
      queryId,
      appNo,
      responseText: responseText.trim(),
      team: user?.role || 'Credit',
      respondedBy: user?.name || 'Credit Team Member',
      timestamp: new Date().toISOString()
    };

    submitResponseMutation.mutate(response);
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      if (!dateString) return 'No date';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid date';
      
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (e) {
      return 'Invalid date';
    }
  };

  const getTimeAgo = (dateString: string) => {
    try {
      if (!dateString) return 'Unknown time';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Unknown time';
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
      } else if (diffHours < 24) {
        return `${diffHours}h ago`;
      } else {
        return `${diffDays}d ago`;
      }
    } catch (e) {
      return 'Unknown time';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-orange-100 text-orange-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
      {/* Query Chat Modal */}
      <QueryChatModal
        queryId={queryId}
        appNo={appNo}
        customerName={customerName || 'Unknown Customer'}
        isOpen={showQueryChat}
        onClose={() => setShowQueryChat(false)}
        title={title}
        branch={caseId}
        createdAt={createdAt}
        status={status}
      />
      
      <div className="p-4 cursor-pointer">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(priority)}`}>
                {priority ? priority.charAt(0).toUpperCase() + priority.slice(1) : 'Normal'}
              </span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FaClock />
              <span>TAT: {tat}</span>
              <span className="mx-2">•</span>
              <FaCalendarAlt />
              <span>Created: {formatDateTime(createdAt || '')}</span>
          </div>
        </div>
      </div>

        <div className="mt-4 pt-3 border-t border-gray-200 flex justify-end">
                  <button
            onClick={() => setShowQueryChat(true)}
            className="px-4 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 shadow-sm"
          >
            <FaHistory />
            View Complete Chat History
                  </button>
                </div>
              </div>

      {/* Enhanced Reply Modal */}
      <QueryReplyModal
        queryId={queryId}
        appNo={appNo}
        customerName={customerName || 'Unknown Customer'}
        isOpen={showReplyModal}
        onClose={() => setShowReplyModal(false)}
        team="Credit"
        markedForTeam={markedForTeam}
        allowMessaging={allowMessaging}
      />
    </div>
  );
};

export default QueryItem; 