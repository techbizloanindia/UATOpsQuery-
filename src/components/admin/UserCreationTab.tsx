'use client';

import React, { useState, useEffect } from 'react';
import { UserRole } from '@/types/shared';

interface User {
  _id?: string;
  employeeId: string;
  fullName: string;
  email: string;
  role: string;
  branch: string;
  department: string;
  isActive: boolean;
  createdAt: string;
}

interface Branch {
  _id: string;
  branchCode: string;
  branchName: string;
  isActive: boolean;
}

interface EditModalData {
  isOpen: boolean;
  user: User | null;
  type: 'password' | 'details';
}

interface DeleteModalData {
  isOpen: boolean;
  user: User | null;
}

const UserCreationTab = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [editModal, setEditModal] = useState<EditModalData>({ isOpen: false, user: null, type: 'password' });
  const [deleteModal, setDeleteModal] = useState<DeleteModalData>({ isOpen: false, user: null });
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [editFormData, setEditFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'operations' as UserRole,
    selectedBranches: [] as string[]
  });
  const [editSelectAll, setEditSelectAll] = useState(false);

  const [formData, setFormData] = useState({
    employeeId: '',
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'operations' as UserRole,
    selectedBranches: [] as string[]
  });

  const [selectAll, setSelectAll] = useState(false);

  // Fetch users and branches on component mount
  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      const result = await response.json();
      
      if (result.success) {
        setUsers(result.data);
      } else {
        console.error('Failed to fetch users:', result.error);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const response = await fetch('/api/branches?isActive=true');
      const result = await response.json();
      if (result.success) {
        setBranches(result.data);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    }
  };

  // Get active branch names for the UI
  const activeBranchNames = branches.filter(branch => branch.isActive).map(branch => branch.branchName);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleRoleChange = (role: UserRole) => {
    setFormData(prev => ({
      ...prev,
      role
    }));
  };

  const handleBranchChange = (branch: string) => {
    setFormData(prev => ({
      ...prev,
      selectedBranches: prev.selectedBranches.includes(branch)
        ? prev.selectedBranches.filter(b => b !== branch)
        : [...prev.selectedBranches, branch]
    }));
  };

  const handleSelectAllBranches = () => {
    if (selectAll) {
      setFormData(prev => ({ ...prev, selectedBranches: [] }));
    } else {
      setFormData(prev => ({ ...prev, selectedBranches: [...activeBranchNames] }));
    }
    setSelectAll(!selectAll);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match!");
      return;
    }
    
    if (!formData.employeeId || !formData.fullName || !formData.email || !formData.phone || !formData.password) {
      alert("Please fill all fields!");
      return;
    }

    if (formData.selectedBranches.length === 0) {
      alert("Please select at least one branch for the user!");
      return;
    }

    try {
      setLoading(true);
      
      // Create user first
      const userResponse = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employeeId: formData.employeeId,
          fullName: formData.fullName,
          email: formData.email,
          phone: formData.phone,
          password: formData.password,
          role: formData.role,
          branch: formData.selectedBranches.length === 1 ? formData.selectedBranches[0] : 'Multiple',
          department: 'General'
        }),
      });

      const userResult = await userResponse.json();
      
      if (userResult.success) {
        // Now assign access rights
        const accessResponse = await fetch('/api/access-rights', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: userResult.data._id,
            role: formData.role,
            branches: formData.selectedBranches,
            permissions: []
          }),
        });

        const accessResult = await accessResponse.json();
        
        if (accessResult.success) {
          alert(`User ${formData.fullName} created successfully with ${formData.role} role and access to ${formData.selectedBranches.length} branch(es)!`);
          
          // Reset form
          setFormData({
            employeeId: '',
            fullName: '',
            email: '',
            phone: '',
            password: '',
            confirmPassword: '',
            role: 'operations',
            selectedBranches: []
          });
          setSelectAll(false);
          
          fetchUsers(); // Refresh the user list
        } else {
          alert(`User created but failed to assign access rights: ${accessResult.error}`);
        }
      } else {
        alert(`Failed to create user: ${userResult.error}`);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert('Failed to create user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openEditPasswordModal = (user: User) => {
    setEditModal({ isOpen: true, user, type: 'password' });
    setNewPassword('');
    setConfirmNewPassword('');
  };

  const openEditDetailsModal = async (user: User) => {
    setEditModal({ isOpen: true, user, type: 'details' });
    
    // Load user's current details and branch permissions
    setEditFormData({
      fullName: user.fullName,
      email: user.email,
      phone: '', // Will be loaded from API
      role: user.role as UserRole,
      selectedBranches: []
    });

    // Fetch user's branch permissions
    if (user._id) {
      try {
        const response = await fetch(`/api/users/${user._id}`);
        const result = await response.json();
        if (result.success && result.data.permissions) {
          const branchPermissions = result.data.permissions
            .filter((perm: string) => perm.startsWith('branch:'))
            .map((perm: string) => perm.replace('branch:', ''));
          setEditFormData(prev => ({ ...prev, selectedBranches: branchPermissions }));
        }
      } catch (error) {
        console.error('Error loading user details:', error);
      }
    }
  };

  const closeEditModal = () => {
    setEditModal({ isOpen: false, user: null, type: 'password' });
    setNewPassword('');
    setConfirmNewPassword('');
    setEditFormData({
      fullName: '',
      email: '',
      phone: '',
      role: 'operations',
      selectedBranches: []
    });
    setEditSelectAll(false);
  };

  const openDeleteModal = (user: User) => {
    setDeleteModal({ isOpen: true, user });
  };

  const closeDeleteModal = () => {
    setDeleteModal({ isOpen: false, user: null });
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmNewPassword) {
      alert("New passwords do not match!");
      return;
    }

    if (!editModal.user || !editModal.user._id) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/users/${editModal.user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: newPassword }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`Password for ${editModal.user.fullName} updated successfully!`);
        closeEditModal();
        fetchUsers(); // Refresh the user list
      } else {
        alert(`Failed to update password: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating password:', error);
      alert('Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditRoleChange = (role: UserRole) => {
    setEditFormData(prev => ({
      ...prev,
      role
    }));
  };

  const handleEditBranchChange = (branch: string) => {
    setEditFormData(prev => ({
      ...prev,
      selectedBranches: prev.selectedBranches.includes(branch)
        ? prev.selectedBranches.filter(b => b !== branch)
        : [...prev.selectedBranches, branch]
    }));
  };

  const handleEditSelectAllBranches = () => {
    if (editSelectAll) {
      setEditFormData(prev => ({ ...prev, selectedBranches: [] }));
    } else {
      setEditFormData(prev => ({ ...prev, selectedBranches: [...activeBranchNames] }));
    }
    setEditSelectAll(!editSelectAll);
  };

  const handleUserDetailsUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editModal.user || !editModal.user._id) return;

    if (editFormData.selectedBranches.length === 0) {
      alert("Please select at least one branch for the user!");
      return;
    }

    try {
      setLoading(true);
      
      // Update user details
      const userResponse = await fetch(`/api/users/${editModal.user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: editFormData.fullName,
          email: editFormData.email,
          role: editFormData.role,
          branch: editFormData.selectedBranches.length === 1 ? editFormData.selectedBranches[0] : 'Multiple',
        }),
      });

      const userResult = await userResponse.json();
      
      if (userResult.success) {
        // Update access rights
        const accessResponse = await fetch('/api/access-rights', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: editModal.user._id,
            role: editFormData.role,
            branches: editFormData.selectedBranches,
            permissions: []
          }),
        });

        const accessResult = await accessResponse.json();
        
        if (accessResult.success) {
          alert(`User ${editFormData.fullName} updated successfully!`);
          closeEditModal();
          fetchUsers(); // Refresh the user list
        } else {
          alert(`User updated but failed to update access rights: ${accessResult.error}`);
        }
      } else {
        alert(`Failed to update user: ${userResult.error}`);
      }
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteModal.user || !deleteModal.user._id) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/users/${deleteModal.user._id}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`User ${deleteModal.user.fullName} deleted successfully!`);
        closeDeleteModal();
        fetchUsers(); // Refresh the user list
      } else {
        alert(`Failed to delete user: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* User Creation Form */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-gray-900 mb-2">👤 Create New User Account & Assign Access</h3>
        <p className="text-sm text-gray-600 mb-2">Create user accounts with complete role and branch access assignment.</p>
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">
            <strong>✅ Complete Setup:</strong> User creation now includes role assignment and branch access configuration.
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6 bg-gradient-to-br from-white to-cyan-50 p-6 rounded-lg border-2 border-cyan-200 shadow-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 mb-2">
              Employee ID
            </label>
            <input
              type="text"
              name="employeeId"
              id="employeeId"
              value={formData.employeeId}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-gray-900 transition-all duration-200"
              placeholder="Enter employee ID"
            />
          </div>
          
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              name="fullName"
              id="fullName"
              value={formData.fullName}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-gray-900 transition-all duration-200"
              placeholder="Enter full name"
            />
          </div>
          
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              id="email"
              value={formData.email}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-gray-900 transition-all duration-200"
              placeholder="Enter email address"
            />
          </div>
          
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              id="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-gray-900 transition-all duration-200"
              placeholder="Enter phone number"
            />
          </div>


          
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                id="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3 pr-12 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-gray-900 transition-all duration-200"
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                id="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="w-full px-4 py-3 pr-12 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-gray-900 transition-all duration-200"
                placeholder="Confirm password"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-500 hover:text-gray-700"
              >
                {showConfirmPassword ? (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Role Selection */}
        <div className="border-t border-gray-200 pt-8">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Role Assignment</h3>
          <p className="mt-1 text-sm text-gray-500">Define the user's role and permissions.</p>
          <fieldset className="mt-4">
            <legend className="sr-only">Role</legend>
            <div className="space-y-4 sm:flex sm:items-center sm:space-y-0 sm:space-x-10">
              <div className="flex items-center">
                <input
                  id="role-ops"
                  name="role"
                  type="radio"
                  checked={formData.role === 'operations'}
                  onChange={() => handleRoleChange('operations')}
                  className="focus:ring-cyan-500 h-4 w-4 text-cyan-600 border-gray-300"
                />
                <label htmlFor="role-ops" className="ml-3 block text-sm font-medium text-gray-700">
                  Operations
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="role-credit"
                  name="role"
                  type="radio"
                  checked={formData.role === 'credit'}
                  onChange={() => handleRoleChange('credit')}
                  className="focus:ring-cyan-500 h-4 w-4 text-cyan-600 border-gray-300"
                />
                <label htmlFor="role-credit" className="ml-3 block text-sm font-medium text-gray-700">
                  Credit
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="role-sales"
                  name="role"
                  type="radio"
                  checked={formData.role === 'sales'}
                  onChange={() => handleRoleChange('sales')}
                  className="focus:ring-cyan-500 h-4 w-4 text-cyan-600 border-gray-300"
                />
                <label htmlFor="role-sales" className="ml-3 block text-sm font-medium text-gray-700">
                  Sales
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="role-admin"
                  name="role"
                  type="radio"
                  checked={formData.role === 'admin'}
                  onChange={() => handleRoleChange('admin')}
                  className="focus:ring-cyan-500 h-4 w-4 text-cyan-600 border-gray-300"
                />
                <label htmlFor="role-admin" className="ml-3 block text-sm font-medium text-gray-700">
                  Admin
                </label>
              </div>
            </div>
          </fieldset>
        </div>

        {/* Branch Access */}
        <div className="border-t border-gray-200 pt-8">
          <h3 className="text-lg font-medium leading-6 text-gray-900">Branch Access</h3>
          <p className="mt-1 text-sm text-gray-500">Select the branches this user will have access to.</p>
          <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
            {/* Select All */}
            <div className="flex items-center mb-4 pb-4 border-b border-gray-300">
              <input
                id="selectAllBranches"
                type="checkbox"
                checked={selectAll}
                onChange={handleSelectAllBranches}
                className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
              />
              <label htmlFor="selectAllBranches" className="ml-3 text-sm font-bold text-gray-700">
                Select All ({activeBranchNames.length} branches)
              </label>
            </div>

            {/* Branch Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {activeBranchNames.map((branch) => (
                <div key={branch} className="flex items-center">
                  <input
                    id={`branch-${branch.toLowerCase().replace(/\s+/g, '')}`}
                    type="checkbox"
                    checked={formData.selectedBranches.includes(branch)}
                    onChange={() => handleBranchChange(branch)}
                    className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                  />
                  <label
                    htmlFor={`branch-${branch.toLowerCase().replace(/\s+/g, '')}`}
                    className="ml-3 text-sm text-gray-700 truncate"
                    title={branch}
                  >
                    {branch}
                  </label>
                </div>
              ))}
            </div>

            {/* Selected Count */}
            {formData.selectedBranches.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-300">
                <p className="text-sm text-cyan-600 font-medium">
                  {formData.selectedBranches.length} branch{formData.selectedBranches.length !== 1 ? 'es' : ''} selected
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Summary */}
        {formData.fullName && formData.role && formData.selectedBranches.length > 0 && (
          <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-lg font-medium text-blue-900 mb-3">User Creation Summary</h4>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Name:</span> {formData.fullName}</p>
              <p><span className="font-medium">Employee ID:</span> {formData.employeeId}</p>
              <p><span className="font-medium">Role:</span> {formData.role.charAt(0).toUpperCase() + formData.role.slice(1)}</p>
              <p><span className="font-medium">Branches:</span> {formData.selectedBranches.length} selected</p>
              {formData.selectedBranches.length > 0 && formData.selectedBranches.length <= 5 && (
                <p className="text-blue-700"><span className="font-medium">Selected branches:</span> {formData.selectedBranches.join(', ')}</p>
              )}
            </div>
          </div>
        )}
        
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex justify-center py-3 px-6 border border-transparent rounded-lg text-white bg-cyan-600 hover:bg-cyan-700 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating User...
              </>
            ) : (
              'Create User'
            )}
          </button>
        </div>
      </form>

      {/* User List */}
      <div className="mt-12">
        <h3 className="text-lg font-medium text-gray-900 mb-4">User List ({users.length})</h3>
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <svg className="animate-spin h-8 w-8 text-cyan-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white divide-y divide-gray-200 rounded-lg shadow">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                      No users created yet
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user._id || user.employeeId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.employeeId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.fullName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                          user.role === 'operations' ? 'bg-blue-100 text-blue-800' :
                          user.role === 'sales' ? 'bg-green-100 text-green-800' :
                          user.role === 'credit' ? 'bg-orange-100 text-orange-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.branch}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-3">
                          <button
                            onClick={() => openEditDetailsModal(user)}
                            className="text-cyan-600 hover:text-cyan-800 transition-colors duration-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => openEditPasswordModal(user)}
                            className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
                          >
                            Password
                          </button>
                          <button
                            onClick={() => openDeleteModal(user)}
                            className="text-red-600 hover:text-red-800 transition-colors duration-200"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editModal.isOpen && editModal.type === 'password' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Edit Password for <span className="font-bold text-cyan-600">{editModal.user?.fullName}</span>
            </h3>
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div>
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-gray-900"
                  placeholder="Enter new password"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="confirmNewPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  id="confirmNewPassword"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-gray-900"
                  placeholder="Confirm new password"
                  required
                />
              </div>
              
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors duration-200"
                >
                  Save Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Details Modal */}
      {editModal.isOpen && editModal.type === 'details' && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl p-6 mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Edit User Details for <span className="font-bold text-cyan-600">{editModal.user?.fullName}</span>
            </h3>
            <form onSubmit={handleUserDetailsUpdate} className="space-y-6">
              {/* Basic Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="editFullName" className="block text-sm font-bold text-black mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="editFullName"
                    name="fullName"
                    value={editFormData.fullName}
                    onChange={handleEditInputChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-black bg-white font-bold"
                    style={{ color: '#000000', backgroundColor: '#ffffff', fontWeight: '700' }}
                    required
                  />
                </div>
                
                <div>
                  <label htmlFor="editEmail" className="block text-sm font-bold text-black mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="editEmail"
                    name="email"
                    value={editFormData.email}
                    onChange={handleEditInputChange}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-black bg-white font-bold"
                    style={{ color: '#000000', backgroundColor: '#ffffff', fontWeight: '700' }}
                    required
                  />
                </div>
              </div>

              {/* Role Selection */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">Role Assignment</h4>
                <div className="space-y-4 sm:flex sm:items-center sm:space-y-0 sm:space-x-10">
                  <div className="flex items-center">
                    <input
                      id="edit-role-ops"
                      name="editRole"
                      type="radio"
                      checked={editFormData.role === 'operations'}
                      onChange={() => handleEditRoleChange('operations')}
                      className="focus:ring-cyan-500 h-4 w-4 text-cyan-600 border-gray-300"
                    />
                    <label htmlFor="edit-role-ops" className="ml-3 block text-sm font-medium text-gray-700">
                      Operations
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="edit-role-credit"
                      name="editRole"
                      type="radio"
                      checked={editFormData.role === 'credit'}
                      onChange={() => handleEditRoleChange('credit')}
                      className="focus:ring-cyan-500 h-4 w-4 text-cyan-600 border-gray-300"
                    />
                    <label htmlFor="edit-role-credit" className="ml-3 block text-sm font-medium text-gray-700">
                      Credit
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="edit-role-sales"
                      name="editRole"
                      type="radio"
                      checked={editFormData.role === 'sales'}
                      onChange={() => handleEditRoleChange('sales')}
                      className="focus:ring-cyan-500 h-4 w-4 text-cyan-600 border-gray-300"
                    />
                    <label htmlFor="edit-role-sales" className="ml-3 block text-sm font-medium text-gray-700">
                      Sales
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      id="edit-role-admin"
                      name="editRole"
                      type="radio"
                      checked={editFormData.role === 'admin'}
                      onChange={() => handleEditRoleChange('admin')}
                      className="focus:ring-cyan-500 h-4 w-4 text-cyan-600 border-gray-300"
                    />
                    <label htmlFor="edit-role-admin" className="ml-3 block text-sm font-medium text-gray-700">
                      Admin
                    </label>
                  </div>
                </div>
              </div>

              {/* Branch Access */}
              <div className="border-t border-gray-200 pt-6">
                <h4 className="text-md font-medium text-gray-900 mb-3">Branch Access</h4>
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  {/* Select All */}
                  <div className="flex items-center mb-4 pb-4 border-b border-gray-300">
                    <input
                      id="editSelectAllBranches"
                      type="checkbox"
                      checked={editSelectAll}
                      onChange={handleEditSelectAllBranches}
                      className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                    />
                    <label htmlFor="editSelectAllBranches" className="ml-3 text-sm font-bold text-gray-700">
                      Select All ({activeBranchNames.length} branches)
                    </label>
                  </div>

                  {/* Branch Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {activeBranchNames.map((branch) => (
                      <div key={branch} className="flex items-center">
                        <input
                          id={`edit-branch-${branch.toLowerCase().replace(/\s+/g, '')}`}
                          type="checkbox"
                          checked={editFormData.selectedBranches.includes(branch)}
                          onChange={() => handleEditBranchChange(branch)}
                          className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                        />
                        <label
                          htmlFor={`edit-branch-${branch.toLowerCase().replace(/\s+/g, '')}`}
                          className="ml-3 text-sm text-gray-700 truncate"
                          title={branch}
                        >
                          {branch}
                        </label>
                      </div>
                    ))}
                  </div>

                  {/* Selected Count */}
                  {editFormData.selectedBranches.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-300">
                      <p className="text-sm text-cyan-600 font-medium">
                        {editFormData.selectedBranches.length} branch{editFormData.selectedBranches.length !== 1 ? 'es' : ''} selected
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center px-4 py-2 text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors duration-200 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : (
                    'Update User'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Delete User
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-bold text-red-600">{deleteModal.user?.fullName}</span>? 
              This action cannot be undone and will permanently remove the user and all associated data.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  'Delete User'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserCreationTab; 