import { NextRequest, NextResponse } from 'next/server';
import { UserModel, CreateUserData } from '@/lib/models/User';

// GET - Get all users
export async function GET() {
  try {
    // Skip during build time
    if (process.env.BUILDING === 'true') {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    console.log('🔍 Fetching all users from database...');
    const users = await UserModel.getAllUsers();
    console.log(`✅ Found ${users.length} users in database`);
    
    return NextResponse.json({
      success: true,
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('💥 Error fetching users:', error);
    
    // Return empty data during build time
    if (process.env.BUILDING === 'true') {
      return NextResponse.json({
        success: true,
        data: []
      });
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to fetch users',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      },
      { status: 500 }
    );
  }
}

// POST - Create new user
export async function POST(request: NextRequest) {
  try {
    console.log('📝 Creating new user...');
    const body = await request.json();
    
    // Validate required fields
    const { employeeId, fullName, email, phone, password, role, branch, department } = body;
    
    console.log('📋 User creation request:', { employeeId, fullName, email, role, branch, department });
    
    if (!employeeId || !fullName || !email || !phone || !password || !role || !branch || !department) {
      const missingFields = [];
      if (!employeeId) missingFields.push('employeeId');
      if (!fullName) missingFields.push('fullName');
      if (!email) missingFields.push('email');
      if (!phone) missingFields.push('phone');
      if (!password) missingFields.push('password');
      if (!role) missingFields.push('role');
      if (!branch) missingFields.push('branch');
      if (!department) missingFields.push('department');
      
      console.error('❌ Missing required fields:', missingFields);
      return NextResponse.json(
        { 
          success: false, 
          error: `Missing required fields: ${missingFields.join(', ')}`,
          requiredFields: ['employeeId', 'fullName', 'email', 'phone', 'password', 'role', 'branch', 'department']
        },
        { status: 400 }
      );
    }

    // Create username from employeeId
    const username = employeeId;

    const userData: CreateUserData = {
      username,
      email,
      password,
      role,
      fullName,
      employeeId,
      branch,
      department,
      permissions: body.permissions || []
    };

    console.log('🔄 Creating user in database...');
    const newUser = await UserModel.createUser(userData);
    console.log('✅ User created successfully:', newUser.employeeId);
    
    return NextResponse.json({
      success: true,
      data: newUser,
      message: `User ${fullName} created successfully with role ${role}`
    });
  } catch (error: any) {
    console.error('💥 Error creating user:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to create user',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 400 }
    );
  }
} 