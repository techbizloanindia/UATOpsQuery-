'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FaSearch, FaSpinner, FaExclamationCircle, FaUser, FaEnvelope, FaBuilding, FaCalendarAlt, FaTimes, FaPlus, FaCheckCircle, FaPaperPlane, FaChevronDown } from 'react-icons/fa';
import EmptyState from './EmptyState';
import { useAuth } from '@/contexts/AuthContext';

interface AddQueryProps {
  appNo?: string;
}

interface ApplicationDetails {
  appNo: string;            // App.No
  customerName: string;     // Name
  branchName: string;       // BranchName
  taskName: string;         // TaskName
  appliedDate: string;      // AppDate
  loanNo: string;          // LoanNo
  loanAmount: string;       // Amount
  customerEmail: string;    // Email
  login: string;           // Login
  assetType: string;       // Asset Type
  sanctionedAmount: string; // Sanction Amount
  
  // Additional fields for compatibility
  status: string;
  customerPhone: string;
  address: string;
  pincode: string;
  city: string;
  state: string;
  employeeId: string;
  loanType: string;
  lastUpdated: string;
  sanctionedDate?: string;
  tenure: string;
  interestRate: string;
  processingFee: string;
  cibilScore: number | string;
  monthlyIncome: string;
  companyName: string;
  designation: string;
  workExperience: string;
  priority?: string;
  documentStatus?: string;
  remarks?: string;
}

interface QueryItem {
  id: number;
  text: string;
  isCustom?: boolean;
  team?: 'Sales' | 'Credit' | 'Custom'; // Track which team this query belongs to
}

// Search for application
const searchApplication = async (appNo: string): Promise<ApplicationDetails | null> => {
  try {
    console.log(`🔍 Frontend: Searching for application: "${appNo}"`);
    const response = await fetch(`/api/applications/${appNo}`);
    const result = await response.json();
    
    if (!response.ok || !result.success) {
      console.log('❌ Frontend: Search failed:', result);
      
      // Enhanced error message with suggestions
      let errorMessage = result.error || 'Failed to find application';
      
      if (result.suggestion) {
        errorMessage += `\n\n💡 Suggestion: ${result.suggestion}`;
      }
      

      
      throw new Error(errorMessage);
    }
    
    console.log(`✅ Frontend: Found application:`, result.data.appNo);
    return result.data;
  } catch (error) {
    console.error('💥 Frontend: Error searching for application:', error);
    return null;
  }
};

