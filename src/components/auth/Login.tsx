'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { LoginCredentials, UserRole } from '@/types/shared';
import Image from 'next/image';



const Login = () => {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    employeeId: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userHasRole, setUserHasRole] = useState(false);
  const [isCheckingRole, setIsCheckingRole] = useState(false);
  const [userBranch, setUserBranch] = useState<string | null>(null);
  const [userBranchCode, setUserBranchCode] = useState<string | null>(null);
  
  const { login, isLoading } = useAuth();
  const router = useRouter();

  // Check if user has been assigned access rights
  const checkUserRole = async (employeeId: string): Promise<void> => {
    if (!employeeId.trim()) {
      setUserRole(null);
      setUserHasRole(false);
      setUserBranch(null);
      setUserBranchCode(null);
      return;
    }

    try {
      setIsCheckingRole(true);
      const response = await fetch(`/api/users/check-role?employeeId=${encodeURIComponent(employeeId)}`);
      const result = await response.json();
      
      if (result.success && result.data.hasRole) {
        setUserRole(result.data.role as UserRole);
        setUserHasRole(true);
        setUserBranch(result.data.branch || null);
        setUserBranchCode(result.data.branchCode || null);
      } else {
        setUserRole(null);
        setUserHasRole(false);
        setUserBranch(null);
        setUserBranchCode(null);
      }
    } catch (error) {
      console.error('Error checking user role:', error);
      setUserRole(null);
      setUserHasRole(false);
      setUserBranch(null);
      setUserBranchCode(null);
    } finally {
      setIsCheckingRole(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value,
    }));
    
    // Check user role as user types employee ID
    if (name === 'employeeId') {
      checkUserRole(value);
    }
    
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!credentials.employeeId || !credentials.password) {
      setError('Please fill in all fields');
      return;
    }

    // Prevent login if user doesn't have access rights (unless admin)
    if (!userHasRole && credentials.employeeId !== 'AashishSrivastava2025' && 
        credentials.employeeId !== 'ADMIN') {
      setError('Access rights not assigned. Please contact administrator to assign your role and branch permissions.');
      return;
    }

    try {
      // Attempt login
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      const result = await response.json();
      
      if (result.success) {
        // Login successful - update auth context
        const success = await login({
          ...credentials,
          branch: result.user.branch,
          branchCode: result.user.branchCode
        });
        
        if (success) {
          const role = result.user.role;
          console.log('🚀 Login successful, redirecting to:', role);
          
          switch (role) {
            case 'sales':
              router.push('/sales');
              break;
            case 'credit':
              router.push('/credit-dashboard');
              break;
            case 'operations':
              router.push('/operations');
              break;
            case 'admin':
              router.push('/admin-dashboard');
              break;
            default:
              router.push('/');
          }
        }
      } else {
        // Handle specific error codes
        console.error('Login failed:', result || 'Empty response');
        
        // Ensure result exists and has proper structure
        if (!result) {
          setError('Server error: No response received. Please try again.');
          return;
        }
        
        switch (result.code) {
          case 'USER_NOT_FOUND':
            setError('Employee ID not found. Please check your employee ID or contact administrator.');
            break;
          case 'ACCOUNT_INACTIVE':
            setError('Your account is inactive. Please contact administrator to reactivate your account.');
            break;
          case 'NO_ACCESS_RIGHTS':
            setError(`Account exists but access rights not assigned. Please contact administrator to assign your role and branch permissions.`);
            break;
          case 'INVALID_CREDENTIALS':
            setError('Invalid employee ID or password. Please check your credentials and try again.');
            break;
          case 'SERVICE_UNAVAILABLE':
            setError('Authentication service temporarily unavailable. Please try again in a few moments.');
            break;
          case 'AUTH_ERROR':
            setError('Authentication system error. Please contact technical support.');
            break;
          default:
            setError(result.error || 'Login failed. Please try again.');
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError('Network error. Please check your connection and try again.');
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const getRoleDisplayName = (role: UserRole) => {
    switch (role) {
      case 'sales':
        return 'Sales Team';
      case 'credit':
        return 'Credit Team';
      case 'operations':
        return 'Operations Team';
      case 'admin':
        return 'Administrator';
      default:
        return '';
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'sales':
        return 'text-blue-700 bg-blue-100 border-blue-300';
      case 'credit':
        return 'text-green-700 bg-green-100 border-green-300';
      case 'operations':
        return 'text-purple-700 bg-purple-100 border-purple-300';
      case 'admin':
        return 'text-orange-700 bg-orange-100 border-orange-300';
      default:
        return 'text-gray-700 bg-gray-100 border-gray-300';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-cyan-50 to-blue-100 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="mx-auto h-16 w-40 relative mb-4">
              <Image
                src="/logo.png"
                alt="Bizloan India - Employee Login Portal"
                fill
                sizes="160px"
                style={{ objectFit: 'contain' }}
                priority
              />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Operation Query Model</h2>
            <p className="text-gray-600">Please sign in to your account</p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Employee ID Field */}
            <div>
              <label htmlFor="employeeId" className="block text-sm font-medium text-gray-800 mb-2" style={{ color: '#1f2937' }}>
                Employee ID
              </label>
              <input
                id="employeeId"
                name="employeeId"
                type="text"
                required
                value={credentials.employeeId}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 outline-none text-gray-900 bg-white placeholder-gray-500"
                placeholder="Enter your employee ID"
                style={{ color: '#1f2937', backgroundColor: '#ffffff' }}
              />
              
              {/* User Role Feedback */}
              {credentials.employeeId && (
                <div className="mt-2">
                  {isCheckingRole ? (
                    <div className="text-sm text-gray-500">Checking access rights...</div>
                  ) : userHasRole ? (
                    <div className="flex flex-col space-y-1">
                      <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getRoleColor(userRole!)}`}>
                        <span className="mr-1">✓</span> {getRoleDisplayName(userRole!)}
                      </div>
                      {userBranch && (
                        <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-cyan-100 text-cyan-800 border border-cyan-300">
                          <span className="mr-1">🏢</span> {userBranch} {userBranchCode ? `(${userBranchCode})` : ''}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium text-red-700 bg-red-100 border border-red-300">
                      <span className="mr-1">✗</span> No access rights assigned
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-800 mb-2" style={{ color: '#1f2937' }}>
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={credentials.password}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all duration-200 outline-none pr-12 text-gray-900 bg-white placeholder-gray-500"
                  placeholder="Enter your password"
                  style={{ color: '#1f2937', backgroundColor: '#ffffff' }}
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Login Button */}
            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>

            {/* Control Panel Link */}
            <div className="text-center">
              <Link href="/control-panel" className="text-sm text-cyan-600 hover:text-cyan-800 font-medium">
                Go to Control Panel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login; 