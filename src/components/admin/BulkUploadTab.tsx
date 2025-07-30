'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FaUpload, FaTrash, FaFile, FaClock, FaCheckCircle, FaExclamationCircle, FaTimes } from 'react-icons/fa';

interface UploadResult {
  success: boolean;
  data?: {
    fileName: string;
    fileSize: number;
    totalRows: number;
    createdApplications: number;
    failedApplications: number;
    summary: {
      uploaded: number;
      failed: number;
      skipped: number;
      total: number;
    };
  };
  message?: string;
  error?: string;
  suggestion?: string;
  availableColumns?: string[];
}

interface UploadedFile {
  id: string;
  fileName: string;
  fileSize: number;
  uploadDate: Date;
  status: 'uploaded' | 'processing' | 'completed' | 'error';
  result?: UploadResult;
  totalRows?: number;
  uploadedRows?: number;
  errorMessage?: string;
}

const BulkUploadTab = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load uploaded files from localStorage on component mount
  useEffect(() => {
    const savedFiles = localStorage.getItem('uploadedFiles');
    if (savedFiles) {
      try {
        const files = JSON.parse(savedFiles);
        setUploadedFiles(files.map((file: any) => ({
          ...file,
          uploadDate: new Date(file.uploadDate)
        })));
      } catch (error) {
        console.error('Error loading uploaded files:', error);
      }
    }
  }, []);

  // Save uploaded files to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('uploadedFiles', JSON.stringify(uploadedFiles));
  }, [uploadedFiles]);

  const handleFileSelect = (file: File) => {
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setUploadError('Please select a CSV file');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      setUploadError('File size must be less than 10MB');
      return;
    }
    
    setSelectedFile(file);
    setUploadError(null);
    setUploadResult(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadError('Please select a file first');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadResult(null);

    // Add file to uploaded files list with processing status
    const fileId = Date.now().toString();
    const newUploadedFile: UploadedFile = {
      id: fileId,
      fileName: selectedFile.name,
      fileSize: selectedFile.size,
      uploadDate: new Date(),
      status: 'processing'
    };
    
    setUploadedFiles(prev => [newUploadedFile, ...prev]);
    
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      console.log('📤 Uploading file:', selectedFile.name);
      
      const response = await fetch('/api/bulk-upload', {
        method: 'POST',
        body: formData,
      });

      console.log('📡 Response status:', response.status);
      
      let result: UploadResult;
      try {
        result = await response.json();
        console.log('📊 Upload result:', result);
      } catch (parseError) {
        throw new Error(`Server returned invalid response. Status: ${response.status}`);
      }
      
      if (response.ok && result.success) {
        // Success - update file status and show inline success message
        setUploadedFiles(prev => prev.map(file => 
          file.id === fileId 
            ? { 
                ...file, 
                status: 'completed',
                result,
                totalRows: result.data?.totalRows,
                uploadedRows: result.data?.createdApplications
              }
            : file
        ));
        
        setUploadResult(result);
        setUploadError(null);
        
        // Clear the form
        setSelectedFile(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } else {
        // Error - update file status and show inline error message
        let errorMessage = result.error || 'Upload failed';
        
        if (result.suggestion) {
          errorMessage += `\n\n${result.suggestion}`;
        }
        
        if (result.availableColumns && result.availableColumns.length > 0) {
          errorMessage += `\n\nAvailable columns in your CSV: ${result.availableColumns.join(', ')}`;
        }

        setUploadedFiles(prev => prev.map(file => 
          file.id === fileId 
            ? { 
                ...file, 
                status: 'error',
                errorMessage: errorMessage
              }
            : file
        ));
        
        setUploadError(errorMessage);
        setUploadResult(null);
      }
    } catch (error: any) {
      console.error('💥 Upload error:', error);
      
      let errorMessage = 'Upload failed: ';
      
      if (error.message.includes('status: 400')) {
        errorMessage += 'There\'s an issue with your CSV file format. Please check the required columns: App.No, Customer Name, Branch Name, and Status.';
      } else if (error.message.includes('status: 500')) {
        errorMessage += 'Server error occurred while processing your file. Please try again.';
      } else {
        errorMessage += error.message;
      }

      setUploadedFiles(prev => prev.map(file => 
        file.id === fileId 
          ? { 
              ...file, 
              status: 'error',
              errorMessage: errorMessage
            }
          : file
      ));
      
      setUploadError(errorMessage);
      setUploadResult(null);
    } finally {
      setIsUploading(false);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setUploadError(null);
    setUploadResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const deleteUploadedFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(file => file.id !== fileId));
    
    // Clear current results if deleting the current upload
    setUploadResult(null);
    setUploadError(null);
  };

  const clearAllFiles = () => {
    setUploadedFiles([]);
    setUploadResult(null);
    setUploadError(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <FaCheckCircle className="text-green-500" />;
      case 'processing':
        return <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>;
      case 'error':
        return <FaExclamationCircle className="text-red-500" />;
      default:
        return <FaClock className="text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return 'Completed';
      case 'processing':
        return 'Processing...';
      case 'error':
        return 'Error';
      default:
        return 'Uploaded';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'processing':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header Section */}
      <div className="mb-8 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-blue-800 mb-2">📄 Sanctioned Applications Bulk Upload</h3>
            <p className="text-blue-600 font-medium">Upload CSV files with sanctioned applications for operations processing. Only sanctioned applications will be imported.</p>
          </div>
          <div className="text-6xl opacity-20">📊</div>
        </div>
        
        {/* Success Flow Info */}
        <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="text-sm font-bold text-green-800 mb-2">✅ Upload Process Flow:</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center font-bold">1</div>
              <span className="text-green-700 font-medium">Upload CSV File</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center font-bold">2</div>
              <span className="text-blue-700 font-medium">Filter Sanctioned Only</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center font-bold">3</div>
              <span className="text-purple-700 font-medium">Database Storage</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center font-bold">4</div>
              <span className="text-orange-700 font-medium">Operations Dashboard</span>
            </div>
          </div>
        </div>

        {/* Enhanced Requirements Alert */}
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h4 className="text-sm font-bold text-amber-800 mb-2">⚠️ Important: Sanctioned Applications Only</h4>
          <div className="text-xs text-amber-700 space-y-1">
            <p><strong>✓ Sanctioned Keywords:</strong> sanction, sanctioned, approved, disbursed, documentation, final approval, completed</p>
            <p><strong>⚠️ Skipped Statuses:</strong> pending, under review, rejected, verification, KYC pending (automatically filtered out)</p>
            <p><strong>📊 Result:</strong> Only applications with sanctioned status in TaskName will be imported to Operations Dashboard</p>
          </div>
        </div>
      </div>

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-bold text-gray-800 flex items-center">
              <FaFile className="mr-2 text-blue-500" />
              Uploaded Files ({uploadedFiles.length})
            </h4>
            <button
              onClick={clearAllFiles}
              className="text-red-600 hover:text-red-800 font-medium text-sm flex items-center"
            >
              <FaTimes className="mr-1" />
              Clear All
            </button>
          </div>
          
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {uploadedFiles.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(file.status)}
                    <FaFile className="text-gray-500" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{file.fileName}</p>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span>{formatFileSize(file.fileSize)}</span>
                      <span>{formatDate(file.uploadDate)}</span>
                      {file.uploadedRows && file.totalRows && (
                        <span className="text-green-600 font-medium">
                          {file.uploadedRows}/{file.totalRows} rows imported
                        </span>
                      )}
                    </div>
                    {file.errorMessage && (
                      <p className="text-red-600 text-sm mt-1 truncate" title={file.errorMessage}>
                        {file.errorMessage}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(file.status)}`}>
                    {getStatusText(file.status)}
                  </span>
                  
                  <button
                    onClick={() => deleteUploadedFile(file.id)}
                    className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors"
                    title="Delete file"
                  >
                    <FaTrash className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* File Upload Section */}
      <div className="mb-8">
        <div
          className={`flex justify-center px-6 pt-10 pb-12 border-2 border-dashed rounded-xl transition-all duration-300 cursor-pointer ${
            isDragOver
              ? 'border-cyan-500 bg-cyan-50 scale-105'
              : selectedFile
              ? 'border-green-400 bg-green-50 shadow-lg'
              : 'border-gray-300 bg-gray-50 hover:bg-cyan-50 hover:border-cyan-500 hover:scale-105'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="space-y-4 text-center">
            {selectedFile ? (
              // File Selected State
              <div>
                <svg className="mx-auto h-16 w-16 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 48 48">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-lg text-gray-700">
                  <p className="font-bold text-green-600 text-xl">{selectedFile.name}</p>
                  <p className="text-gray-500 mt-1">{formatFileSize(selectedFile.size)} • CSV File</p>
                  <div className="flex items-center justify-center mt-2">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                      ✓ Ready for Upload
                    </span>
                  </div>
                </div>
                <div className="mt-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      clearFile();
                    }}
                    className="text-gray-500 hover:text-gray-700 font-medium text-sm"
                  >
                    Choose Different File
                  </button>
                </div>
              </div>
            ) : (
              // Default Upload State
              <div>
                <FaUpload className="mx-auto h-16 w-16 text-gray-400" />
                <div className="text-lg text-gray-700">
                  <p className="font-bold text-xl">Upload your CSV file</p>
                  <p className="text-gray-500 mt-1">Drag and drop or click to browse</p>
                </div>
                <div className="text-sm text-gray-500 mt-2">
                  <p>Supported format: CSV • Max size: 10MB</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileInputChange}
          className="sr-only"
        />
      </div>

      {/* Upload Button */}
      <div className="flex justify-center mb-8">
        <button
          type="button"
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className={`inline-flex justify-center items-center py-4 px-8 border border-transparent shadow-lg text-lg font-bold rounded-xl text-white transition-all duration-200 ${
            !selectedFile || isUploading
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 focus:outline-none focus:ring-4 focus:ring-cyan-300 transform hover:scale-105'
          }`}
        >
          {isUploading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-6 w-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing Upload...
            </>
          ) : (
            <>
              <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              🚀 Upload Sanctioned Applications to Operations Dashboard
            </>
          )}
        </button>
      </div>

      {/* Instructions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Upload Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h4 className="text-lg font-bold text-blue-900 mb-4 flex items-center">
            <span className="mr-2">📋</span> CSV Upload Requirements
          </h4>
          <div className="space-y-3 text-sm text-blue-800">
            <div className="flex items-start space-x-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>File Format:</strong> CSV files only (.csv extension)</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>File Size:</strong> Maximum 10MB per upload</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-red-600 font-bold">●</span>
              <span><strong>Required Columns:</strong> App.No, Name, BranchName, TaskName</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-blue-600 font-bold">○</span>
              <span><strong>Optional Columns:</strong> AppDate, LoanNo, Amount, Email, Login, Asset Type, Sanction Amount</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-purple-600 font-bold">★</span>
              <span><strong>Sanction Filter:</strong> Only applications with sanctioned status in TaskName are imported</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-orange-600 font-bold">⚡</span>
              <span><strong>Auto-Processing:</strong> Non-sanctioned applications are automatically skipped</span>
            </div>
            <div className="flex items-start space-x-2">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Real-time Availability:</strong> Immediate access in Operations Dashboard after upload</span>
            </div>
          </div>
        </div>

        {/* CSV Format Requirements */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">📄</span> Required CSV Format
          </h4>
          
          <div className="mb-4">
            <h5 className="text-sm font-bold text-red-700 mb-2">🔴 Required Columns:</h5>
            <div className="text-sm text-gray-700">
              App.No, Name, BranchName, TaskName
            </div>
          </div>

          <div className="mb-4">
            <h5 className="text-sm font-bold text-blue-700 mb-2">🔵 Optional Columns:</h5>
            <div className="text-sm text-gray-700">
              AppDate, LoanNo, Amount, Email, Login, Asset Type, Sanction Amount
            </div>
          </div>

          <div className="mt-4 text-xs text-gray-600">
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2">
              <strong>📌 Important:</strong> Only rows with sanctioned status in TaskName will be imported. 
              Other statuses (pending, under review, rejected) will be automatically skipped.
            </div>
          </div>
        </div>
      </div>

      {/* Post-Upload Information */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
        <h4 className="text-lg font-bold text-green-900 mb-3 flex items-center">
          <span className="mr-2">🎯</span> After Successful Upload
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <div className="text-green-600 font-bold mb-2">📊 Operations Dashboard</div>
            <div className="text-gray-700">Sanctioned applications appear in the Operations Dashboard for team processing and query management.</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <div className="text-blue-600 font-bold mb-2">🏢 Branch-wise Organization</div>
            <div className="text-gray-700">Applications are organized by branch allowing targeted access and management by authorized users.</div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200">
            <div className="text-purple-600 font-bold mb-2">📝 Query Management</div>
            <div className="text-gray-700">Team members can raise queries, track progress, and resolve issues for each uploaded application.</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkUploadTab; 