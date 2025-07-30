import { NextRequest, NextResponse } from 'next/server';
import { UserModel } from '@/lib/models/User';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employeeId, password } = body;

    console.log('🔐 Login attempt for employee ID:', employeeId);

    if (!employeeId || !password) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Employee ID and password are required' 
        },
        { status: 400 }
      );
    }

    // Check for production admin credentials
    const adminUsername = process.env.ADMIN_USERNAME || 'AashishSrivastava2025';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Bizloan@2025';

    if (employeeId === adminUsername && password === adminPassword) {
      console.log('✅ Admin login successful for:', employeeId);
      return NextResponse.json({
        success: true,
        user: {
          employeeId,
          name: 'Aashish Srivastava',
          role: 'admin',
          isAuthenticated: true,
          fullName: 'Aashish Srivastava',
          email: 'admin@bizloanindia.com',
          branch: 'Head Office',
          department: 'Administration'
        },
        message: 'Admin login successful'
      });
    }

    // Authenticate against MongoDB users
    try {
      console.log('🔍 Looking up user by employee ID:', employeeId);
      
      // Find user by employee ID
      const user = await UserModel.getUserByEmployeeId(employeeId);
      
      if (!user) {
        console.log('❌ User not found:', employeeId);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid employee ID or password',
            code: 'USER_NOT_FOUND'
          },
          { status: 401 }
        );
      }

      if (!user.isActive) {
        console.log('❌ User account inactive:', employeeId);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Account is inactive. Please contact administrator.',
            code: 'ACCOUNT_INACTIVE'
          },
          { status: 401 }
        );
      }

      // Check if user has proper access rights assigned
      // Operations users with 'Unassigned' branch and no permissions means access rights not set
      const hasAccessRights = (user.role && user.role !== 'operations') || 
                             (user.role === 'operations' && user.branch !== 'Unassigned') || 
                             (user.permissions && user.permissions.length > 0);
      
      if (!hasAccessRights) {
        console.log('❌ User has no access rights assigned:', employeeId);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Account exists but access rights not assigned. Please contact administrator.',
            code: 'NO_ACCESS_RIGHTS',
            details: {
              employeeId: user.employeeId,
              fullName: user.fullName,
              needsAccessRights: true
            }
          },
          { status: 403 }
        );
      }

      // Get user with password for verification
      const { db } = await import('@/lib/mongodb').then(mod => mod.connectToDatabase());
      const collection = db.collection('users');
      const userWithPassword = await collection.findOne({ employeeId });

      if (!userWithPassword) {
        console.log('❌ Could not retrieve user with password:', employeeId);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Authentication failed',
            code: 'AUTH_ERROR'
          },
          { status: 500 }
        );
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, userWithPassword.password);
      if (!isValidPassword) {
        console.log('❌ Invalid password for user:', employeeId);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid employee ID or password',
            code: 'INVALID_CREDENTIALS'
          },
          { status: 401 }
        );
      }

      // Update last login
      await UserModel.updateUser(user._id!.toString(), { lastLogin: new Date() });

      console.log('✅ Login successful for user:', employeeId, 'Role:', user.role);

      // Return user data without password
      const { password: userPassword, ...userWithoutPassword } = user;
      
      return NextResponse.json({
        success: true,
        user: {
          ...userWithoutPassword,
          isAuthenticated: true
        },
        message: `Login successful. Welcome, ${user.fullName}!`
      });

    } catch (dbError: unknown) {
      const errorMessage = dbError instanceof Error ? dbError.message : 'Database error occurred';
      console.error('💥 Database authentication error:', dbError);
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Authentication service temporarily unavailable. Please try again.',
          code: 'SERVICE_UNAVAILABLE',
          details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
        },
        { status: 503 }
      );
    }

  } catch (error: any) {
    console.error('💥 Login error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Login failed. Please try again.',
        code: 'GENERAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error?.message : undefined
      },
      { status: 500 }
    );
  }
} 