// Submit query
const submitQuery = async (data: {
  appNo: string;
  queries: string[];
  sendTo: string;
}): Promise<any> => {
  try {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      throw new Error('Cannot submit query: Not in browser environment');
    }

    // Validate input data
    if (!data.appNo || !data.queries || data.queries.length === 0 || !data.sendTo) {
      throw new Error('Missing required fields: appNo, queries, or sendTo');
    }

    console.log('🚀 Submitting query with data:', data);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch('/api/queries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP Error: ${response.status} ${response.statusText}`;
        try {
          const result = await response.json();
          errorMessage = result.error || errorMessage;
        } catch (parseError) {
          console.warn('Failed to parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      console.log('✅ Query submitted successfully:', result);
      return result;

    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timed out. Please check your internet connection and try again.');
      }
      
      if (fetchError instanceof TypeError && fetchError.message.includes('fetch')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      
      throw fetchError;
    }
  } catch (error: any) {
    console.error('💥 Error submitting query:', error);
    // Re-throw with a user-friendly message
    const userMessage = error.message || 'Failed to submit query. Please try again.';
    throw new Error(userMessage);
  }
};

export default function AddQuery({ appNo = '' }: AddQueryProps) {
  const [searchTerm, setSearchTerm] = useState(appNo);
  const [queries, setQueries] = useState<QueryItem[]>([{ id: 1, text: '' }]);
  const [sendTo, setSendTo] = useState<string[]>(['Sales']);
  const [searchResult, setSearchResult] = useState<ApplicationDetails | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showBothTeams, setShowBothTeams] = useState(false);
  const [isQueryDropdownOpen, setIsQueryDropdownOpen] = useState<{[key: number]: boolean}>({});
  const [querySubmitted, setQuerySubmitted] = useState(false);
  const [showCustomMessage, setShowCustomMessage] = useState(false);
  const [customQueryId, setCustomQueryId] = useState<number | null>(null);
  const [customQueryTeam, setCustomQueryTeam] = useState<'Sales' | 'Credit' | 'Both'>('Sales');
  
  // Keyboard navigation state
  const [focusedItemIndex, setFocusedItemIndex] = useState<{[key: number]: number}>({});
  const [allDropdownItems, setAllDropdownItems] = useState<{[key: number]: any[]}>({});
  
  // Get user information from auth context
  const { user } = useAuth();
  
  const queryClient = useQueryClient();
  
  // Available teams
  const availableTeams = [
    { id: 'Sales', label: '🏢 Sales Team', color: 'bg-blue-50 hover:bg-blue-100' },
    { id: 'Credit', label: '💳 Credit Team', color: 'bg-green-50 hover:bg-green-100' },
    { id: 'Both', label: '🔄 Both Teams', color: 'bg-purple-50 hover:bg-purple-100' },
  ];

  // Predefined query options based on team
  const salesQueries = [
    "Application form missing / Incomplete filled / Photo missing / Sign missing / Cross sign missing in Photo",
    "KYC missing / Self Astled missing / OSV missing / Clear image missing",
    "Signature, Any change related to rate, tenure, roi , insurance, sanction condition, Applicant & co-applicant details mismatch",
    "Borrower & Co Borrower Details missing , Borrower declaration form missing / RM Details & Sign missing",
    "Property onwer details missing / Sign missing / Descreption of property missing",
    "Declarant details wrong mentioned / declarant sign wrong place",
    "Details wrong mentioned / Signing issue",
    "Complete login details reqd / Login fee missing / Cheque & Online Payment image missing",
    "As per sanction another person cheque / Signning issues / Favour wrong / Favour missing / SDPC missing / if Mandate Done 5 SPDC",
    "As per sanction another person cheque / Signning issues / Favour wrong / Favour missing / SDPC missing / As per policy all Co Appl 3 PDC",
    "Nach form wrong place / wrong details mentioned / As per sanction another person cheque",
    "Insured person Sign missing, wrong place sign / Declarnt sign missing / Declarant KYC missing",
    "Insured person Sign missing, wrong place sign / Insurance form missing",
    "Property onwer details mismatch / Date issue / Product Name mismatch",
    "Signature Missing, Bank Account Missing, Repayment Change",
    "Gaurantor details missing / Sign missing / Photo missing",
    "A/C details wrong / Sign missing / Bank Stamp missing",
    "Repayment A/c Banking"
  ];

  const creditQueries = [
    "Applicant & Co Applicant details missing & Wrong / condition mismatch / ROI & Tenure & Processing Fee & Insurance etc",
    "Resi & Office FI missing / Negative & refer",
    "A/C details wrong / Refer & Fake",
    "Sign missing / Property details wrong / Product mismatch / Property value issue",
    "Cibil & Crime report missing",
    "Property owner details mismatch / Date issue / Product Name mismatch & Sreach report issue / Document missing as per Legal",
    "Credit Condition vetting issue / Condition mismatch cam & sanction"
  ];

  // Get available query options based on selected team
  const getAvailableQueries = () => {
    if (showBothTeams) {
      // When both teams are selected, show all queries with team labels
      return [
        ...salesQueries.map(q => ({ query: q, team: 'Sales', teamColor: 'blue' })),
        ...creditQueries.map(q => ({ query: q, team: 'Credit', teamColor: 'green' })),
        { query: "Other", team: 'Custom', teamColor: 'orange' }
      ];
    } else if (sendTo.includes('Sales')) {
      return salesQueries.map(q => ({ query: q, team: 'Sales', teamColor: 'blue' })).concat([{ query: "Other", team: 'Sales', teamColor: 'blue' }]);
    } else if (sendTo.includes('Credit')) {
      return creditQueries.map(q => ({ query: q, team: 'Credit', teamColor: 'green' })).concat([{ query: "Other", team: 'Credit', teamColor: 'green' }]);
    }
    return [{ query: "Other", team: 'Both', teamColor: 'gray' }];
  };

  // Auto-search when appNo prop changes (from "Raise Query" button click)
  useEffect(() => {
    if (appNo && appNo !== searchTerm) {
      // Enhanced cleaning for auto-search from "Raise Query" button
      const cleanAppNo = appNo
        .trim()                          // Remove leading/trailing spaces
        .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
        .toUpperCase();                 // Convert to uppercase for consistency
      
      console.log(`🔍 Frontend: Auto-search normalized: "${appNo}" → "${cleanAppNo}"`);
      
      setSearchTerm(cleanAppNo);
      // Automatically search for the application details
      setIsSearching(true);
      searchMutation.mutate(cleanAppNo);
    }
  }, [appNo]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target as Element).closest('.query-dropdown')) {
        setIsQueryDropdownOpen({});
        setFocusedItemIndex({});
        setAllDropdownItems({});
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);



  // Clear success message after 10 seconds
  useEffect(() => {
    if (querySubmitted) {
      const timer = setTimeout(() => {
        setQuerySubmitted(false);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [querySubmitted]);
  
  // React Query mutation for searching application
  const searchMutation = useMutation({
    mutationFn: searchApplication,
    onSuccess: (data) => {
      if (data) {
        setSearchResult(data);
        setSearchError(null);
      } else {
        setSearchResult(null);
        setSearchError('Application not found');
      }
      setIsSearching(false);
    },
    onError: (error) => {
      setSearchResult(null);
      setSearchError('Error searching for application');
      setIsSearching(false);
    }
  });
  
  // React Query mutation for submitting query with real-time updates
  const submitMutation = useMutation({
    mutationFn: submitQuery,
    onSuccess: (data) => {
      if (data.success) {
        // Reset form
        setQueries([{ id: 1, text: '' }]);
        setQuerySubmitted(true);
        
        // Invalidate and refetch query data for real-time updates across all dashboards
        queryClient.invalidateQueries({ queryKey: ['pendingQueries'] });
        queryClient.invalidateQueries({ queryKey: ['resolvedQueries'] });
        queryClient.invalidateQueries({ queryKey: ['salesQueries'] });
        queryClient.invalidateQueries({ queryKey: ['creditQueries'] });
        queryClient.invalidateQueries({ queryKey: ['chatMessages'] });
        queryClient.invalidateQueries({ queryKey: ['queryActions'] });
        
        // Show success message without alert
        console.log('Query submitted successfully:', data.message);
      } else {
        setSearchError('Failed to submit queries: ' + data.message);
      }
    },
    onError: (error) => {
      setSearchError('Error submitting queries. Please try again.');
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Enhanced cleaning: normalize spaces, trim, and handle various formats
    const cleanSearchTerm = searchTerm
      .trim()                          // Remove leading/trailing spaces
      .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
      .toUpperCase();                 // Convert to uppercase for consistency
    
    if (!cleanSearchTerm) return;
    
    console.log(`🔍 Frontend: Normalized search term: "${searchTerm}" → "${cleanSearchTerm}"`);
    
    setIsSearching(true);
    setQuerySubmitted(false);
    searchMutation.mutate(cleanSearchTerm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchResult || queries.some(q => !q.text.trim())) return;
    
    // Filter out empty queries
    const validQueries = queries.filter(q => q.text.trim().length > 0);
    
    if (validQueries.length === 0) {
      setSearchError('Please enter at least one query');
      return;
    }
    
    // Separate queries by team
    const salesQueries = validQueries.filter(q => 
      q.team === 'Sales' || (!showBothTeams && sendTo.includes('Sales'))
    ).map(q => q.text);
    
    const creditQueries = validQueries.filter(q => 
      q.team === 'Credit' || (!showBothTeams && sendTo.includes('Credit'))
    ).map(q => q.text);
    
    // Custom queries that go to both teams (team === 'Custom')
    const customQueries = validQueries.filter(q => q.team === 'Custom').map(q => q.text);
    
    console.log('📊 Query Distribution:');
    console.log(`🏢 Sales Queries (${salesQueries.length}):`, salesQueries);
    console.log(`💳 Credit Queries (${creditQueries.length}):`, creditQueries);
    console.log(`🖊️ Custom Queries to Both Teams (${customQueries.length}):`, customQueries);
    
    // Prepare submissions based on team selection
    const submissions = [];
    
    if (!showBothTeams) {
      // Single team selected - send all queries to that team
      const targetTeam = sendTo[0];
      const allQueriesText = validQueries.map(q => q.text);
      
      submissions.push({
        appNo: searchResult.appNo,
        queries: allQueriesText,
        sendTo: targetTeam
      });
      
      console.log(`📤 Sending all queries to ${targetTeam} team:`, allQueriesText);
    } else {
      // Both teams selected - route queries to appropriate teams
      if (salesQueries.length > 0) {
        submissions.push({
          appNo: searchResult.appNo,
          queries: salesQueries,
          sendTo: 'Sales'
        });
        console.log(`� Sending to Sales team:`, salesQueries);
      }
      
      if (creditQueries.length > 0) {
        submissions.push({
          appNo: searchResult.appNo,
          queries: creditQueries,
          sendTo: 'Credit'
        });
        console.log(`📤 Sending to Credit team:`, creditQueries);
      }
      
      // Custom queries go to both teams
      if (customQueries.length > 0) {
        submissions.push({
          appNo: searchResult.appNo,
          queries: customQueries,
          sendTo: 'Sales, Credit'
        });
        console.log(`📤 Sending custom queries to both teams:`, customQueries);
      }
    }
    
    // Submit all queries
    if (submissions.length === 0) {
      setSearchError('No valid queries to submit');
      return;
    }
    
    // For multiple submissions, we'll submit them one by one
    // For now, let's combine them for simplicity but this could be enhanced
    if (submissions.length === 1) {
      submitMutation.mutate(submissions[0]);
    } else {
      // Multiple submissions - combine for now but log the separation
      const allQueries = submissions.flatMap(s => s.queries);
      const allTeams = [...new Set(submissions.flatMap(s => s.sendTo.split(', ')))];
      
      submitMutation.mutate({
        appNo: searchResult.appNo,
        queries: allQueries,
        sendTo: allTeams.join(', ')
      });
    }
  };

  const handleQueryChange = (id: number, text: string, isCustom = false, team?: 'Sales' | 'Credit' | 'Custom') => {
    setQueries(prevQueries => 
      prevQueries.map(q => q.id === id ? { ...q, text, isCustom, team } : q)
    );
  };

  // Helper function to determine which team a query belongs to
  const getQueryTeam = (queryText: string) => {
    if (salesQueries.includes(queryText)) return 'Sales';
    if (creditQueries.includes(queryText)) return 'Credit';
    return 'Custom';
  };

  const handleDropdownSelect = (id: number, selectedOption: string) => {
    if (selectedOption === "Other") {
      setCustomQueryId(id);
      setCustomQueryTeam('Sales'); // Reset to default
      setShowCustomMessage(true);
    } else {
      // Determine which team this query belongs to
      const queryTeam = getQueryTeam(selectedOption);
      handleQueryChange(id, selectedOption, false, queryTeam);
    }
    // Close the dropdown
    setIsQueryDropdownOpen(prev => ({ ...prev, [id]: false }));
  };

  const toggleQueryDropdown = (id: number) => {
    setIsQueryDropdownOpen(prev => ({ ...prev, [id]: !prev[id] }));
    
    // Initialize dropdown items and focus when opening
    if (!isQueryDropdownOpen[id]) {
      const items = getDropdownItems();
      setAllDropdownItems(prev => ({ ...prev, [id]: items }));
      setFocusedItemIndex(prev => ({ ...prev, [id]: -1 }));
    }
  };

  // Get all dropdown items for keyboard navigation - Dynamic based on team selection
  const getDropdownItems = () => {
    const items: any[] = [];
    
    if (showBothTeams) {
      // When "Both Teams" is selected, show all queries from both teams
      salesQueries.forEach((query, index) => {
        items.push({ type: 'sales', query, index, team: 'Sales' });
      });
      
      creditQueries.forEach((query, index) => {
        items.push({ type: 'credit', query, index, team: 'Credit' });
      });
    } else {
      // When single team is selected, show only that team's queries
      const availableQueries = getAvailableQueries().filter(option => option.query !== "Other");
      availableQueries.forEach((option, index) => {
        items.push({ type: 'single', query: option.query, index, team: option.team });
      });
    }
    
    // Add "Other" option
    items.push({ type: 'other', query: 'Other', index: items.length, team: 'Custom' });
    
    return items;
  };

  // Handle keyboard navigation
  const handleKeyNavigation = (e: React.KeyboardEvent, queryId: number) => {
    if (!isQueryDropdownOpen[queryId]) return;
    
    const items = allDropdownItems[queryId] || [];
    const currentIndex = focusedItemIndex[queryId] || -1;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        setFocusedItemIndex(prev => ({ ...prev, [queryId]: nextIndex }));
        
        // Scroll focused item into view
        setTimeout(() => {
          const focusedElement = document.querySelector(`[data-dropdown-item="${queryId}-${nextIndex}"]`);
          if (focusedElement) {
            focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }, 0);
        break;
        
      case 'ArrowUp':
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        setFocusedItemIndex(prev => ({ ...prev, [queryId]: prevIndex }));
        
        // Scroll focused item into view
        setTimeout(() => {
          const focusedElement = document.querySelector(`[data-dropdown-item="${queryId}-${prevIndex}"]`);
          if (focusedElement) {
            focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
          }
        }, 0);
        break;
        
      case 'Enter':
        e.preventDefault();
        if (currentIndex >= 0 && items[currentIndex]) {
          handleDropdownSelect(queryId, items[currentIndex].query);
        }
        break;
        
      case 'Escape':
        e.preventDefault();
        setIsQueryDropdownOpen(prev => ({ ...prev, [queryId]: false }));
        setFocusedItemIndex(prev => ({ ...prev, [queryId]: -1 }));
        break;
    }
  };

  const handleCustomMessageSubmit = (customMessage: string) => {
    if (customQueryId !== null) {
      // Map team selection to proper team assignment
      let teamAssignment: 'Sales' | 'Credit' | 'Custom' = 'Custom';
      if (customQueryTeam === 'Sales') {
        teamAssignment = 'Sales';
      } else if (customQueryTeam === 'Credit') {
        teamAssignment = 'Credit';
      } else {
        teamAssignment = 'Custom'; // Both teams
      }
      
      handleQueryChange(customQueryId, customMessage, true, teamAssignment);
      setShowCustomMessage(false);
      setCustomQueryId(null);
      setCustomQueryTeam('Sales'); // Reset to default
    }
  };

  const addQuery = () => {
    const newId = Math.max(0, ...queries.map(q => q.id)) + 1;
    setQueries([...queries, { id: newId, text: '' }]);
  };

  const removeQuery = (id: number) => {
    if (queries.length > 1) {
      setQueries(queries.filter(q => q.id !== id));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'approved':
      case 'sanctioned':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'under processing':
      case 'in progress':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getCibilScoreColor = (score: number) => {
    if (score >= 750) return 'text-green-600';
    if (score >= 650) return 'text-yellow-600';
    return 'text-red-600';
  };

  const handleTeamSelection = (teamId: string) => {
    if (teamId === 'Both') {
      setSendTo(['Sales', 'Credit']);
      setShowBothTeams(true);
    } else {
      setSendTo([teamId]);
      setShowBothTeams(false);
    }
    setIsDropdownOpen(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-6">
      {/* Success Message */}
      {querySubmitted && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-green-50 border-l-4 border-green-500 rounded-lg flex items-center gap-2 sm:gap-3 animate-fadeIn">
          <FaCheckCircle className="text-green-600 text-xl" />
          <div className="flex-1">
            <p className="font-medium text-green-800">Query submitted successfully!</p>
            <p className="text-green-700 text-sm">
              Your query has been sent to {sendTo.join(' and ')} team{sendTo.length > 1 ? 's' : ''} in real-time.
            </p>
          </div>
        </div>
      )}

      <div className="mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <FaSearch className="text-cyan-600" />
            <span>Search Sanctioned Case by App.No</span>
          </div>
          {appNo && (
            <span className="text-xs sm:text-sm bg-cyan-100 text-cyan-800 px-2 sm:px-3 py-1 rounded-full font-medium">
              Auto-loaded: {appNo}
            </span>
          )}
        </h2>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Enter App.No (e.g., GGNP001, APP123)"
              className="w-full p-3 sm:p-4 pl-10 sm:pl-12 border-2 border-gray-300 rounded-xl text-black text-base sm:text-lg focus:border-cyan-500 focus:outline-none transition-colors font-bold bg-white"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ color: '#000000', backgroundColor: '#ffffff', fontWeight: '700' }}
            />
            <FaSearch className="absolute left-3 sm:left-4 top-4 sm:top-5 text-gray-400 text-sm sm:text-base" />
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchTerm.trim()}
            className="w-full sm:w-auto bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2 font-semibold text-sm sm:text-base"
          >
            {isSearching ? (
              <>
                <FaSpinner className="animate-spin" />
                Searching...
              </>
            ) : (
              <>
                <FaSearch />
                Search
              </>
            )}
          </button>
        </form>
        
        {searchError && (
          <div className="mt-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-lg">
            <div className="flex items-start gap-3">
              <FaExclamationCircle className="text-red-500 mt-1 flex-shrink-0" />
              <div className="font-medium">
                <div className="mb-2">Application Search Failed</div>
                <pre className="whitespace-pre-wrap text-sm font-normal">{searchError}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {searchResult ? (
        <div className="space-y-8">
          {/* Application Details */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-500 p-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <FaBuilding />
                Application Details
              </h3>
              <p className="text-blue-100 text-sm">
                Showing details for App.No: {searchResult.appNo}
              </p>
            </div>
            
            <div className="p-4 sm:p-6">
              {/* Header Info */}
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 pb-4 border-b border-gray-200">
                <div>
                  <h4 className="text-xl font-bold text-gray-900">{searchResult.customerName}</h4>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(searchResult.status)}`}>
                      {searchResult.status}
                    </span>
                    {searchResult.priority && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        searchResult.priority === 'high' ? 'bg-red-100 text-red-800' :
                        searchResult.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {searchResult.priority.toUpperCase()} PRIORITY
                      </span>
                    )}
                    <span className="text-gray-600">
                      Applied: {searchResult.appliedDate}
                    </span>
                  </div>
                </div>
                <div className="mt-4 md:mt-0">
                  <div className="text-right">
                    <span className="text-gray-600">Loan Amount:</span>
                    <p className="text-xl font-bold text-gray-900">
                      {searchResult.loanAmount !== 'Not specified' ? `₹${searchResult.loanAmount}` : searchResult.loanAmount}
                    </p>
                  </div>
                  {searchResult.sanctionedAmount && searchResult.sanctionedAmount !== 'Same as loan amount' && (
                    <div className="text-right mt-1">
                      <span className="text-gray-600">Sanctioned:</span>
                      <p className="text-lg font-semibold text-green-600">₹{searchResult.sanctionedAmount}</p>
                    </div>
                  )}
                  {searchResult.sanctionedDate && (
                    <div className="text-right mt-1">
                      <span className="text-gray-600 text-sm">Sanctioned on:</span>
                      <p className="text-sm text-gray-700">{searchResult.sanctionedDate}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Enhanced Details Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                {/* Loan Information */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 sm:p-6 rounded-xl border border-blue-100">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="bg-blue-500 p-1.5 sm:p-2 rounded-lg">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                      </svg>
                    </div>
                    <h5 className="text-base sm:text-lg font-bold text-blue-900">🏦 Loan Information</h5>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="bg-white p-3 sm:p-4 rounded-lg border border-blue-200">
                      <div className="flex justify-between items-center">
                        <span className="text-xs sm:text-sm font-medium text-blue-700">Loan Amount</span>
                        <span className="text-lg sm:text-xl font-bold text-blue-900">
                          {searchResult.loanAmount !== 'Not specified' ? `₹${searchResult.loanAmount}` : searchResult.loanAmount}
                        </span>
                      </div>
                    </div>
                    <div className="bg-white p-3 sm:p-4 rounded-lg border border-green-200">
                      <div className="flex justify-between items-center">
                        <span className="text-xs sm:text-sm font-medium text-green-700">Sanction Amount</span>
                        <span className="text-lg sm:text-xl font-bold text-green-700">
                          {searchResult.sanctionedAmount !== 'Same as loan amount' ? `₹${searchResult.sanctionedAmount}` : searchResult.sanctionedAmount}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Contact & Branch Information */}
                <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 sm:p-6 rounded-xl border border-purple-100">
                  <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                    <div className="bg-purple-500 p-1.5 sm:p-2 rounded-lg">
                      <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <h5 className="text-base sm:text-lg font-bold text-purple-900">📞 Contact & Branch</h5>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    <div className="bg-white p-3 sm:p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <FaEnvelope className="text-purple-500 text-sm sm:text-base" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-medium text-purple-700">Email Address</p>
                          <p className="font-semibold text-purple-900 text-sm sm:text-base truncate">{searchResult.customerEmail}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white p-3 sm:p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <FaBuilding className="text-purple-500 text-sm sm:text-base" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-medium text-purple-700">Branch Name</p>
                          <p className="font-semibold text-purple-900 text-sm sm:text-base">{searchResult.branchName}</p>
                        </div>
                      </div>
                    </div>
                    <div className="bg-white p-3 sm:p-4 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-3">
                        <FaCalendarAlt className="text-purple-500" />
                        <div>
                          <p className="text-sm font-medium text-purple-700">Application Date</p>
                          <p className="font-semibold text-purple-900">{searchResult.appliedDate}</p>
                        </div>
                      </div>
                    </div>
                    {searchResult.login && searchResult.login !== 'Not provided' && (
                      <div className="bg-white p-4 rounded-lg border border-purple-200">
                        <div className="flex items-center gap-3">
                          <FaUser className="text-purple-500" />
                          <div>
                            <p className="text-sm font-medium text-purple-700">Employee Login</p>
                            <p className="font-semibold text-purple-900">{searchResult.login}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              {(searchResult.documentStatus || searchResult.remarks) && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h5 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Additional Information</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {searchResult.documentStatus && (
                      <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                        <p className="text-sm text-green-700 font-medium">Document Status</p>
                        <p className="text-green-900">{searchResult.documentStatus}</p>
                      </div>
                    )}
                    {searchResult.remarks && (
                      <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-700 font-medium">Remarks</p>
                        <p className="text-blue-900 text-sm">{searchResult.remarks}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Add Query Form */}
          <div className="bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
            <div className="bg-purple-600 p-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <FaPlus />
                Add New Query - Real-time Submission
              </h3>
              <p className="text-purple-100 text-sm mt-1">
                Queries will be sent instantly to selected teams and appear in their dashboard immediately
              </p>
            </div>
            
            <div className="p-4 sm:p-6">
              {/* Team Selection - Simplified */}
              <div className="mb-4 sm:mb-6 bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-200">
                <label className="block text-gray-700 font-bold mb-2 text-sm sm:text-base">Send To (Real-time):</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full flex items-center justify-between gap-2 p-2 sm:p-3 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 transition-colors text-sm sm:text-base"
                  >
                    <span>
                      {showBothTeams ? (
                        <span className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                          <span className="w-3 h-3 rounded-full bg-green-500"></span>
                          Both Teams
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${
                            sendTo.includes('Sales') ? 'bg-blue-500' : 'bg-green-500'
                          }`}></span>
                          {sendTo[0]} Team
                        </span>
                      )}
                    </span>
                    <FaChevronDown className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isDropdownOpen && (
                    <div className="absolute z-10 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
                      {availableTeams.map((team) => (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => handleTeamSelection(team.id)}
                          className={`w-full text-left px-3 sm:px-4 py-2 sm:py-3 hover:bg-gray-50 transition-colors flex items-center gap-2 sm:gap-3 text-sm sm:text-base ${
                            (team.id === 'Both' && showBothTeams) || 
                            (team.id !== 'Both' && !showBothTeams && sendTo.includes(team.id))
                              ? 'bg-blue-50'
                              : ''
                          }`}
                        >
                          <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${team.color} text-xs sm:text-sm`}>
                            {team.label.split(' ')[0]}
                          </div>
                          <span className="flex-1">{team.label.split(' ').slice(1).join(' ')}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Dynamic Query Behavior Info */}
              <div className="mb-4 p-3 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-700 flex items-center gap-2">
                  <span className="text-blue-500">💡</span>
                  <span className="font-medium">Query Dropdown Behavior:</span>
                </p>
                <p className="text-xs text-gray-600 mt-1 ml-6">
                  {showBothTeams ? (
                    <>• <strong>Both Teams Selected:</strong> Dropdown shows Sales & Credit queries in columns</>
                  ) : (
                    <>• <strong>{sendTo[0]} Team Selected:</strong> Dropdown shows only {sendTo[0]} team queries</>
                  )}
                </p>
              </div>
              
              <div className="mb-4 sm:mb-6">
                <label className="block text-gray-700 font-bold mb-2 text-sm sm:text-base">Query Details:</label>
                <div className="space-y-3 sm:space-y-4">
                  {queries.map((query, index) => (
                    <div key={query.id} className="space-y-2 sm:space-y-3">
                      {/* Dropdown for predefined options */}
                      <div className="flex gap-3 items-start">
                        <div className="flex-1">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-600 mb-1">
                            <span>Select from predefined options:</span>
                            {!showBothTeams && (
                              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                sendTo[0] === 'Sales' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                              }`}>
                                {sendTo[0] === 'Sales' ? '🏢 Sales Queries Only' : '💳 Credit Queries Only'}
                              </span>
                            )}
                            {showBothTeams && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r from-blue-100 to-green-100 text-gray-800">
                                � All Team Queries with Indicators
                              </span>
                            )}
                          </label>
                          {/* Custom Column-wise Dropdown */}
                          <div className="relative query-dropdown">
                            <button
                              type="button"
                              onClick={() => toggleQueryDropdown(query.id)}
                              onKeyDown={(e) => handleKeyNavigation(e, query.id)}
                              className="w-full p-2 sm:p-3 border-2 border-gray-300 rounded-lg focus:border-purple-500 focus:outline-none text-black font-bold bg-white shadow-sm hover:border-gray-400 transition-all duration-200 text-sm sm:text-base flex items-center justify-between"
                              style={{ color: '#000000', backgroundColor: '#ffffff', fontWeight: '700' }}
                              aria-expanded={isQueryDropdownOpen[query.id]}
                              aria-haspopup="listbox"
                              aria-controls={`query-dropdown-${query.id}`}
                              role="combobox"
                            >
                              <span className="text-gray-500 text-left">
                                {showBothTeams 
                                  ? "📋 Select from Sales or Credit team queries..." 
                                  : `📋 Select from ${sendTo[0]} team queries...`}
                              </span>
                              <FaChevronDown className={`transition-transform text-gray-400 ${isQueryDropdownOpen[query.id] ? 'rotate-180' : ''}`} />
                            </button>
                            
                            {isQueryDropdownOpen[query.id] && (
                              <div 
                                id={`query-dropdown-${query.id}`}
                                className="absolute z-20 bottom-full mb-1 w-full bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden max-h-80 sm:max-h-96 overflow-y-auto"
                                role="listbox"
                                aria-label="Query options"
                              >
                                {showBothTeams ? (
                                  /* Column Layout for Both Teams - Responsive: Stacked on mobile, columns on larger screens */
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                                    {/* Sales Column */}
                                    <div className="border-r-0 lg:border-r border-gray-200 border-b lg:border-b-0">
                                      <div className="bg-blue-600 text-white p-2 sm:p-3 font-bold text-center text-xs sm:text-sm flex items-center justify-center gap-2">
                                        <span className="text-base sm:text-lg">🏢</span>
                                        <span>SALES TEAM ({salesQueries.length})</span>
                                      </div>
                                      <div className="max-h-32 sm:max-h-48 lg:max-h-64 overflow-y-auto">
                                        {salesQueries.map((salesQuery, index) => {
                                          const itemIndex = allDropdownItems[query.id]?.findIndex(item => 
                                            item.type === 'sales' && item.query === salesQuery
                                          ) ?? -1;
                                          const isFocused = focusedItemIndex[query.id] === itemIndex;
                                          
                                          return (
                                            <button
                                              key={`sales-${index}`}
                                              type="button"
                                              onClick={() => handleDropdownSelect(query.id, salesQuery)}
                                              className={`w-full text-left px-2 sm:px-3 py-2 transition-colors text-xs sm:text-sm border-b border-blue-100 last:border-b-0 ${
                                                isFocused ? 'bg-blue-200' : 'hover:bg-blue-50'
                                              }`}
                                              role="option"
                                              aria-selected={isFocused}
                                              data-dropdown-item={`${query.id}-${itemIndex}`}
                                            >
                                              <div className="flex items-start gap-1 sm:gap-2">
                                                <span className="text-blue-600 font-bold min-w-[16px] sm:min-w-[20px] text-xs sm:text-sm flex-shrink-0">🏢</span>
                                                <span className="text-blue-800 leading-tight text-xs sm:text-sm break-words">{salesQuery}</span>
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                    
                                    {/* Credit Column */}
                                    <div>
                                      <div className="bg-green-600 text-white p-2 sm:p-3 font-bold text-center text-xs sm:text-sm flex items-center justify-center gap-2">
                                        <span className="text-base sm:text-lg">💳</span>
                                        <span>CREDIT TEAM ({creditQueries.length})</span>
                                      </div>
                                      <div className="max-h-32 sm:max-h-48 lg:max-h-64 overflow-y-auto">
                                        {creditQueries.map((creditQuery, index) => {
                                          const itemIndex = allDropdownItems[query.id]?.findIndex(item => 
                                            item.type === 'credit' && item.query === creditQuery
                                          ) ?? -1;
                                          const isFocused = focusedItemIndex[query.id] === itemIndex;
                                          
                                          return (
                                            <button
                                              key={`credit-${index}`}
                                              type="button"
                                              onClick={() => handleDropdownSelect(query.id, creditQuery)}
                                              className={`w-full text-left px-2 sm:px-3 py-2 transition-colors text-xs sm:text-sm border-b border-green-100 last:border-b-0 ${
                                                isFocused ? 'bg-green-200' : 'hover:bg-green-50'
                                              }`}
                                              role="option"
                                              aria-selected={isFocused}
                                              data-dropdown-item={`${query.id}-${itemIndex}`}
                                            >
                                              <div className="flex items-start gap-1 sm:gap-2">
                                                <span className="text-green-600 font-bold min-w-[16px] sm:min-w-[20px] text-xs sm:text-sm flex-shrink-0">💳</span>
                                                <span className="text-green-800 leading-tight text-xs sm:text-sm break-words">{creditQuery}</span>
                                              </div>
                                            </button>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  /* Single Team Layout - Show only selected team's queries */
                                  <div>
                                    <div className={`${sendTo[0] === 'Sales' ? 'bg-blue-600' : 'bg-green-600'} text-white p-2 sm:p-3 font-bold text-center text-xs sm:text-sm flex items-center justify-center gap-2`}>
                                      <span className="text-base sm:text-lg">{sendTo[0] === 'Sales' ? '🏢' : '💳'}</span>
                                      <span>{sendTo[0] === 'Sales' ? 'SALES TEAM' : 'CREDIT TEAM'} ({sendTo[0] === 'Sales' ? salesQueries.length : creditQueries.length})</span>
                                    </div>
                                    <div className="max-h-48 sm:max-h-64 overflow-y-auto">
                                      {getAvailableQueries().filter(option => option.query !== "Other").map((option, optionIndex) => {
                                        const itemIndex = allDropdownItems[query.id]?.findIndex(item => 
                                          item.type === 'single' && item.query === option.query
                                        ) ?? -1;
                                        const isFocused = focusedItemIndex[query.id] === itemIndex;
                                        
                                        return (
                                          <button
                                            key={optionIndex}
                                            type="button"
                                            onClick={() => handleDropdownSelect(query.id, option.query)}
                                            className={`w-full text-left px-2 sm:px-3 py-2 transition-colors text-xs sm:text-sm border-b last:border-b-0 ${
                                              option.team === 'Sales' ? 'border-blue-100' : 'border-green-100'
                                            } ${
                                              isFocused 
                                                ? option.team === 'Sales' ? 'bg-blue-200' : 'bg-green-200'
                                                : option.team === 'Sales' ? 'hover:bg-blue-50' : 'hover:bg-green-50'
                                            }`}
                                            role="option"
                                            aria-selected={isFocused}
                                            data-dropdown-item={`${query.id}-${itemIndex}`}
                                          >
                                            <div className="flex items-start gap-1 sm:gap-2">
                                              <span className={`${option.team === 'Sales' ? 'text-blue-600' : 'text-green-600'} font-bold min-w-[16px] sm:min-w-[20px] text-xs sm:text-sm flex-shrink-0`}>
                                                {option.team === 'Sales' ? '🏢' : '💳'}
                                              </span>
                                              <span className={`${option.team === 'Sales' ? 'text-blue-800' : 'text-green-800'} leading-tight text-xs sm:text-sm break-words`}>
                                                {option.query}
                                              </span>
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Other Option at Bottom - Responsive */}
                                <div className="border-t-2 border-orange-200">
                                  {(() => {
                                    const otherItemIndex = allDropdownItems[query.id]?.findIndex(item => item.type === 'other') ?? -1;
                                    const isFocused = focusedItemIndex[query.id] === otherItemIndex;
                                    
                                    return (
                                      <button
                                        type="button"
                                        onClick={() => handleDropdownSelect(query.id, "Other")}
                                        className={`w-full text-left px-2 sm:px-3 py-2 sm:py-3 transition-colors ${
                                          isFocused ? 'bg-orange-200' : 'bg-orange-50 hover:bg-orange-100'
                                        }`}
                                        role="option"
                                        aria-selected={isFocused}
                                        data-dropdown-item={`${query.id}-${otherItemIndex}`}
                                      >
                                        <div className="flex items-center gap-2 sm:gap-3">
                                          <span className="text-orange-600 font-bold text-base sm:text-lg">🖊️</span>
                                          <div>
                                            <span className="text-orange-800 font-bold text-xs sm:text-sm">Other (Custom Message)</span>
                                            <p className="text-orange-600 text-xs hidden sm:block">Write your own custom query and choose team</p>
                                          </div>
                                        </div>
                                      </button>
                                    );
                                  })()}
                                </div>
                                
                                {/* Keyboard navigation hint */}
                                <div className="bg-gray-50 border-t border-gray-200 px-2 sm:px-3 py-1 sm:py-2">
                                  <p className="text-xs text-gray-500 text-center">
                                    Use ↑↓ arrow keys to navigate, Enter to select, Esc to close
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                        {queries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeQuery(query.id)}
                            className="mt-7 p-2 text-red-500 hover:text-red-700 transition-colors"
                          >
                            <FaTimes />
                          </button>
                        )}
                      </div>
                      
                      {/* Text area for custom input or showing selected option */}
                      {query.text && (
                        <div className="flex gap-3 items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <label className="text-sm font-medium text-gray-600">
                                {query.isCustom ? 'Custom Query:' : 'Selected Query:'}
                              </label>
                              {!query.isCustom && showBothTeams && (
                                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                  getQueryTeam(query.text) === 'Sales' 
                                    ? 'bg-blue-100 text-blue-800' 
                                    : 'bg-green-100 text-green-800'
                                }`}>
                                  {getQueryTeam(query.text) === 'Sales' ? '🏢 Sales Query' : '💳 Credit Query'}
                                </span>
                              )}
                            </div>
                            <textarea
                              value={query.text}
                              onChange={(e) => handleQueryChange(query.id, e.target.value, query.isCustom)}
                              placeholder={`Query ${index + 1}: Describe the issue or question...`}
                              className={`w-full p-2 sm:p-3 border-2 rounded-lg focus:border-purple-500 focus:outline-none resize-none h-16 sm:h-20 text-black font-bold transition-all duration-200 text-sm sm:text-base ${
                                query.isCustom 
                                  ? 'border-orange-300 bg-orange-50' 
                                  : showBothTeams && getQueryTeam(query.text) === 'Sales'
                                  ? 'border-blue-300 bg-blue-50'
                                  : showBothTeams && getQueryTeam(query.text) === 'Credit'
                                  ? 'border-green-300 bg-green-50'
                                  : !showBothTeams && sendTo[0] === 'Sales'
                                  ? 'border-blue-300 bg-blue-50'
                                  : 'border-green-300 bg-green-50'
                              }`}
                              style={{ color: '#000000', fontWeight: '700' }}
                              required
                              readOnly={!query.isCustom}
                            />
                            {!query.isCustom && !showBothTeams && (
                              <p className={`text-xs mt-1 ${
                                sendTo[0] === 'Sales' ? 'text-blue-600' : 'text-green-600'
                              }`}>
                                ✅ {sendTo[0]} team predefined option selected
                              </p>
                            )}
                            {!query.isCustom && showBothTeams && (
                              <p className={`text-xs mt-1 ${
                                getQueryTeam(query.text) === 'Sales' ? 'text-blue-600' : 'text-green-600'
                              }`}>
                                ✅ {getQueryTeam(query.text)} team predefined option selected
                              </p>
                            )}
                            {query.isCustom && (
                              <p className={`text-xs mt-1 ${
                                query.team === 'Sales' ? 'text-blue-600' : 
                                query.team === 'Credit' ? 'text-green-600' : 'text-purple-600'
                              }`}>
                                🖊️ Custom query - will be sent to {
                                  query.team === 'Sales' ? 'Sales team only' :
                                  query.team === 'Credit' ? 'Credit team only' :
                                  'both Sales and Credit teams'
                                }
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                
                <button
                  type="button"
                  onClick={addQuery}
                  className="mt-3 sm:mt-4 flex items-center gap-2 text-purple-600 hover:text-purple-800 font-medium text-sm sm:text-base"
                >
                  <FaPlus />
                  Add Another Query
                </button>
              </div>
              
              {/* Submit Button */}
              <div className="flex justify-center sm:justify-end">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitMutation.isPending || queries.every(q => !q.text.trim())}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm sm:text-base font-medium"
                >
                  {submitMutation.isPending ? (
                    <>
                      <FaSpinner className="animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <FaPaperPlane />
                      Submit Query
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        !isSearching && !searchError && (
          <EmptyState 
            message="Search for an application first - Enter an application number to search for sanctioned cases" 
          />
        )
      )}

      {/* Custom Message Modal - Enhanced Design */}
      {showCustomMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl border border-gray-200 max-h-[90vh] overflow-y-auto">
            {/* Header with gradient background */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-4 sm:p-6 rounded-t-2xl">
              <div className="text-center">
                <div className="flex items-center justify-center mb-3">
                  <div className="bg-white bg-opacity-20 p-3 rounded-full backdrop-blur-sm">
                    <span className="text-white text-2xl sm:text-3xl">🖊️</span>
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">Create Custom Query</h3>
                <p className="text-orange-100 text-sm sm:text-base">Write your own personalized query or remarks</p>
              </div>
            </div>
            
            {/* Content */}
            <div className="p-4 sm:p-6">
              <div className="space-y-4 sm:space-y-6">
                {/* Team Selection with enhanced design */}
                <div className="bg-gradient-to-br from-orange-50 to-red-50 p-4 rounded-xl border border-orange-200">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3">
                    <span className="text-orange-600">🎯</span>
                    Send Custom Query To:
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                    {['Sales', 'Credit', 'Both'].map((team) => (
                      <button
                        key={team}
                        type="button"
                        onClick={() => setCustomQueryTeam(team as 'Sales' | 'Credit' | 'Both')}
                        className={`p-3 rounded-lg border-2 transition-all duration-200 text-sm font-medium ${
                          customQueryTeam === team
                            ? team === 'Sales' 
                              ? 'border-blue-500 bg-blue-50 text-blue-800'
                              : team === 'Credit'
                              ? 'border-green-500 bg-green-50 text-green-800'
                              : 'border-purple-500 bg-purple-50 text-purple-800'
                            : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-lg">
                            {team === 'Sales' ? '🏢' : team === 'Credit' ? '💳' : '🔄'}
                          </span>
                          <span className="text-xs">
                            {team === 'Sales' ? 'Sales Team' : team === 'Credit' ? 'Credit Team' : 'Both Teams'}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 p-2 bg-white rounded-lg border border-orange-200">
                    <p className="text-xs text-gray-600 flex items-center gap-2">
                      <span className="text-orange-500">📋</span>
                      {customQueryTeam === 'Sales' && 'This custom query will be sent to Sales team only'}
                      {customQueryTeam === 'Credit' && 'This custom query will be sent to Credit team only'}
                      {customQueryTeam === 'Both' && 'This custom query will be sent to both Sales and Credit teams'}
                    </p>
                  </div>
                </div>
                
                {/* Message Input with enhanced design */}
                <div className="bg-gradient-to-br from-gray-50 to-orange-50 p-4 rounded-xl border border-gray-200">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3">
                    <span className="text-orange-600">💬</span>
                    Custom Query Message:
                  </label>
                  <div className="relative">
                    <textarea
                      id="customMessage"
                      placeholder="Describe your specific query, issue, or requirement in detail..."
                      className="w-full p-4 border-2 border-orange-300 rounded-xl focus:border-orange-500 focus:outline-none resize-none h-32 sm:h-40 text-black font-medium bg-white transition-all duration-200 text-sm sm:text-base shadow-sm"
                      style={{ color: '#000000', backgroundColor: '#ffffff', fontWeight: '500' }}
                    />
                    <div className="absolute bottom-3 right-3 text-xs text-gray-400 bg-white px-2 py-1 rounded">
                      Enter details here
                    </div>
                  </div>
                  <div className="mt-2 p-2 bg-orange-100 rounded-lg border border-orange-200">
                    <p className="text-xs text-orange-700 flex items-center gap-2">
                      <span>💡</span>
                      <span>Be specific about your requirements for faster resolution</span>
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Action Buttons with enhanced design */}
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-gray-200 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomMessage(false);
                    setCustomQueryId(null);
                    setCustomQueryTeam('Sales'); // Reset to default
                  }}
                  className="w-full sm:w-auto px-6 py-3 text-gray-600 border-2 border-gray-300 rounded-xl hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 font-medium text-sm sm:text-base flex items-center justify-center gap-2"
                >
                  <span>❌</span>
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const customMessage = (document.getElementById('customMessage') as HTMLTextAreaElement)?.value || '';
                    if (customMessage.trim()) {
                      handleCustomMessageSubmit(customMessage.trim());
                    }
                  }}
                  className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl hover:from-orange-700 hover:to-red-700 transition-all duration-200 font-medium shadow-lg text-sm sm:text-base flex items-center justify-center gap-2"
                >
                  <span>✅</span>
                  Add Custom Query
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 