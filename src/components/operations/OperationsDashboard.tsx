/**
 * OpsQuery - Real-time Query Management System
 * Copyright (c) 2024 OpsQuery Development Team
 * 
 * Licensed under the MIT License.
 * 
 * @fileoverview Operations Dashboard - Main interface for Operations team
 * @author OpsQuery Development Team
 * @version 2.0.0
 */

'use client';

import React, { useState, useEffect } from 'react';
import TabNavigation from './TabNavigation';
import QueryRaised from './QueryRaised';
import QueryResolved from './QueryResolved';
import SanctionedCases from './SanctionedCases';
import AddQuery from './AddQuery';
import QueryReports from './QueryReports';
import OperationsHeader from './OperationsHeader';

export type TabType = 'query-raised' | 'query-resolved' | 'sanctioned-cases' | 'add-query' | 'reports';

export default function OperationsDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('query-raised');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [newQueriesCount, setNewQueriesCount] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedAppNo, setSelectedAppNo] = useState<string>('');

  // Fetch query statistics for real-time updates
  const fetchQueryStats = async () => {
    try {
      const response = await fetch('/api/queries?stats=true');
      const result = await response.json();
      
      if (result.success) {
        setNewQueriesCount(result.data.pending || 0);
      }
    } catch (error) {
      console.error('Error fetching query stats:', error);
    }
  };

  // Initial load
  useEffect(() => {
    fetchQueryStats();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setRefreshTrigger(prev => prev + 1);
    setLastRefreshed(new Date());
    
    // Fetch latest stats
    await fetchQueryStats();
    
    // Small delay to show refresh state
    setTimeout(() => {
      setIsRefreshing(false);
    }, 500);
  };


  const handleRaiseQuery = (appNo: string) => {
    // Switch to add-query tab with the appNo pre-filled
    setSelectedAppNo(appNo);
    setActiveTab('add-query');
  };

  const handleTabChange = (tab: TabType) => {
    // Clear selectedAppNo when switching away from add-query tab
    if (tab !== 'add-query') {
      setSelectedAppNo('');
    }
    setActiveTab(tab);
  };

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'query-raised':
        return <QueryRaised key={refreshTrigger} />;
      case 'query-resolved':
        return <QueryResolved key={refreshTrigger} />;
      case 'sanctioned-cases':
        return <SanctionedCases key={refreshTrigger} onRaiseQuery={handleRaiseQuery} />;
      case 'add-query':
        return <AddQuery key={refreshTrigger} appNo={selectedAppNo} />;
      case 'reports':
        return <QueryReports key={refreshTrigger} />;
      default:
        return <QueryRaised key={refreshTrigger} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
          <OperationsHeader 
        onRefresh={handleRefresh}
            lastRefreshed={lastRefreshed}
        newQueriesCount={newQueriesCount}
          />
          
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <TabNavigation 
              activeTab={activeTab} 
          onTabChange={handleTabChange}
        />
        
        <div className="mt-6">
          {renderActiveTab()}
        </div>
      </div>
    </div>
  );
}
