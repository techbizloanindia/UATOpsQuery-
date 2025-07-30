'use client';

import React from 'react';
import { TabType } from './OperationsDashboard';

interface TabNavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs = [
    { 
      id: 'query-raised' as TabType, 
      name: 'Query Raised', 
      description: 'Pending queries requiring attention'
    },
    { 
      id: 'query-resolved' as TabType, 
      name: 'Query Resolved', 
      description: 'Completed and resolved queries'
    },
    { 
      id: 'sanctioned-cases' as TabType, 
      name: 'Sanctioned Cases', 
      description: 'Approved loan applications'
    },
    { 
      id: 'add-query' as TabType, 
      name: 'Add Query', 
      description: 'Raise new queries'
    },
    { 
      id: 'reports' as TabType, 
      name: 'Reports', 
      description: 'Query status reports and analytics'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1">
      <nav className="flex space-x-1" aria-label="Tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex-1 text-center py-3 px-4 text-sm font-medium rounded-md transition-all duration-200
              ${activeTab === tab.id
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }
            `}
            aria-current={activeTab === tab.id ? 'page' : undefined}
            title={tab.description}
          >
            {tab.name}
          </button>
        ))}
      </nav>
    </div>
  );
}
