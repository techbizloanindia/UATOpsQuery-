import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '@/lib/models/User';

// POST - Update user access rights
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    const { userId, role, branches, permissions } = body;
    
    if (!userId || !role) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: userId, role' 
        },
        { status: 400 }
      );
    }

    // Update user with new role and permissions
    const updateData: any = {
      role,
      permissions: permissions || []
    };

    // If branches are provided, store them in permissions as branch access
    if (branches && Array.isArray(branches)) {
      updateData.permissions = [
        ...updateData.permissions,
        ...branches.map((branch: string) => `branch:${branch}`)
      ];
    }

    const updatedUser = await UserModel.updateUser(userId, updateData);
    
    if (!updatedUser) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'User not found' 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'Access rights updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating access rights:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to update access rights' 
      },
      { status: 400 }
    );
  }
}

// GET - Get user access rights
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const role = searchParams.get('role');
    
    // Define access rights structure
    interface AccessRight {
      module: string;
      permissions: string[];
      description: string;
    }
    
    interface RoleAccess {
      role: string;
      accessRights: AccessRight[];
    }
    
    const accessRights: Record<string, RoleAccess> = {
      operations: {
        role: 'operations',
        accessRights: [
          { module: 'sanctioned_cases', permissions: ['read', 'write'], description: 'View and manage sanctioned cases' },
          { module: 'query_raised', permissions: ['read', 'write', 'approve', 'defer', 'otc'], description: 'Manage raised queries' },
          { module: 'query_resolved', permissions: ['read'], description: 'View resolved queries' },
          { module: 'add_query', permissions: ['create'], description: 'Create new queries' }
        ]
      },
      sales: {
        role: 'sales',
        accessRights: [
          { module: 'sales_queries', permissions: ['read', 'write'], description: 'View and respond to sales queries' },
          { module: 'applications', permissions: ['read'], description: 'View application details' }
        ]
      },
      credit: {
        role: 'credit',
        accessRights: [
          { module: 'credit_queries', permissions: ['read', 'write'], description: 'View and respond to credit queries' },
          { module: 'applications', permissions: ['read'], description: 'View application details' }
        ]
      },
      admin: {
        role: 'admin',
        accessRights: [
          { module: 'all', permissions: ['read', 'write', 'delete', 'admin'], description: 'Full system access' }
        ]
      }
    };

    if (role && accessRights[role]) {
      return NextResponse.json({
        success: true,
        data: accessRights[role]
      });
    }

    return NextResponse.json({
      success: true,
      data: Object.values(accessRights)
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('Error fetching access rights:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to fetch access rights: ${errorMessage}`
      },
      { status: 500 }
    );
  }
}