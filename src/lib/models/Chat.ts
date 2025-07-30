import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../mongodb';

const isBuildProcess = process.env.BUILDING === 'true';

export interface ChatMessage {
  _id?: ObjectId;
  queryId: string;
  caseNumber: string;
  userId: string;
  userName: string;
  userRole: string;
  team: string;
  content: string;
  messageType: 'query' | 'response' | 'resolution' | 'deferral' | 'otc';
  timestamp: Date;
  isResolution?: boolean;
  resolvedBy?: string;
  resolutionType?: 'approved' | 'deferral' | 'otc';
  attachments?: string[];
  metadata?: {
    [key: string]: any;
  };
}

export interface ChatQuery {
  _id?: ObjectId;
  queryId: string;
  caseNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  employeeId: string;
  title: string;
  description: string;
  status: 'pending' | 'resolved' | 'deferred' | 'otc';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTeam: string[];
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionType?: 'approved' | 'deferral' | 'otc';
  resolutionDetails?: string;
  tat?: string;
  branch: string;
  department: string;
  messages: ChatMessage[];
}

export interface CreateChatQueryData {
  caseNumber: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  employeeId: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTeam: string[];
  createdBy: string;
  createdByName: string;
  branch: string;
  department: string;
}

export class ChatModel {
  private static collectionName = process.env.MONGODB_CHAT_COLLECTION || 'chats';

  // Create a new chat query
  static async createChatQuery(queryData: CreateChatQueryData): Promise<ChatQuery> {
    if (isBuildProcess) {
      console.log('Build process: Mocking createChatQuery');
      const mockQuery: ChatQuery = {
        _id: new ObjectId(),
        queryId: `Q${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ...queryData,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
        messages: []
      };
      return mockQuery;
    }
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection<ChatQuery>(this.collectionName);

      // Generate unique query ID
      const queryId = `Q${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const newQuery: ChatQuery = {
        queryId,
        caseNumber: queryData.caseNumber,
        customerName: queryData.customerName,
        customerEmail: queryData.customerEmail,
        customerPhone: queryData.customerPhone,
        employeeId: queryData.employeeId,
        title: queryData.title,
        description: queryData.description,
        status: 'pending',
        priority: queryData.priority,
        assignedTeam: queryData.assignedTeam,
        createdBy: queryData.createdBy,
        createdByName: queryData.createdByName,
        createdAt: new Date(),
        updatedAt: new Date(),
        branch: queryData.branch,
        department: queryData.department,
        messages: []
      };

      // Add initial message
      const initialMessage: ChatMessage = {
        queryId,
        caseNumber: queryData.caseNumber,
        userId: queryData.createdBy,
        userName: queryData.createdByName,
        userRole: 'operations',
        team: 'Operations',
        content: queryData.description,
        messageType: 'query',
        timestamp: new Date()
      };

      newQuery.messages.push(initialMessage);

      const result = await collection.insertOne(newQuery);
      return { ...newQuery, _id: result.insertedId };
    } catch (error) {
      console.error('Error creating chat query:', error);
      throw error;
    }
  }

  // Add message to chat
  static async addMessage(queryId: string, messageData: Omit<ChatMessage, '_id' | 'queryId' | 'timestamp'>): Promise<ChatMessage> {
    if (isBuildProcess) {
      console.log('Build process: Mocking addMessage');
      return {
        _id: new ObjectId(),
        queryId,
        ...messageData,
        timestamp: new Date()
      };
    }
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection<ChatQuery>(this.collectionName);

      const newMessage: ChatMessage = {
        queryId,
        ...messageData,
        timestamp: new Date()
      };

      const result = await collection.findOneAndUpdate(
        { queryId },
        { 
          $push: { messages: newMessage },
          $set: { updatedAt: new Date() }
        },
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new Error('Query not found');
      }

      return newMessage;
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  // Get chat query by ID
  static async getChatQueryById(queryId: string): Promise<ChatQuery | null> {
    if (isBuildProcess) {
      console.log('Build process: Mocking getChatQueryById');
      return null;
    }
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection<ChatQuery>(this.collectionName);
      
      const query = await collection.findOne({ queryId });
      return query;
    } catch (error) {
      console.error('Error getting chat query:', error);
      throw error;
    }
  }

  // Get all chat queries
  static async getAllChatQueries(filters?: {
    status?: string;
    assignedTeam?: string;
    branch?: string;
    priority?: string;
    createdBy?: string;
  }): Promise<ChatQuery[]> {
    if (isBuildProcess) {
      console.log('Build process: Mocking getAllChatQueries');
      return [];
    }
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection<ChatQuery>(this.collectionName);
      
      const query: any = {};
      
      if (filters) {
        if (filters.status) query.status = filters.status;
        if (filters.assignedTeam) query.assignedTeam = { $in: [filters.assignedTeam] };
        if (filters.branch) query.branch = filters.branch;
        if (filters.priority) query.priority = filters.priority;
        if (filters.createdBy) query.createdBy = filters.createdBy;
      }

      const queries = await collection.find(query).sort({ createdAt: -1 }).toArray();
      return queries;
    } catch (error) {
      console.error('Error getting chat queries:', error);
      throw error;
    }
  }

  // Update query status
  static async updateQueryStatus(
    queryId: string, 
    status: 'pending' | 'resolved' | 'deferred' | 'otc',
    resolvedBy?: string,
    resolutionType?: 'approved' | 'deferral' | 'otc',
    resolutionDetails?: string
  ): Promise<ChatQuery | null> {
    if (isBuildProcess) {
      console.log('Build process: Mocking updateQueryStatus');
      return null;
    }
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection<ChatQuery>(this.collectionName);
      
      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      if (status === 'resolved' || status === 'deferred' || status === 'otc') {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = resolvedBy;
        updateData.resolutionType = resolutionType;
        updateData.resolutionDetails = resolutionDetails;
      }

      const result = await collection.findOneAndUpdate(
        { queryId },
        { $set: updateData },
        { returnDocument: 'after' }
      );

      return result;
    } catch (error) {
      console.error('Error updating query status:', error);
      throw error;
    }
  }

