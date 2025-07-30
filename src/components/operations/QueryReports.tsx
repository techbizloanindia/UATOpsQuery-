'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';

// Add import for getStatusDisplayName
import { getStatusDisplayName } from '../shared/StatusUtils';

interface ReportQuery {
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
  submittedBy: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'deferred' | 'otc' | 'resolved';
  branch: string;
  branchCode: string;
  lastUpdated: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionReason?: string;
  assignedTo?: string; // Added for OTC/Deferral actions
  amount?: string;
  appliedOn?: string;
  queryIndex?: number;
  queryText?: string;
  queryId?: string;
  sendToSales?: boolean;
  sendToCredit?: boolean;
  markedForTeam?: 'sales' | 'credit' | 'both' | 'operations';
}

interface ReportStats {
  total: number;
  pending: number;
  approved: number;
  deferred: number;
  otc: number;
}

// Fetch all queries (both pending and resolved) for comprehensive reporting
const fetchAllQueries = async (): Promise<ReportQuery[]> => {
  // Add a cache-busting parameter to ensure we get fresh data
  const timestamp = new Date().getTime();
  const response = await fetch(`/api/queries?status=all&_=${timestamp}`);
  const result = await response.json();
  
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to fetch queries');
  }
  
  return result.data || [];
};

// Fetch all query actions for comprehensive reporting
const fetchAllQueryActions = async (): Promise<any[]> => {
  // Add a cache-busting parameter to ensure we get fresh data
  const timestamp = new Date().getTime();
  const response = await fetch(`/api/query-actions?type=actions&_=${timestamp}`);
  const result = await response.json();
  
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Failed to fetch query actions');
  }
  
  return result.data || [];
};

// Extract individual queries from all queries (both pending and resolved for comprehensive reporting)
const getAllQueries = (allQueries: ReportQuery[]): ReportQuery[] => {
  if (!allQueries || !Array.isArray(allQueries)) return [];
  
  const individual: ReportQuery[] = [];
  
  allQueries.forEach(queryGroup => {
    if (queryGroup && Array.isArray(queryGroup.queries)) {
      queryGroup.queries.forEach((query: any, index: number) => {
        // Include all queries (both pending and resolved)
        const queryStatus = query.status || queryGroup.status;
        // Ensure we capture the assignedTo field for OTC/Deferral actions
        const assignedTo = query.assignedTo || queryGroup.assignedTo;
        individual.push({
          ...queryGroup,
          id: parseInt(query.id.split('-')[0]) + index, // Unique ID for each query
          queries: [query], // Only include this specific query
          status: queryStatus, // Use the individual query status
          resolvedAt: query.resolvedAt || queryGroup.resolvedAt,
          resolvedBy: query.resolvedBy || queryGroup.resolvedBy,
          resolutionReason: query.resolutionReason || queryGroup.resolutionReason,
          assignedTo: assignedTo, // Include assignedTo field for OTC/Deferral actions
          queryIndex: index + 1,
          queryText: query.text,
          queryId: query.id
        } as ReportQuery);
      });
    }
  });
  
  return individual;
};

// Calculate statistics from all queries (both pending and resolved)
const calculateQueryStats = (allQueries: ReportQuery[]): ReportStats => {
  const pendingCount = allQueries.filter((q: ReportQuery) => q.status === 'pending').length;
  const approvedCount = allQueries.filter((q: ReportQuery) => q.status === 'approved').length;
  const deferredCount = allQueries.filter((q: ReportQuery) => q.status === 'deferred').length;
  const otcCount = allQueries.filter((q: ReportQuery) => q.status === 'otc').length;
  const resolvedCount = allQueries.filter((q: ReportQuery) => q.status === 'resolved').length;
  
  return {
    total: allQueries.length,
    pending: pendingCount,
    approved: approvedCount,
    deferred: deferredCount,
    otc: otcCount
  };
};

