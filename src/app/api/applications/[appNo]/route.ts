import { NextRequest, NextResponse } from 'next/server';
import { ApplicationModel } from '@/lib/models/Application';

// GET - Get application details by App.No
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ appNo: string }> }
) {
  try {
    const { appNo: rawAppNo } = await params;
    
    if (!rawAppNo) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'App.No is required' 
        },
        { status: 400 }
      );
    }

    // Decode URL encoding and trim whitespace
    const appNo = decodeURIComponent(rawAppNo).trim();
    
    console.log(`🔍 API: Searching for application: "${appNo}" (original: "${rawAppNo}")`);

    // Search for application by App.No
    const application = await ApplicationModel.getApplicationByAppId(appNo);
    
    if (!application) {
      console.log(`❌ API: Application not found for App.No: "${appNo}"`);
      
      // Get a few sample applications to help with debugging
      const sampleApplications = await ApplicationModel.getAllApplications({ limit: 5 });
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Application not found',
          details: `No application found with App.No: "${appNo}"`,
          suggestion: 'Please check the App.No format and try again. App.No should match exactly as it appears in the database.',
          debug: {
            searchedFor: appNo,
            originalParam: rawAppNo,
            decodedParam: decodeURIComponent(rawAppNo),
            trimmedParam: appNo,
            sampleApplications: sampleApplications.map(app => ({
              appId: app.appId,
              customerName: app.customerName,
              status: app.status
            }))
          }
        },
        { status: 404 }
      );
    }

    console.log(`✅ API: Found application: ${application.appId} - ${application.customerName}`);

    // Format application data for the frontend with enhanced data handling
    const applicationDetails = {
      appNo: application.appId,
      customerName: application.customerName,
      loanAmount: application.amount ? application.amount.toLocaleString() : 'Not specified',
      status: application.status,
      customerPhone: application.customerPhone || 'Not provided',
      customerEmail: application.customerEmail || 'Not provided',
      address: `${application.branch} Branch Area`,
      pincode: 'Not specified',
      city: (application.branch?.includes('-') ? application.branch.split('-')[1] : application.branch) || 'Not specified',
      state: 'Not specified',
      employeeId: application.uploadedBy || 'System Generated',
      branchName: application.branch,
      loanType: application.loanType || 'Personal Loan',
      appliedDate: application.appliedDate ? new Date(application.appliedDate).toLocaleDateString('en-IN') : 'Not specified',
      lastUpdated: new Date(application.lastUpdated).toLocaleDateString('en-IN'),
      sanctionedAmount: application.amount ? application.amount.toLocaleString() : 'Same as loan amount',
      sanctionedDate: application.sanctionedDate ? new Date(application.sanctionedDate).toLocaleDateString('en-IN') : 'Not specified',
      tenure: '24-60 months',
      interestRate: '8.5-12.5% p.a.',
      processingFee: '1-3% of loan amount',
      cibilScore: 750,
      monthlyIncome: 'As per documents',
      companyName: 'As per application',
      designation: 'As per documents',
      workExperience: '2+ years'
    };

    return NextResponse.json({
      success: true,
      data: applicationDetails
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error('💥 API Error fetching application:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: `Failed to fetch application: ${errorMessage}`,
        details: 'There was an error searching for the application. Please try again.'
      },
      { status: 500 }
    );
  }
} 