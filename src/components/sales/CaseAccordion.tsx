'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FaChevronDown, FaFileAlt, FaClock, FaUser, FaMapMarkerAlt, FaEye, FaArrowRight } from 'react-icons/fa';
import Link from 'next/link';
import QueryItem from './QueryItem';
import { Query, ChatMessage, TeamType } from '@/types/shared';

interface CaseAccordionProps {
  caseId: string;
  customerName: string;
  branch: string;
  queries: Query[];
}

const CaseAccordion = ({ caseId, customerName, branch, queries: initialQueries }: CaseAccordionProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [queries, setQueries] = useState<Query[]>(initialQueries);
  const contentRef = useRef<HTMLDivElement>(null);

  const toggleAccordion = () => {
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (contentRef.current) {
      if (isOpen) {
        contentRef.current.style.maxHeight = `${contentRef.current.scrollHeight}px`;
      } else {
        contentRef.current.style.maxHeight = '0';
      }
    }
  }, [isOpen, queries]);

  // Get query count and status info
  const totalQueries = queries.length;
  const enabledQueries = queries.filter(q => q.allowMessaging && (q.markedForTeam === 'sales' || q.markedForTeam === 'both')).length;
  const pendingQueries = queries.filter(q => q.status === 'pending').length;
  const resolvedQueries = totalQueries - pendingQueries;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex justify-between items-center p-4 text-left hover:bg-gray-50 rounded-t-lg transition-colors">
      <button 
          className="flex-1 flex items-center gap-4 text-left"
        onClick={toggleAccordion}
      >
          <div className="flex items-center gap-2">
            <FaFileAlt className="text-blue-500" />
            <Link 
              href={`/query-details/${caseId}`}
              className="font-bold text-lg text-blue-600 tracking-wide hover:underline flex items-center gap-1"
            >
              {caseId}
              <FaArrowRight className="text-xs ml-1" />
            </Link>
          </div>
          
          {/* Customer Info */}
          <div className="flex items-center gap-2 text-gray-600">
            <FaUser className="text-gray-400 text-sm" />
            <span className="text-sm font-medium">{customerName}</span>
          </div>
          
          {/* Branch */}
          <div className="flex items-center gap-2">
            <FaMapMarkerAlt className="text-gray-400 text-sm" />
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded-full">
              {branch}
            </span>
          </div>
        </button>
        
        {/* Query Count and Status */}
        <div className="flex items-center gap-3">
          {totalQueries > 0 && (
            <div className="flex items-center gap-2">
              <div className="bg-indigo-100 text-indigo-800 text-sm font-semibold px-3 py-1 rounded-full flex items-center gap-1">
                <span>{totalQueries}</span>
                <span className="text-xs">{totalQueries === 1 ? 'Query' : 'Queries'}</span>
              </div>
              
              {pendingQueries > 0 && (
                <div className="bg-orange-100 text-orange-800 text-xs font-medium px-2 py-1 rounded-full flex items-center gap-1">
                  <FaClock className="text-xs" />
                  <span>{pendingQueries} Pending</span>
                </div>
              )}
              
              {resolvedQueries > 0 && (
                <div className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                  <span>{resolvedQueries} Resolved</span>
                </div>
              )}
            </div>
          )}
          
          <Link
            href={`/query-details/${caseId}`}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1 text-sm mr-3"
          >
            <FaEye className="text-xs" />
            View All
          </Link>
          
          <button onClick={toggleAccordion} className="p-1">
          <FaChevronDown className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} text-gray-400`} />
          </button>
        </div>
      </div>
      
      <div 
        ref={contentRef} 
        className="accordion-content overflow-hidden transition-all duration-300"
        style={{ maxHeight: isOpen ? 'none' : '0' }}
      >
        <div className="border-t border-gray-200">
          {queries.length > 0 ? (
            <div className="p-4 space-y-3">
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Queries for {caseId}
                </h4>
                <div className="text-xs text-gray-500">
                  Click on individual queries to view messages and respond
                </div>
              </div>
              
              {queries.map((query, index) => (
                <div key={query.id} className="border-l-4 border-blue-200 pl-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-500">
                          Query #{index + 1}
                        </span>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-500">
                          TAT: {query.tat}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                        query.status === 'pending' 
                          ? 'bg-yellow-100 text-yellow-800' 
                          : query.status === 'resolved'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {query.status.charAt(0).toUpperCase() + query.status.slice(1)}
                      </span>
                    </div>
                  </div>
                  
                  <QueryItem
                    queryId={query.id}
                    title={query.title}
                    tat={query.tat}
                    team={query.team}
                    messages={query.messages}
                    markedForTeam={query.markedForTeam}
                    allowMessaging={query.allowMessaging}
                    priority={query.priority}
                    status={query.status}
                    customerName={query.customerName}
                    caseId={query.caseId}
                    createdAt={query.createdAt}
                    appNo={caseId}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No queries available for this application.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseAccordion; 