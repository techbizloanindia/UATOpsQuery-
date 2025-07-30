import { NextRequest, NextResponse } from 'next/server';

interface QueryAction {
  queryId: number;
  action: 'approve' | 'deferral' | 'otc' | 'revert';
  assignedTo?: string;
  remarks?: string;
  operationTeamMember?: string;
  team?: string;
  actionBy?: string;
}

interface QueryMessage {
  queryId: number;
  message: string;
  addedBy: string;
  team: 'Operations' | 'Sales' | 'Credit';
}

// In-memory storage for query actions
const queryActionsDatabase: any[] = [];

// Use global message database for sharing between routes
if (typeof global.queryMessagesDatabase === 'undefined') {
  global.queryMessagesDatabase = [];
}

// Reference to the queries database
let queriesDatabase: any[] = [];

// Initialize the queriesDatabase from the queries API route
const initializeQueriesDatabase = async () => {
  try {
    // Skip initialization in build mode or production
    if (process.env.NODE_ENV === 'production' || process.env.BUILDING === 'true') {
      console.log('Skipping database initialization in production/build mode');
      return;
    }
    
    const baseUrl = 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/queries`);
    if (response.ok) {
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        queriesDatabase = data.data;
      }
    }
  } catch (error) {
    console.error('Error initializing queries database:', error);
  }
};

// Initialize sample data
const initializeData = () => {
  // Ensure we have some sample messages if none exist
  if (global.queryMessagesDatabase.length === 0) {
    console.log('Initializing clean database in query-actions');
    global.queryMessagesDatabase = [
      // No sample messages - clean database for production use
    ];
  }
};

// POST - Handle query actions, messages, and reverts
export async function POST(request: NextRequest) {
  try {
    // Initialize data
    initializeData();
    
    // Ensure we have the latest queries database
    await initializeQueriesDatabase();
    
    const body = await request.json();
    const { type } = body;

    if (type === 'action') {
      console.log('⚡ Handling action type');
      return handleQueryAction(body);
    } else if (type === 'message') {
      console.log('💬 Handling message type');
      return handleAddMessage(body);
    } else if (type === 'revert') {
      console.log('🔄 Handling revert type');
      return handleRevertAction(body);
    } else {
      console.log('❌ Invalid request type received:', type);
      return NextResponse.json(
        { success: false, error: 'Invalid request type' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Error handling query action:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Handle query actions
async function handleQueryAction(body: QueryAction & { type: string }) {
  const { queryId, action, assignedTo, remarks, operationTeamMember } = body;
  
  if (!queryId || !action) {
    return NextResponse.json(
      { success: false, error: 'Query ID and action are required' },
      { status: 400 }
    );
  }

  // Create action record with resolver name
  const actionRecord = {
    id: `${Date.now().toString()}-${Math.random().toString(36).substring(2, 9)}`,
    queryId,
    action,
    assignedTo,
    remarks,
    operationTeamMember: operationTeamMember || 'Operations Team',
    actionDate: new Date().toISOString(),
    status: 'completed'
  };

  // Store the action
  queryActionsDatabase.push(actionRecord);

  // Update the query status in the queries database
  try {
    // Determine the resolved status based on action
    const resolvedStatus = action === 'approve' ? 'approved' : action === 'deferral' ? 'deferred' : action;
    
    // Try to update via API call first for better consistency
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    
    const updateData = {
      queryId,
      status: resolvedStatus,
      resolvedAt: new Date().toISOString(),
      resolvedBy: operationTeamMember || 'Operations Team',
      resolutionReason: action,
      assignedTo: assignedTo || null,
      remarks: remarks || '',
      // Always mark as resolved when action is taken
      isResolved: true,
      isIndividualQuery: true // Most actions are on individual queries
    };
    
    console.log('📝 Sending update to queries API:', updateData);
    
    const response = await fetch(`${baseUrl}/api/queries`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    
    if (response.ok) {
      const successData = await response.json();
      console.log('✅ Query status updated successfully via API:', successData);
    } else {
      const errorData = await response.json();
      console.warn('⚠️ Failed to update query status via API:', errorData);
      
      // Fallback: Direct database update
      const foundQuery = queriesDatabase.find(q => q.id === queryId);
      if (foundQuery) {
        foundQuery.status = resolvedStatus;
        foundQuery.resolvedAt = new Date().toISOString();
        foundQuery.resolvedBy = operationTeamMember || 'Operations Team';
        foundQuery.resolutionReason = action;
        foundQuery.lastUpdated = new Date().toISOString();
        (foundQuery as any).isResolved = true;
        console.log(`✅ Query ${queryId} updated via fallback method`);
      }
    }
  } catch (error) {
    console.error('Error updating query status:', error);
  }

  console.log('📋 Query action recorded:', actionRecord);

  // Create appropriate message based on action and assigned person
  let message = '';
  const timestamp = new Date().toISOString();
  const operatorName = operationTeamMember || 'Operations Team';
  
  switch (action) {
    case 'approve':
      message = `✅ Query APPROVED by ${operatorName}\n\n📝 Remarks: ${remarks || 'No additional remarks'}\n\n🕒 Approved on: ${new Date(timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })}\n\n✅ Query has been moved to Query Resolved section.`;
      break;
    case 'deferral':
      message = `⏸️ Query DEFERRED by ${operatorName}\n\n👤 Assigned to: ${assignedTo || 'Not specified'}\n📝 Remarks: ${remarks || 'No additional remarks'}\n\n🕒 Deferred on: ${new Date(timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })}\n\n📋 Query has been moved to Query Resolved section with Deferral status.`;
      break;
    case 'otc':
      message = `🔄 Query marked as OTC by ${operatorName}\n\n👤 Assigned to: ${assignedTo || 'Not specified'}\n📝 Remarks: ${remarks || 'No additional remarks'}\n\n🕒 OTC assigned on: ${new Date(timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      })}\n\n🏢 Query has been moved to Query Resolved section with OTC status.`;
      break;
  }

  // Add a comprehensive system message to the global chat history
  const systemMessage = {
    id: `${Date.now().toString()}-system-${Math.random().toString(36).substring(2, 9)}`,
    queryId,
    message: message,
    responseText: message,
    sender: operatorName,
    senderRole: 'operations',
    team: 'Operations',
    timestamp: timestamp,
    isSystemMessage: true,
    actionType: action,
    assignedTo: assignedTo || null,
    remarks: remarks || ''
  };
  
  global.queryMessagesDatabase.push(systemMessage);
  console.log('💬 System message added to global message database:', systemMessage);

  return NextResponse.json({
    success: true,
    data: actionRecord,
    message,
    systemMessage
  });
}

// Handle revert actions
async function handleRevertAction(body: any) {
  const { queryId, remarks, team, actionBy, timestamp } = body;
  
  if (!queryId) {
    return NextResponse.json(
      { success: false, error: 'Query ID is required' },
      { status: 400 }
    );
  }

  if (!remarks) {
    return NextResponse.json(
      { success: false, error: 'Remarks are required for revert action' },
      { status: 400 }
    );
  }

  // Create revert action record
  const revertRecord = {
    id: `${Date.now().toString()}-${Math.random().toString(36).substring(2, 9)}`,
    queryId: parseInt(queryId),
    action: 'revert',
    remarks,
    team: team || 'Unknown Team',
    actionBy: actionBy || 'Team Member',
    actionDate: timestamp || new Date().toISOString(),
    status: 'completed'
  };

  // Store the revert action
  queryActionsDatabase.push(revertRecord);

  // Update the query status in the queries database
  try {
    // Find the query in the database
    const queryIndex = queriesDatabase.findIndex(q => q.id === parseInt(queryId));
    
    if (queryIndex !== -1) {
      // Update the query to revert it back to pending status
      queriesDatabase[queryIndex] = {
        ...queriesDatabase[queryIndex],
        status: 'pending',
        revertedAt: new Date().toISOString(),
        revertedBy: actionBy || 'Team Member',
        revertReason: remarks,
        lastUpdated: new Date().toISOString(),
        // Remove resolution fields since it's reverted
        resolvedAt: undefined,
        resolvedBy: undefined,
        resolutionReason: undefined
      };
      
      console.log(`✅ Query ${queryId} reverted back to pending status`);
    } else {
      console.warn(`⚠️ Query ${queryId} not found in database`);
    }
    
    // Also make the API call to ensure consistency
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const updateData = {
      queryId,
      status: 'pending',
      revertedAt: new Date().toISOString(),
      revertedBy: actionBy || 'Team Member',
      revertReason: remarks
    };
    
    console.log('📝 Sending revert update to queries API:', updateData);
    
    const response = await fetch(`${baseUrl}/api/queries`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updateData),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.warn('Failed to update query status via API:', errorData);
    } else {
      const successData = await response.json();
      console.log('✅ Query revert status updated via API:', successData);
    }
  } catch (error) {
    console.warn('Error updating query revert status:', error);
  }

  console.log('📋 Query revert action recorded:', revertRecord);

  // Create a better formatted system message for the revert action
  const teamName = team ? `${team} Team` : 'Team';
  const actionByName = actionBy || 'Team Member';
  
  // Build comprehensive revert message with structured format
  const revertMessage = `🔄 Query Reverted by ${teamName}