export default function QueryReports() {
  const [statusFilter, setStatusFilter] = useState('');
  const [submitterFilter, setSubmitterFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filteredData, setFilteredData] = useState<ReportQuery[]>([]);

  // Available people for OTC and Deferral actions - matching the operations component
  const availablePeople = [
    'Sumit Khari', 'Aashish Srivastava', 'Punit Chadha',
    'Abhishek Mishra', 'Aarti Pujara', 'Mohan Keswani', 'Vikram Diwan'
  ];

  // Function to check if a person is in the authorized list
  const isAuthorizedPerson = (personName: string): boolean => availablePeople.includes(personName);

  // Fetch all queries (both pending and resolved) for comprehensive reporting
  const { data: allQueries, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['allQueriesForReports'],
    queryFn: fetchAllQueries,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 1000, // Every 5 seconds for real-time updates
    staleTime: 3 * 1000, // 3 seconds for faster updates
  });

  // Fetch all query actions for comprehensive reporting
  const { data: allQueryActions, isLoading: actionsLoading } = useQuery({
    queryKey: ['allQueryActionsForReports'],
    queryFn: fetchAllQueryActions,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 1000, // Every 5 seconds for real-time updates
    staleTime: 3 * 1000, // 3 seconds for faster updates
  });

  // Extract all queries from fetched data (both pending and resolved)
  const reportData = React.useMemo(() => {
    return getAllQueries(allQueries as ReportQuery[] || []);
  }, [allQueries]);

  // Create a lookup map for query actions
  const actionsMap = React.useMemo(() => {
    if (!allQueryActions) return new Map();
    
    const map = new Map();
    allQueryActions.forEach((action: any) => {
      map.set(action.queryId, action);
    });
    return map;
  }, [allQueryActions]);

  // Calculate statistics from all queries
  const stats = React.useMemo(() => {
    return calculateQueryStats(reportData);
  }, [reportData]);

  // Apply filters
  useEffect(() => {
    if (!reportData) return;

    let filtered = [...reportData];

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(query => 
        query.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    // Submitter filter
    if (submitterFilter) {
      filtered = filtered.filter(query => 
        query.submittedBy.toLowerCase().includes(submitterFilter.toLowerCase())
      );
    }

    // Date range filter
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filtered = filtered.filter(query => {
        const queryDate = new Date(query.submittedAt);
        return queryDate >= start && queryDate <= end;
      });
    }

    // Sort by submission date (newest first)
    filtered.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

    setFilteredData(filtered);
  }, [reportData, statusFilter, submitterFilter, startDate, endDate]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })
    };
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'status-pending';
      case 'approved':
        return 'status-approved';
      case 'deferred':
        return 'status-deferral';
      case 'otc':
        return 'status-otc';
      default:
        return 'status-pending';
    }
  };

  const getApprovedBy = (query: ReportQuery) => {
    // Try to get actual action data first
    const queryIdNum = parseInt(query.queryId || '0');
    const actionData = actionsMap.get(queryIdNum);
    let assignedTo = (actionData && actionData.assignedTo) || (query as any).assignedTo;
    const resolvedBy = (actionData && actionData.operationTeamMember) || query.resolvedBy;
    if (actionData) {
      if (actionData.action === 'deferral' && assignedTo && isAuthorizedPerson(assignedTo)) {
        return `Deferral with ${assignedTo}`;
      } else if (actionData.action === 'otc' && assignedTo && isAuthorizedPerson(assignedTo)) {
        return `OTC with ${assignedTo}`;
      } else if (actionData.action === 'approve') {
        return `${resolvedBy || 'Operations Team'} - Approved`;
      } else {
        return `${resolvedBy || 'Operations Team'} - ${actionData.action.charAt(0).toUpperCase() + actionData.action.slice(1)}`;
      }
    }
    // Fallback to status-based logic if no action data found
    if (query.status === 'approved') {
      return `${resolvedBy || 'Operations Team'} - Approved`;
    } else if (query.status === 'deferred') {
      assignedTo = assignedTo || (query as any).assignedTo;
      if (assignedTo && isAuthorizedPerson(assignedTo)) {
        return `Deferral with ${assignedTo}`;
      } else {
        return `${resolvedBy || 'Operations Team'} - Deferral`;
      }
    } else if (query.status === 'otc') {
      assignedTo = assignedTo || (query as any).assignedTo;
      if (assignedTo && isAuthorizedPerson(assignedTo)) {
        return `OTC with ${assignedTo}`;
      } else {
        return `${resolvedBy || 'Operations Team'} - OTC`;
      }
    } else {
      return 'Pending Review';
    }
  };

  const getOperationTeamInfo = (query: ReportQuery) => {
    // Try to get actual action data first
    const queryIdNum = parseInt(query.queryId || '0');
    const actionData = actionsMap.get(queryIdNum);
    let assignedTo = (actionData && actionData.assignedTo) || (query as any).assignedTo;
    const resolvedBy = (actionData && actionData.operationTeamMember) || query.resolvedBy;
    if (actionData) {
      if (actionData.action === 'deferral' && assignedTo && isAuthorizedPerson(assignedTo)) {
        return {
          team: '🏢 Operations Team (Authorized)',
          member: `Deferral with ${assignedTo}`,
          isAuthorized: true,
          actionName: 'Deferral'
        };
      } else if (actionData.action === 'otc' && assignedTo && isAuthorizedPerson(assignedTo)) {
        return {
          team: '🏢 Operations Team (Authorized)',
          member: `OTC with ${assignedTo}`,
          isAuthorized: true,
          actionName: 'OTC'
        };
      } else if (actionData.action === 'approve') {
        return {
          team: '🏢 Operations Team (Authorized)',
          member: `${resolvedBy || 'Operations Team Member'} - Approved`,
          isAuthorized: true,
          actionName: 'Approved'
        };
      } else {
        return {
          team: '🏢 Operations Team (Authorized)',
          member: `${resolvedBy || 'Operations Team Member'} - ${actionData.action.charAt(0).toUpperCase() + actionData.action.slice(1)}`,
          isAuthorized: true,
          actionName: actionData.action.charAt(0).toUpperCase() + actionData.action.slice(1)
        };
      }
    }
    // Fallback to status-based logic if no action data found
    if (query.status === 'approved') {
      return {
        team: '🏢 Operations Team (Authorized)',
        member: `${resolvedBy || 'Operations Team Member'} - Approved`,
        isAuthorized: true,
        actionName: 'Approved'
      };
    } else if (query.status === 'deferred') {
      assignedTo = assignedTo || (query as any).assignedTo;
      if (assignedTo && isAuthorizedPerson(assignedTo)) {
        return {
          team: '🏢 Operations Team (Authorized)',
          member: `Deferral with ${assignedTo}`,
          isAuthorized: true,
          actionName: 'Deferral'
        };
      } else {
        return {
          team: '🏢 Operations Team (Authorized)',
          member: `${resolvedBy || 'Operations Team Member'} - Deferral`,
          isAuthorized: true,
          actionName: 'Deferral'
        };
      }
    } else if (query.status === 'otc') {
      assignedTo = assignedTo || (query as any).assignedTo;
      if (assignedTo && isAuthorizedPerson(assignedTo)) {
        return {
          team: '🏢 Operations Team (Authorized)',
          member: `OTC with ${assignedTo}`,
          isAuthorized: true,
          actionName: 'OTC'
        };
      } else {
        return {
          team: '🏢 Operations Team (Authorized)',
          member: `${resolvedBy || 'Operations Team Member'} - OTC`,
          isAuthorized: true,
          actionName: 'OTC'
        };
      }
    } else {
      return {
        team: '',
        member: '',
        isAuthorized: false,
        actionName: ''
      };
    }
  };

  const calculateResolveTime = (submittedAt: string, resolvedAt?: string) => {
    if (!resolvedAt) return 'Pending';
    
    const submitted = new Date(submittedAt);
    const resolved = new Date(resolvedAt);
    const diffInHours = Math.abs(resolved.getTime() - submitted.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return `${Math.round(diffInHours)} hours`;
    } else {
      const diffInDays = Math.floor(diffInHours / 24);
      const remainingHours = Math.round(diffInHours % 24);
      return `${diffInDays} days ${remainingHours} hours`;
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const downloadReport = async (format: 'csv' | 'excel') => {
    try {
      // Force refresh data before export to ensure latest data
      await refetch();
      
      // Use current filtered data or all data if no filters
      const dataToExport = filteredData.length > 0 ? filteredData : (reportData || []);
      
      if (dataToExport.length === 0) {
        alert('No data available to export');
        return;
      }

      const headers = [
        'Query Number',
        'App No',
        'Customer Name',
        'Branch',
        'Query Text',
        'Query Assignment',
        'Action Name',
        'Approved By',
        'Query Raise Date',
        'Query Raise Time',
        'Query Resolve Time',
        'Resolved Time',
        'Resolved Date',
        'Last Updated'
      ];

      const csvData = dataToExport.map(query => {
        const dateTime = formatDateTime(query.submittedAt);
        const resolvedDate = query.resolvedAt ? formatDateTime(query.resolvedAt) : { date: 'N/A', time: 'N/A' };
        const lastUpdatedDate = formatDateTime(query.lastUpdated);
        const operationTeam = getOperationTeamInfo(query);

        // Determine department assignment
        const departments = [];
        if ((query as any).sendToSales || (query as any).markedForTeam === 'sales' || (query as any).markedForTeam === 'both') {
          departments.push('Sales');
        }
        if ((query as any).sendToCredit || (query as any).markedForTeam === 'credit' || (query as any).markedForTeam === 'both') {
          departments.push('Credit');
        }
        if (departments.length === 0) {
          departments.push('Operations');
        }

        // Get action name and resolved by display
        let actionNameDisplay = '';
        let resolvedByDisplay = '';
        const queryIdNum = parseInt(query.queryId || '0');
        const actionData = actionsMap.get(queryIdNum);
        let assignedTo = (actionData && actionData.assignedTo) || (query as any).assignedTo;
        const resolvedBy = (actionData && actionData.operationTeamMember) || query.resolvedBy;
        if (actionData) {
          if (actionData.action === 'deferral' && assignedTo && isAuthorizedPerson(assignedTo)) {
            actionNameDisplay = 'Deferral';
            resolvedByDisplay = `Deferral with ${assignedTo}`;
          } else if (actionData.action === 'otc' && assignedTo && isAuthorizedPerson(assignedTo)) {
            actionNameDisplay = 'OTC';
            resolvedByDisplay = `OTC with ${assignedTo}`;
          } else if (actionData.action === 'approve') {
            actionNameDisplay = 'Approved';
            resolvedByDisplay = `${resolvedBy || 'Operations Team'} - Approved`;
          } else {
            actionNameDisplay = actionData.action.charAt(0).toUpperCase() + actionData.action.slice(1);
            resolvedByDisplay = `${resolvedBy || 'Operations Team'} - ${actionNameDisplay}`;
          }
        } else if (query.status !== 'pending') {
          if (query.status === 'approved') {
            actionNameDisplay = 'Approved';
            resolvedByDisplay = `${resolvedBy || 'Operations Team'} - Approved`;
          } else if (query.status === 'deferred') {
            assignedTo = assignedTo || (query as any).assignedTo;
            if (assignedTo && isAuthorizedPerson(assignedTo)) {
              actionNameDisplay = 'Deferral';
              resolvedByDisplay = `Deferral with ${assignedTo}`;
            } else {
              actionNameDisplay = 'Deferral';
              resolvedByDisplay = `${resolvedBy || 'Operations Team'} - Deferral`;
            }
          } else if (query.status === 'otc') {
            assignedTo = assignedTo || (query as any).assignedTo;
            if (assignedTo && isAuthorizedPerson(assignedTo)) {
              actionNameDisplay = 'OTC';
              resolvedByDisplay = `OTC with ${assignedTo}`;
            } else {
              actionNameDisplay = 'OTC';
              resolvedByDisplay = `${resolvedBy || 'Operations Team'} - OTC`;
            }
          } else {
            actionNameDisplay = query.status.charAt(0).toUpperCase() + query.status.slice(1);
            resolvedByDisplay = `${resolvedBy || 'Operations Team'} - ${actionNameDisplay}`;
          }
        } else {
          actionNameDisplay = 'Pending';
          resolvedByDisplay = 'Pending Review';
        }

        return [
          `Query #${query.queryIndex || 1}`,
          query.appNo || 'N/A',
          query.customerName || 'N/A',
          query.branch || 'N/A',
          (query.queryText || query.queries[0]?.text)?.replace(/[\r\n]+/g, ' ') || 'No query text',
          departments.join(', '),
          actionNameDisplay,
          resolvedByDisplay,
          dateTime.date,
          dateTime.time,
          calculateResolveTime(query.submittedAt, query.resolvedAt),
          resolvedDate.time,
          resolvedDate.date,
          `${lastUpdatedDate.date} ${lastUpdatedDate.time}`
        ];
      });

      const allData = [headers, ...csvData];
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];

      if (format === 'csv') {
        // Enhanced CSV with proper escaping
        const csvContent = '\uFEFF' + allData.map(row => 
          row.map(cell => {
            const cellValue = cell.toString().replace(/"/g, '""');
            return `"${cellValue}"`;
          }).join(',')
        ).join('\r\n');
        
        const blob = new Blob([csvContent], { 
          type: 'text/csv;charset=utf-8;' 
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query_report_${timestamp}.csv`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
      } else if (format === 'excel') {
        // Improved Excel format with proper styling
        const xmlContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Created>${new Date().toISOString()}</Created>
  <Version>16.00</Version>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Borders/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000" ss:Bold="1"/>
   <Interior ss:Color="#D3D3D3" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Assignment">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
   <Interior ss:Color="#E8F0FE" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Query Report">
  <Table>
   <Row>
    ${headers.map(header => `<Cell ss:StyleID="Header"><Data ss:Type="String">${header.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`).join('')}
   </Row>
   ${csvData.map(row => 
     `<Row>${row.map((cell, index) => {
       // Apply Assignment style to Query Assignment column (index 5), Action Name gets special style too (index 7)
       const styleId = index === 5 ? 'Assignment' : index === 7 ? 'Assignment' : 'Default';
       return `<Cell ss:StyleID="${styleId}"><Data ss:Type="String">${cell.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Data></Cell>`;
     }).join('')}</Row>`
   ).join('')}
  </Table>
 </Worksheet>
</Workbook>`;
        
        const blob = new Blob([xmlContent], { 
          type: 'application/vnd.ms-excel' 
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `query_report_${timestamp}.xls`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
      
      // Show success message
      const recordCount = dataToExport.length;
      alert(`Successfully exported ${recordCount} records to ${format.toUpperCase()} format`);
      
    } catch (error) {
      console.error('Export failed:', error);
      alert(`Failed to export ${format.toUpperCase()} file. Please try again.`);
    }
  };

  if (isLoading || actionsLoading) {
    return <LoadingState message="Loading query reports..." />;
  }

  if (isError) {
    return <ErrorState message={error?.message || 'Failed to load report data'} onRetry={refetch} />;
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <style jsx>{`
        .status-pending {
          background: #fff3cd;
          color: #856404;
          border: 1px solid #ffeaa7;
        }

        .status-approved {
          background: #d1eddd;
          color: #155724;
          border: 1px solid #c3e6cb;
        }

        .status-deferral {
          background: #f8d7da;
          color: #721c24;
          border: 1px solid #f5c6cb;
        }

        .status-otc {
          background: #cce5ff;
          color: #004085;
          border: 1px solid #99d6ff;
        }

        .query-id {
          font-family: 'Courier New', monospace;
          background: #e9ecef;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: bold;
        }

        .submitter-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3498db, #2980b9);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
        }

        .download-btn {
          padding: 10px 20px;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .download-excel {
          background: #217346;
          color: white;
        }

        .download-csv {
          background: #2b579a;
          color: white;
        }

        .download-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.2);
        }

        .stat-card {
          background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
          padding: 20px;
          border-radius: 15px;
          text-align: center;
          border: 2px solid transparent;
          transition: all 0.3s ease;
          box-shadow: 0 5px 15px rgba(0, 0, 0, 0.05);
        }

        .stat-card:hover {
          transform: translateY(-5px);
          border-color: #3498db;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        }

        .stat-number {
          font-size: 2rem;
          font-weight: bold;
          margin-bottom: 5px;
        }

        .stat-label {
          color: #6c757d;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .pending { color: #f39c12; }
        .approved { color: #27ae60; }
        .deferral { color: #e74c3c; }
        .otc { color: #3498db; }
        .total { color: #3498db; }
      `}</style>

      <div className="container mx-auto p-4 md:p-8 max-w-7xl">
        {/* Filters */}
        <div className="bg-gray-100 p-6 border-b border-gray-200 rounded-t-2xl">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <label className="font-semibold text-black">Status:</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                >
                  <option value="">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="deferred">Deferral</option>
                  <option value="otc">OTC</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="font-semibold text-black">Date Range:</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  placeholder="mm/dd/yyyy"
                />
                <span className="text-black">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                  placeholder="mm/dd/yyyy"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="font-semibold text-black">Submitter:</label>
                <input
                  type="text"
                  placeholder="Search submitter..."
                  value={submitterFilter}
                  onChange={(e) => setSubmitterFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => downloadReport('excel')}
                className="download-btn download-excel"
              >
                📊 Download Excel
              </button>
              <button
                onClick={() => downloadReport('csv')}
                className="download-btn download-csv"
              >
                📄 Download CSV
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="bg-white p-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-8">
            <div className="stat-card">
              <div className="stat-number total">{stats?.total || 0}</div>
              <div className="stat-label">Total Queries</div>
            </div>
            <div className="stat-card">
              <div className="stat-number pending">{stats?.pending || 0}</div>
              <div className="stat-label">Pending</div>
            </div>
            <div className="stat-card">
              <div className="stat-number approved">{stats?.approved || 0}</div>
              <div className="stat-label">Approved</div>
            </div>
            <div className="stat-card">
              <div className="stat-number deferral">{stats?.deferred || 0}</div>
              <div className="stat-label">Deferral</div>
            </div>
            <div className="stat-card">
              <div className="stat-number otc">{stats?.otc || 0}</div>
              <div className="stat-label">OTC</div>
            </div>
          </div>



          {/* Report Table */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-4">
              <h2 className="text-xl font-semibold">
                📊 Comprehensive Query Report - All Query Status
              </h2>
              <p className="text-sm text-blue-100 mt-1">
                🔄 Real-time data including pending and resolved queries
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="px-4 py-3 text-left font-semibold text-black">Query Details</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Customer Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Query Text</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Query Assignment</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Action Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Approved By</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Query Raise Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Query Resolve Time</th>
                    <th className="px-4 py-3 text-left font-semibold text-black">Queries Mark</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                        No queries found matching the selected filters
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((query) => {
                      const dateTime = formatDateTime(query.submittedAt);
                      
                      // Determine department assignment based on original query data
                      const departments = [];
                      if ((query as any).sendToSales || (query as any).markedForTeam === 'sales' || (query as any).markedForTeam === 'both') {
                        departments.push('Sales');
                      }
                      if ((query as any).sendToCredit || (query as any).markedForTeam === 'credit' || (query as any).markedForTeam === 'both') {
                        departments.push('Credit');
                      }
                      if (departments.length === 0) {
                        departments.push('Operations');
                      }
                      
                      let actionNameDisplay = '';
                      const queryIdNum = parseInt(query.queryId || '0');
                      const actionData = actionsMap.get(queryIdNum);
                      if (actionData) {
                        if (actionData.action === 'approve') {
                          actionNameDisplay = 'Approved';
                        } else if (actionData.action === 'deferral') {
                          const assignedTo = actionData.assignedTo || (query as any).assignedTo;
                          if (assignedTo && isAuthorizedPerson(assignedTo)) {
                            actionNameDisplay = 'Deferral';
                          } else {
                            actionNameDisplay = 'Not Specified';
                          }
                        } else if (actionData.action === 'otc') {
                          const assignedTo = actionData.assignedTo || (query as any).assignedTo;
                          if (assignedTo && isAuthorizedPerson(assignedTo)) {
                            actionNameDisplay = 'OTC';
                          } else {
                            actionNameDisplay = 'Not Specified';
                          }
                        } else {
                          actionNameDisplay = actionData.action.charAt(0).toUpperCase() + actionData.action.slice(1);
                        }
                      } else if (query.status !== 'pending') {
                        // Fallback to status if no action data
                        if (query.status === 'approved') {
                          actionNameDisplay = 'Approved';
                        } else if (query.status === 'deferred') {
                          const assignedTo = (query as any).assignedTo;
                          if (assignedTo && isAuthorizedPerson(assignedTo)) {
                            actionNameDisplay = 'Deferral';
                          } else {
                            actionNameDisplay = 'Not Specified';
                          }
                        } else if (query.status === 'otc') {
                          const assignedTo = (query as any).assignedTo;
                          if (assignedTo && isAuthorizedPerson(assignedTo)) {
                            actionNameDisplay = 'OTC';
                          } else {
                            actionNameDisplay = 'Not Specified';
                          }
                        } else {
                          actionNameDisplay = query.status.charAt(0).toUpperCase() + query.status.slice(1);
                        }
                      }
                      
                      return (
                        <tr key={`${query.appNo}-${query.queryIndex}`} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-2">
                              <div className={`flex-shrink-0 rounded-full h-8 w-8 flex items-center justify-center ${
                                query.status === 'pending' 
                                  ? 'bg-yellow-100 text-yellow-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                <span className="text-xs font-bold">
                                  {query.status === 'pending' ? '⏳' : '✓'}
                                </span>
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
                                {query.queryText || query.queries[0]?.text || 'No query text available'}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1">
                              {departments.map((dept, idx) => (
                                <span key={idx} className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                  dept === 'Sales' ? 'bg-blue-100 text-blue-800' :
                                  dept === 'Credit' ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {dept}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-black font-medium">
                              {(() => {
                                const queryIdNum = parseInt(query.queryId || '0');
                                const actionData = actionsMap.get(queryIdNum);
                                
                                if (actionData) {
                                  if (actionData.action === 'approve') {
                                    return 'Approved';
                                  } else if (actionData.action === 'deferral') {
                                    const assignedTo = actionData.assignedTo || (query as any).assignedTo;
                                    if (assignedTo && isAuthorizedPerson(assignedTo)) {
                                      return 'Deferral';
                                    } else {
                                      return 'Not Specified';
                                    }
                                  } else if (actionData.action === 'otc') {
                                    const assignedTo = actionData.assignedTo || (query as any).assignedTo;
                                    if (assignedTo && isAuthorizedPerson(assignedTo)) {
                                      return 'OTC';
                                    } else {
                                      return 'Not Specified';
                                    }
                                  } else {
                                    return actionData.action.charAt(0).toUpperCase() + actionData.action.slice(1);
                                  }
                                } else if (query.status !== 'pending') {
                                  if (query.status === 'approved') {
                                    return 'Approved';
                                  } else if (query.status === 'deferred') {
                                    const assignedTo = (query as any).assignedTo;
                                    if (assignedTo && isAuthorizedPerson(assignedTo)) {
                                      return 'Deferral';
                                    } else {
                                      return 'Not Specified';
                                    }
                                  } else if (query.status === 'otc') {
                                    const assignedTo = (query as any).assignedTo;
                                    if (assignedTo && isAuthorizedPerson(assignedTo)) {
                                      return 'OTC';
                                    } else {
                                      return 'Not Specified';
                                    }
                                  } else {
                                    return query.status.charAt(0).toUpperCase() + query.status.slice(1);
                                  }
                                } else {
                                  return 'Pending';
                                }
                              })()}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-black">
                              {getApprovedBy(query)}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm">
                              <div className="font-medium text-black">{dateTime.date}</div>
                              <div className="text-black">{dateTime.time}</div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm text-black">
                              {calculateResolveTime(query.submittedAt, query.resolvedAt)}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-sm">
                              {getOperationTeamInfo(query).member && (
                                <>
                                  <div className="font-medium text-black">{getOperationTeamInfo(query).team}</div>
                                  <div className="text-black">{getOperationTeamInfo(query).member}</div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
