'use client';

import React, { useState } from 'react';
import AdminNavbar from './AdminNavbar';
import UserCreationTab from './UserCreationTab';
import BulkUploadTab from './BulkUploadTab';
import BranchManagementTab from './BranchManagementTab';

type TabType = 'user-management' | 'bulk-upload' | 'branch-management';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState<TabType>('user-management');

  const tabs = [
    { id: 'user-management', label: 'User Management', icon: '👤' },
    { id: 'bulk-upload', label: 'Bulk Upload', icon: '📄' },
    { id: 'branch-management', label: 'Branch Management', icon: '🏢' },
  ];

  return (
    <div className="bg-slate-100 min-h-screen">
      <AdminNavbar />
      
      <div className="w-full max-w-6xl mx-auto my-4 sm:my-8 px-4">
        {/* Header */}
        <header className="bg-white p-4 sm:p-6 border-b border-gray-200 rounded-t-2xl shadow-sm">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Control Panel</h1>
          <p className="text-sm text-gray-500 mt-1">Manage users, permissions, and data uploads.</p>
        </header>

        <main className="p-4 sm:p-6 md:p-8 bg-white rounded-b-2xl shadow-lg">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 ${
                    activeTab === tab.id
                      ? 'border-cyan-600 text-cyan-600 font-semibold'
                      : 'border-transparent text-gray-500 hover:text-cyan-600 hover:border-cyan-300'
                  }`}
                >
                  <span className="hidden sm:inline mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="min-h-[600px]">
            {activeTab === 'user-management' && <UserCreationTab />}
            {activeTab === 'bulk-upload' && <BulkUploadTab />}
            {activeTab === 'branch-management' && <BranchManagementTab />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard; 