👤 Reverted by: ${actionByName}
📅 Reverted on: ${new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })}
📝 Reason: ${remarks}

ℹ️ This query has been reverted back to pending status and will need to be processed again by the appropriate team.`;

  // Add a system message to the global chat history
  const systemMessage = {
    id: `${Date.now().toString()}-revert-${Math.random().toString(36).substring(2, 9)}`,
    queryId: parseInt(queryId),
    message: revertMessage,
    responseText: revertMessage,
    sender: actionByName,
    senderRole: team ? team.toLowerCase() : 'team',
    team: teamName,
    timestamp: timestamp || new Date().toISOString(),
    isSystemMessage: true,
    actionType: 'revert',
    revertReason: remarks,
    revertedBy: actionByName
  };
  
  global.queryMessagesDatabase.push(systemMessage);
  console.log('💬 Revert message added to global message database:', systemMessage);

  return NextResponse.json({
    success: true,
    data: revertRecord,
    message: revertMessage,
    systemMessage: systemMessage
  });
}

// Handle adding messages to queries
async function handleAddMessage(body: QueryMessage & { type: string }) {
  const { queryId, message, addedBy, team } = body;
  
  if (!queryId || !message) {
    return NextResponse.json(
      { success: false, error: 'Query ID and message are required' },
      { status: 400 }
    );
  }

  const messageRecord = {
    id: `${Date.now().toString()}-${Math.random().toString(36).substring(2, 9)}`,
    queryId,
    message,
    responseText: message,
    sender: addedBy || `${team} Team Member`,
    senderRole: team ? team.toLowerCase() : 'operations',
    team: team || 'Operations',
    timestamp: new Date().toISOString()
  };

  // Add to global message database
  global.queryMessagesDatabase.push(messageRecord);

  console.log(`💬 Message from ${team} added to global message database:`, messageRecord);

  return NextResponse.json({
    success: true,
    data: messageRecord,
    message: 'Message added successfully'
  });
}

// GET - Retrieve query actions and messages
export async function GET(request: NextRequest) {
  try {
    // Initialize data
    initializeData();
    
    // Ensure we have the latest queries database
    await initializeQueriesDatabase();
    
    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('queryId');
    const type = searchParams.get('type'); // 'actions' or 'messages'

    if (type === 'actions') {
      let actions = [...queryActionsDatabase];
      if (queryId) {
        actions = actions.filter(a => a.queryId === parseInt(queryId));
      }
      
      return NextResponse.json({
        success: true,
        data: actions,
        count: actions.length
      });
    } else if (type === 'messages') {
      let messages = [...global.queryMessagesDatabase];
      if (queryId) {
        messages = messages.filter(m => m.queryId === parseInt(queryId));
      }
      
      // Sort messages by timestamp (oldest first)
      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      return NextResponse.json({
        success: true,
        data: messages,
        count: messages.length
      });
    } else {
      // Return both actions and messages
      let actions = [...queryActionsDatabase];
      let messages = [...global.queryMessagesDatabase];
      
      if (queryId) {
        const qId = parseInt(queryId);
        actions = actions.filter(a => a.queryId === qId);
        messages = messages.filter(m => m.queryId === qId);
      }
      
      // Sort messages by timestamp (oldest first)
      messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      
      return NextResponse.json({
        success: true,
        data: {
          actions,
          messages
        },
        count: {
          actions: actions.length,
          messages: messages.length
        }
      });
    }
  } catch (error: any) {
    console.error('Error fetching query actions:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// Make queryMessagesDatabase accessible globally
declare global {
  var queryMessagesDatabase: any[];
}
