import { NextRequest, NextResponse } from 'next/server';

interface QueryResponse {
  queryId: string;
  appNo: string;
  responseText: string;
  team: 'Sales' | 'Credit' | 'Operations';
  respondedBy: string;
  timestamp?: string;
}

// In-memory storage for responses
// In a real app, this would be stored in a database
let responsesDatabase: any[] = [];

// In-memory storage for messages (shared with query-actions)
// This ensures all messages are accessible across API routes
if (typeof global.queryMessagesDatabase === 'undefined') {
  global.queryMessagesDatabase = [];
}

// Initialize with some sample data if empty
function initializeData() {
  if (global.queryMessagesDatabase.length === 0) {
    console.log('Initializing clean messages database');
    global.queryMessagesDatabase = [
      // No sample messages - clean database for production use
    ];
  }
}

// POST - Submit new response
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { queryId, appNo, responseText, team, respondedBy, timestamp } = body;
    
    // Initialize data
    initializeData();
    
    if (!queryId || !responseText || !team) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: queryId, responseText, team' 
        },
        { status: 400 }
      );
    }

    // Create response with timestamp
    const responseData = {
      id: `${Date.now().toString()}-${Math.random().toString(36).substring(2, 9)}`,
      queryId,
      appNo,
      responseText,
      team,
      respondedBy: respondedBy || `${team} Team Member`,
      timestamp: timestamp || new Date().toISOString(),
      isRead: false
    };

    // Store in our database
    responsesDatabase.push(responseData);
    
    // Create message data for chat history
    const messageData = {
      id: `${Date.now().toString()}-${Math.random().toString(36).substring(2, 9)}`,
      queryId: parseInt(queryId),
      message: responseText,
      responseText: responseText,
      sender: respondedBy || `${team} Team Member`,
      senderRole: team.toLowerCase(),
      team: team,
      timestamp: timestamp || new Date().toISOString()
    };
    
    // Add to global message database for real-time chat
    global.queryMessagesDatabase.push(messageData);
    console.log(`✅ Added message from ${team} to global message database`);
    
    // Also make API call to query-actions to ensure consistency
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/api/query-actions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'message',
          queryId: parseInt(queryId),
          message: responseText,
          addedBy: respondedBy || `${team} Team Member`,
          team: team
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.warn('Failed to add message via query-actions API:', errorData);
      } else {
        console.log('✅ Successfully added message via query-actions API');
      }
    } catch (error) {
      console.warn('Error adding message to query-actions:', error);
    }
    
    console.log('📝 New response submitted:', responseData);
    
    return NextResponse.json({
      success: true,
      data: responseData,
      message: 'Response submitted successfully'
    });

  } catch (error: any) {
    console.error('Error submitting response:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// GET - Retrieve responses and messages
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const queryId = searchParams.get('queryId');
    const appNo = searchParams.get('appNo');
    const team = searchParams.get('team');
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const includeMessages = searchParams.get('includeMessages') === 'true';

    // Initialize data
    initializeData();

    // Filter based on parameters
    let filteredResponses = [...responsesDatabase];

    if (queryId) {
      filteredResponses = filteredResponses.filter(r => r.queryId === queryId);
    }

    if (appNo) {
      filteredResponses = filteredResponses.filter(r => r.appNo === appNo);
    }

    if (team) {
      filteredResponses = filteredResponses.filter(r => r.team === team);
    }

    if (unreadOnly) {
      filteredResponses = filteredResponses.filter(r => r.isRead === false);
    }

    // Sort by most recent first
    filteredResponses.sort((a, b) => 
      new Date(b.timestamp || b.respondedAt).getTime() - new Date(a.timestamp || a.respondedAt).getTime()
    );

    // Get messages from global message database if requested
    let messages = [];
    if (includeMessages && queryId) {
      messages = global.queryMessagesDatabase.filter(m => 
        m.queryId === parseInt(queryId)
      ).sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    }

    return NextResponse.json({
      success: true,
      data: filteredResponses,
      messages: messages,
      count: filteredResponses.length,
      unreadCount: filteredResponses.filter(r => r.isRead === false).length
    });

  } catch (error: any) {
    console.error('Error fetching responses:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Mark responses as read
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { responseIds } = body;
    
    if (!responseIds || !Array.isArray(responseIds)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required field: responseIds (array)' 
        },
        { status: 400 }
      );
    }

    // Mark responses as read
    let updatedCount = 0;
    responsesDatabase = responsesDatabase.map(response => {
      if (responseIds.includes(response.id)) {
        updatedCount++;
        return { ...response, isRead: true };
      }
      return response;
    });
    
    return NextResponse.json({
      success: true,
      updatedCount,
      message: `Successfully marked ${updatedCount} response(s) as read.`
    });

  } catch (error: any) {
    console.error('Error marking responses as read:', error);
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