  // Get chat messages for a query
  static async getChatMessages(queryId: string): Promise<ChatMessage[]> {
    if (isBuildProcess) {
      console.log('Build process: Mocking getChatMessages');
      return [];
    }
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection<ChatQuery>(this.collectionName);
      
      const query = await collection.findOne({ queryId });
      return query?.messages || [];
    } catch (error) {
      console.error('Error getting chat messages:', error);
      throw error;
    }
  }

  // Search chat queries
  static async searchChatQueries(searchTerm: string): Promise<ChatQuery[]> {
    if (isBuildProcess) {
      console.log('Build process: Mocking searchChatQueries');
      return [];
    }
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection<ChatQuery>(this.collectionName);
      
      const queries = await collection.find({
        $or: [
          { title: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { caseNumber: { $regex: searchTerm, $options: 'i' } },
          { customerName: { $regex: searchTerm, $options: 'i' } },
          { employeeId: { $regex: searchTerm, $options: 'i' } }
        ]
      }).sort({ createdAt: -1 }).toArray();
      
      return queries;
    } catch (error) {
      console.error('Error searching chat queries:', error);
      throw error;
    }
  }

  // Get queries by case number
  static async getQueriesByCaseNumber(caseNumber: string): Promise<ChatQuery[]> {
    if (isBuildProcess) {
      console.log('Build process: Mocking getQueriesByCaseNumber');
      return [];
    }
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection<ChatQuery>(this.collectionName);
      
      const queries = await collection.find({ caseNumber }).sort({ createdAt: -1 }).toArray();
      return queries;
    } catch (error) {
      console.error('Error getting queries by case number:', error);
      throw error;
    }
  }

  // Get query statistics
  static async getQueryStatistics(filters?: {
    branch?: string;
    team?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{
    total: number;
    pending: number;
    resolved: number;
    deferred: number;
    otc: number;
    byPriority: { [key: string]: number };
    byTeam: { [key: string]: number };
  }> {
    if (isBuildProcess) {
      console.log('Build process: Mocking getQueryStatistics');
      return {
        total: 0,
        pending: 0,
        resolved: 0,
        deferred: 0,
        otc: 0,
        byPriority: {},
        byTeam: {}
      };
    }
    try {
      const { db } = await connectToDatabase();
      const collection = db.collection<ChatQuery>(this.collectionName);
      
      const matchQuery: any = {};
      
      if (filters) {
        if (filters.branch) matchQuery.branch = filters.branch;
        if (filters.team) matchQuery.assignedTeam = { $in: [filters.team] };
        if (filters.dateFrom || filters.dateTo) {
          matchQuery.createdAt = {};
          if (filters.dateFrom) matchQuery.createdAt.$gte = filters.dateFrom;
          if (filters.dateTo) matchQuery.createdAt.$lte = filters.dateTo;
        }
      }

      const stats = await collection.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
            resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
            deferred: { $sum: { $cond: [{ $eq: ['$status', 'deferred'] }, 1, 0] } },
            otc: { $sum: { $cond: [{ $eq: ['$status', 'otc'] }, 1, 0] } },
            priorities: { $push: '$priority' },
            teams: { $push: '$assignedTeam' }
          }
        }
      ]).toArray();

      const result = stats[0] || {
        total: 0,
        pending: 0,
        resolved: 0,
        deferred: 0,
        otc: 0,
        priorities: [],
        teams: []
      };

      // Count by priority
      const byPriority: { [key: string]: number } = {};
      result.priorities.forEach((priority: string) => {
        byPriority[priority] = (byPriority[priority] || 0) + 1;
      });

      // Count by team
      const byTeam: { [key: string]: number } = {};
      result.teams.forEach((teamArray: string[]) => {
        teamArray.forEach((team: string) => {
          byTeam[team] = (byTeam[team] || 0) + 1;
        });
      });

      return {
        total: result.total,
        pending: result.pending,
        resolved: result.resolved,
        deferred: result.deferred,
        otc: result.otc,
        byPriority,
        byTeam
      };
    } catch (error) {
      console.error('Error getting query statistics:', error);
      throw error;
    }
  }
}
