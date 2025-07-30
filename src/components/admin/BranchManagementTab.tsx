'use client';

import React, { useState, useEffect } from 'react';


interface Branch {
  _id: string;
  branchCode: string;
  branchName: string;
  city: string;
  state: string;
  isActive: boolean;
  createdAt: Date;
}

export default function BranchManagementTab() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    city: '',
    state: '',
    isActive: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchBranches();
  }, []);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/branches');
      const result = await response.json();
      if (result.success) {
        setBranches(result.data);
      } else {
        console.error('Failed to fetch branches:', result.error);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setLoading(false);
    }
  };

  const states = [
    'Delhi', 'Haryana', 'Uttar Pradesh', 'Rajasthan', 'Karnataka', 'Maharashtra',
    'Andhra Pradesh', 'Gujarat', 'Madhya Pradesh', 'Tamil Nadu', 'West Bengal'
  ];

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Branch name is required';
    }

    if (!formData.code.trim()) {
      newErrors.code = 'Branch code is required';
    } else if (formData.code.length < 2 || formData.code.length > 5) {
      newErrors.code = 'Branch code must be 2-5 characters';
    } else if (branches.some(branch => branch.branchCode.toLowerCase() === formData.code.toLowerCase())) {
      newErrors.code = 'Branch code already exists';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setLoading(true);
      const response = await fetch('/api/branches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          city: formData.city.trim(),
          state: formData.state.trim(),
          isActive: formData.isActive,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`Branch "${formData.name}" created successfully!`);
        // Reset form
        setFormData({
          name: '',
          code: '',
          city: '',
          state: '',
          isActive: true,
        });
        setErrors({});
        setIsCreating(false);
        fetchBranches(); // Refresh the branch list
      } else {
        alert(`Failed to create branch: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating branch:', error);
      alert('Failed to create branch. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setFormData({
      name: '',
      code: '',
      city: '',
      state: '',
      isActive: true,
    });
    setErrors({});
  };

  const toggleBranchStatus = async (branchId: string, currentStatus: boolean) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/branches/${branchId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !currentStatus,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        fetchBranches(); // Refresh the branch list
      } else {
        alert(`Failed to update branch status: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating branch status:', error);
      alert('Failed to update branch status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteBranch = async (branchId: string, branchName: string) => {
    if (!confirm(`Are you sure you want to delete "${branchName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/branches/${branchId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`Branch "${branchName}" deleted successfully!`);
        fetchBranches(); // Refresh the branch list
      } else {
        alert(`Failed to delete branch: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting branch:', error);
      alert('Failed to delete branch. Please try again.');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center bg-gradient-to-r from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
        <div>
          <h3 className="text-2xl font-bold text-orange-800">🏢 Branch Management</h3>
          <p className="text-orange-600 font-medium mt-1">Manage your business branches and locations</p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition-colors shadow-lg font-semibold"
          >
            ➕ Add New Branch
          </button>
        )}
      </div>

      {/* Create Branch Form */}
      {isCreating && (
        <div className="bg-gradient-to-br from-white to-orange-50 p-6 rounded-lg border-2 border-orange-200 shadow-xl">
          <h4 className="text-2xl font-bold text-orange-800 mb-2">✨ Create New Branch</h4>
          <p className="text-orange-600 font-medium mb-6">Fill in the details to add a new branch location</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-base font-bold text-orange-800 mb-2">
                  🏷️ Branch Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 font-medium bg-white ${
                    errors.name ? 'border-red-500' : 'border-orange-300'
                  }`}
                  placeholder="Enter branch name (e.g., New Delhi Central)"
                />
                {errors.name && <p className="text-red-600 font-semibold text-sm mt-1">⚠️ {errors.name}</p>}
              </div>

              <div>
                <label className="block text-base font-bold text-orange-800 mb-2">
                  🔤 Branch Code *
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 font-medium bg-white ${
                    errors.code ? 'border-red-500' : 'border-orange-300'
                  }`}
                  placeholder="Enter branch code (e.g., NDC)"
                  maxLength={5}
                />
                {errors.code && <p className="text-red-600 font-semibold text-sm mt-1">⚠️ {errors.code}</p>}
              </div>

              <div>
                <label className="block text-base font-bold text-orange-800 mb-2">
                  🏙️ City *
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 font-medium bg-white ${
                    errors.city ? 'border-red-500' : 'border-orange-300'
                  }`}
                  placeholder="Enter city name"
                />
                {errors.city && <p className="text-red-600 font-semibold text-sm mt-1">⚠️ {errors.city}</p>}
              </div>

              <div>
                <label className="block text-base font-bold text-orange-800 mb-2">
                  🗺️ State *
                </label>
                <select
                  value={formData.state}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className={`w-full px-4 py-3 border-2 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-gray-900 font-medium bg-white ${
                    errors.state ? 'border-red-500' : 'border-orange-300'
                  }`}
                >
                  <option value="" className="text-gray-500">Select State</option>
                  {states.map(state => (
                    <option key={state} value={state} className="text-gray-900">{state}</option>
                  ))}
                </select>
                {errors.state && <p className="text-red-600 font-semibold text-sm mt-1">⚠️ {errors.state}</p>}
              </div>
            </div>

            <div className="flex items-center space-x-3 bg-orange-50 p-3 rounded-lg border border-orange-200">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => handleInputChange('isActive', e.target.checked)}
                className="w-5 h-5 text-orange-600 border-orange-300 rounded focus:ring-orange-500"
              />
              <label htmlFor="isActive" className="text-base font-bold text-orange-800">
                ✅ Active Branch (Available for assignment)
              </label>
            </div>

            <div className="flex space-x-4 pt-6">
              <button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-8 py-3 rounded-lg transition-all duration-200 font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : (
                  '✨ Create Branch'
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading}
                className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white px-8 py-3 rounded-lg transition-all duration-200 font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ❌ Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Branches Table */}
      <div className="bg-gradient-to-br from-white to-orange-50 rounded-lg border-2 border-orange-200 shadow-xl">
        <div className="p-6 border-b-2 border-orange-200 bg-gradient-to-r from-orange-100 to-orange-200">
          <h4 className="text-2xl font-bold text-orange-800">
            📋 All Branches ({branches.length})
          </h4>
          <p className="text-orange-600 font-medium mt-1">Complete list of all business locations</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-orange-200 to-orange-300">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-bold text-orange-900 uppercase tracking-wider">
                  🏷️ Branch Details
                </th>
                <th className="px-6 py-4 text-left text-sm font-bold text-orange-900 uppercase tracking-wider">
                  📍 Location
                </th>
                <th className="px-6 py-4 text-left text-sm font-bold text-orange-900 uppercase tracking-wider">
                  🔄 Status
                </th>
                <th className="px-6 py-4 text-left text-sm font-bold text-orange-900 uppercase tracking-wider">
                  📅 Created Date
                </th>
                <th className="px-6 py-4 text-left text-sm font-bold text-orange-900 uppercase tracking-wider">
                  ⚙️ Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-orange-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-orange-600">
                    <svg className="animate-spin h-8 w-8 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading branches...
                  </td>
                </tr>
              ) : (
                branches.map((branch, index) => (
                  <tr key={branch._id} className={`hover:bg-orange-50 transition-colors ${index % 2 === 0 ? 'bg-orange-25' : 'bg-white'}`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-base font-bold text-orange-900">{branch.branchName}</div>
                        <div className="text-sm font-semibold text-orange-600">🔤 Code: {branch.branchCode}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-base font-bold text-gray-900">{branch.city}</div>
                      <div className="text-sm font-semibold text-gray-600">{branch.state}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-2 text-sm font-bold rounded-full shadow-sm ${
                        branch.isActive 
                          ? 'bg-green-200 text-green-800 border-2 border-green-300' 
                          : 'bg-red-200 text-red-800 border-2 border-red-300'
                      }`}>
                        {branch.isActive ? '✅ Active' : '❌ Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">
                      📅 {new Date(branch.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-3">
                        <button
                          onClick={() => toggleBranchStatus(branch._id, branch.isActive)}
                          disabled={loading}
                          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                            branch.isActive
                              ? 'bg-yellow-200 text-yellow-800 hover:bg-yellow-300 border-2 border-yellow-400'
                              : 'bg-green-200 text-green-800 hover:bg-green-300 border-2 border-green-400'
                          }`}
                        >
                          {branch.isActive ? '⏸️ Deactivate' : '▶️ Activate'}
                        </button>
                        <button
                          onClick={() => deleteBranch(branch._id, branch.branchName)}
                          disabled={loading}
                          className="px-4 py-2 bg-red-200 text-red-800 rounded-lg text-sm font-bold hover:bg-red-300 transition-all duration-200 shadow-md border-2 border-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {branches.length === 0 && (
          <div className="p-12 text-center bg-orange-50 border-t-2 border-orange-200">
            <div className="text-6xl mb-4">🏢</div>
            <h3 className="text-xl font-bold text-orange-800 mb-2">No Branches Found</h3>
            <p className="text-orange-600 font-medium">Create your first branch to get started with your business locations.</p>
          </div>
        )}
      </div>
    </div>
  );
} 