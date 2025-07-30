import { NextRequest, NextResponse } from 'next/server';
import { ApplicationModel, CreateApplicationData } from '@/lib/models/Application';

// Helper function to parse CSV properly handling quoted fields
function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  // Add the last field
  result.push(current.trim());
  return result;
}

// Helper function to parse dates in various formats
function parseDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  
  // Try different date formats
  const formats = [
    /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
    /(\d{2})\/(\d{2})\/(\d{4})/, // MM/DD/YYYY
    /(\d{2})-(\d{2})-(\d{4})/, // MM-DD-YYYY
    /(\d{2})\.(\d{2})\.(\d{4})/, // MM.DD.YYYY
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      if (format === formats[0]) { // YYYY-MM-DD
        return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
      } else { // MM/DD/YYYY, MM-DD-YYYY, MM.DD.YYYY
        return new Date(parseInt(match[3]), parseInt(match[1]) - 1, parseInt(match[2]));
      }
    }
  }
  
  // Fallback to Date constructor
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? new Date() : date;
}

export async function POST(request: NextRequest) {
  try {
    console.log('📁 Bulk upload request received');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      console.log('❌ No file provided');
      return NextResponse.json(
        { 
          success: false, 
          error: 'No file provided',
          help: 'Please select a CSV file to upload'
        },
        { status: 400 }
      );
    }

    console.log(`📋 Processing file: ${file.name}, Size: ${file.size} bytes, Type: ${file.type}`);

    // Validate file type
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      console.log('❌ Invalid file type:', file.type);
      return NextResponse.json(
        { 
          success: false, 
          error: `Invalid file type: ${file.type}. Only CSV files are allowed`,
          help: 'Please upload a file with .csv extension'
        },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      console.log('❌ File too large:', file.size);
      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      return NextResponse.json(
        { 
          success: false, 
          error: `File size too large: ${sizeMB}MB. Maximum allowed size is 10MB`,
          help: 'Please reduce the file size or split it into smaller files'
        },
        { status: 400 }
      );
    }

    // Read file content
    const fileContent = await file.text();
    const lines = fileContent.split('\n').filter(line => line.trim());

    console.log(`📊 File contains ${lines.length} lines`);

    if (lines.length < 2) {
      console.log('❌ Insufficient data in file');
      return NextResponse.json(
        { 
          success: false, 
          error: 'CSV file must contain header and at least one data row' 
        },
        { status: 400 }
      );
    }

    // Parse CSV header using improved parser
    const header = parseCSVLine(lines[0]).map(col => col.toLowerCase().trim().replace(/\s+/g, '_'));
    
    console.log('📋 CSV Headers found:', header);
    
    // Updated required fields mapping for user's specific requirements
    const requiredFields = [
      { 
        field: 'app_no', 
        alternatives: ['app.no', 'app_no', 'appno', 'application_no', 'application_number', 'app_id', 'id'] 
      },
      { 
        field: 'customer_name', 
        alternatives: ['name', 'customer_name', 'customer', 'client_name', 'applicant_name'] 
      },
      { 
        field: 'branch_name', 
        alternatives: ['branchname', 'branch_name', 'branch', 'location'] 
      },
      { 
        field: 'task_name', 
        alternatives: ['taskname', 'task_name', 'status', 'app_status', 'application_status'] 
      }
    ];

    const columnMapping: { [key: string]: number } = {};
    const missingFields = [];

    for (const required of requiredFields) {
      let found = false;
      for (const alt of required.alternatives) {
        const index = header.indexOf(alt);
        if (index !== -1) {
          columnMapping[required.field] = index;
          found = true;
          break;
        }
      }
      if (!found) {
        missingFields.push(required.field);
      }
    }
    
    if (missingFields.length > 0) {
      console.log('❌ Missing required columns:', missingFields);
      console.log('💡 Available columns:', header);
      return NextResponse.json(
        { 
          success: false, 
          error: `Missing required columns: ${missingFields.join(', ')}. Found columns: ${header.join(', ')}`,
          suggestion: 'Please ensure your CSV has columns: App.No, Name, BranchName, and TaskName. Column names are case-insensitive.',
          availableColumns: header,
          requiredColumns: ['App.No', 'Name', 'BranchName', 'TaskName'],
          optionalColumns: ['AppDate', 'LoanNo', 'Amount', 'Email', 'Login', 'Asset Type', 'Sanction Amount']
        },
        { status: 400 }
      );
    }

    console.log('✅ Column mapping:', columnMapping);

    // Updated optional column mapping for user's specific requirements
    const optionalMapping: { [key: string]: number } = {};
    const optionalFields = [
      { field: 'app_date', alternatives: ['appdate', 'app_date', 'application_date', 'date', 'applied_date'] },
      { field: 'loan_no', alternatives: ['loanno', 'loan_no', 'loan_number', 'loan_id'] },
      { field: 'amount', alternatives: ['amount', 'loan_amount', 'requested_amount'] },
      { field: 'sanction_amount', alternatives: ['sanction_amount', 'sanctioned_amount', 'approved_amount', 'final_amount'] },
      { field: 'email', alternatives: ['email', 'email_id', 'customer_email'] },
      { field: 'login', alternatives: ['login', 'employee_id', 'user_id', 'staff_id'] },
      { field: 'asset_type', alternatives: ['asset_type', 'asset', 'collateral_type', 'security_type'] },
      { field: 'app_status', alternatives: ['app_status', 'application_status', 'current_status'] }
    ];
    
    for (const fieldObj of optionalFields) {
      for (const alt of fieldObj.alternatives) {
        const index = header.indexOf(alt);
        if (index !== -1) {
          optionalMapping[fieldObj.field] = index;
          break;
        }
      }
    }

    console.log('📋 Optional column mapping:', optionalMapping);

    // Parse data rows and create applications
    const applications: CreateApplicationData[] = [];
    const errors: string[] = [];
    const skippedRows: string[] = [];
    let processedRows = 0;

    for (let i = 1; i < lines.length; i++) {
      try {
        const row = parseCSVLine(lines[i]);
        
        if (row.length < Math.max(...Object.values(columnMapping)) + 1) {
          errors.push(`Row ${i + 1}: Insufficient columns (expected at least ${Math.max(...Object.values(columnMapping)) + 1}, got ${row.length})`);
          continue;
        }

        // Extract required fields with enhanced cleaning
        const appNo = row[columnMapping.app_no]?.trim().replace(/\s+/g, ' ') || '';
        const customerName = row[columnMapping.customer_name]?.trim().replace(/\s+/g, ' ') || '';
        const branchName = row[columnMapping.branch_name]?.trim().replace(/\s+/g, ' ') || '';
        const taskNameRaw = row[columnMapping.task_name]?.trim() || '';

        // Validate required fields
        if (!appNo || !customerName || !branchName || !taskNameRaw) {
          errors.push(`Row ${i + 1}: Missing required data - App.No: "${appNo}", Name: "${customerName}", Branch: "${branchName}", TaskName: "${taskNameRaw}"`);
          continue;
        }

        // FILTER FOR SANCTION DATA ONLY - Enhanced sanction detection
        const taskNameLower = taskNameRaw.toLowerCase();
        const sanctionKeywords = [
          'sanction', 'sanctioned', 'approved', 'disbursed', 'disbursement',
          'documentation', 'final approval', 'completed', 'ready for disbursement',
          'loan sanctioned', 'sanctioned loan', 'documentation complete',
          'approval', 'approved loan', 'loan approved'
        ];

        const isSanctioned = sanctionKeywords.some(keyword => 
          taskNameLower.includes(keyword)
        );

        if (!isSanctioned) {
          skippedRows.push(`Row ${i + 1}: Non-sanctioned status "${taskNameRaw}" - skipped`);
          continue;
        }

        // Extract optional fields
        const appDate = optionalMapping.app_date !== undefined ? 
          row[optionalMapping.app_date]?.trim() : '';
        const loanNo = optionalMapping.loan_no !== undefined ? 
          row[optionalMapping.loan_no]?.trim() || '' : '';
        const amount = optionalMapping.amount !== undefined ? 
          parseFloat(row[optionalMapping.amount]?.replace(/[^\d.-]/g, '') || '0') : 0;
        const sanctionAmount = optionalMapping.sanction_amount !== undefined ? 
          parseFloat(row[optionalMapping.sanction_amount]?.replace(/[^\d.-]/g, '') || '0') : 0;
        const email = optionalMapping.email !== undefined ? 
          row[optionalMapping.email]?.trim() || '' : '';
        const login = optionalMapping.login !== undefined ? 
          row[optionalMapping.login]?.trim() || '' : '';
        const assetType = optionalMapping.asset_type !== undefined ? 
          row[optionalMapping.asset_type]?.trim() || 'Not Specified' : 'Not Specified';

        // Parse application date
        const appliedDate = appDate ? parseDate(appDate) : new Date();

        // Use sanction amount if available, otherwise use regular amount
        const finalAmount = sanctionAmount > 0 ? sanctionAmount : (amount > 0 ? amount : undefined);

        // Create application data with enhanced mapping
        const applicationData: CreateApplicationData = {
          appId: appNo,
          customerName,
          branch: branchName,
          status: 'sanctioned' as const, // Always sanctioned since we filter for sanction data
          amount: finalAmount,
          appliedDate,
          priority: 'medium', // Default priority
          loanType: assetType !== 'Not Specified' ? assetType : 'Personal Loan',
          customerPhone: '', // Not in user's requirements
          customerEmail: email,
          documentStatus: 'Completed', // Sanctioned applications typically have completed docs
          remarks: `Imported from CSV - Original Status: ${taskNameRaw}${loanNo ? `, Loan No: ${loanNo}` : ''}${login ? `, Employee: ${login}` : ''}`,
          uploadedBy: 'Bulk Upload System'
        };

        applications.push(applicationData);
        processedRows++;
        
        console.log(`✅ Row ${i + 1}: Processed sanctioned application ${appNo} for ${customerName}`);
        
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        errors.push(`Row ${i + 1}: ${errorMessage}`);
      }
    }

    console.log(`📊 Processing Summary:`);
    console.log(`- Total rows processed: ${processedRows}`);
    console.log(`- Sanctioned applications found: ${applications.length}`);
    console.log(`- Rows skipped (non-sanctioned): ${skippedRows.length}`);
    console.log(`- Errors encountered: ${errors.length}`);

    if (applications.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No sanctioned applications found in CSV file',
          details: [
            'Only applications with sanction-related statuses are imported.',
            'Sanction keywords: sanction, sanctioned, approved, disbursed, documentation, final approval, completed',
            ...errors.slice(0, 3),
            ...skippedRows.slice(0, 3)
          ],
          summary: {
            totalRows: lines.length - 1,
            processedRows,
            sanctionedFound: 0,
            skippedNonSanctioned: skippedRows.length,
            errors: errors.length
          }
        },
        { status: 400 }
      );
    }

    // Bulk create applications in database
    console.log('💾 Creating sanctioned applications in database...');
    const result = await ApplicationModel.bulkCreateApplications(applications);
    
    console.log(`✅ Database operation complete: ${result.success} created, ${result.failed} failed`);

    // Combine all feedback
    const allFeedback = [...errors, ...skippedRows];

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        fileSize: file.size,
        totalRows: lines.length - 1,
        processedRows: processedRows,
        sanctionedRows: applications.length,
        skippedRows: skippedRows.length,
        createdApplications: result.success,
        failedApplications: result.failed,
        errors: errors.length,
        errorDetails: allFeedback.slice(0, 15), // Return first 15 items
        summary: {
          uploaded: result.success,
          failed: result.failed + errors.length,
          skipped: skippedRows.length,
          total: lines.length - 1,
          validRows: processedRows,
          sanctionedOnly: applications.length
        },
        applicationStats: {
          created: result.success,
          failed: result.failed,
          duplicates: result.errors.filter(e => e.includes('already exists')).length,
          validationErrors: errors.length,
          nonSanctioned: skippedRows.length
        },
        columnMapping: {
          required: columnMapping,
          optional: optionalMapping,
          detected: header
        }
      },
      message: result.success > 0 
        ? `Successfully uploaded ${result.success} sanctioned applications to Operations Dashboard! ${skippedRows.length > 0 ? `${skippedRows.length} non-sanctioned applications were automatically skipped. ` : ''}${errors.length > 0 ? `${errors.length} rows had errors. ` : ''}Only sanctioned applications from TaskName are imported for operations processing.`
        : `Upload processed but no sanctioned applications were created. ${skippedRows.length > 0 ? `${skippedRows.length} non-sanctioned applications were skipped. ` : ''}${errors.length > 0 ? `${errors.length} errors occurred. ` : ''}Only sanctioned applications are imported.`
    });

  } catch (error: unknown) {
    console.error('💥 Bulk upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to process file: ${errorMessage}`,
        details: 'Please check the file format and ensure it contains the required columns: App.No, Name, BranchName, TaskName.'
      },
      { status: 500 }
    );
  }
} 