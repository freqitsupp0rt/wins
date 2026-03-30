import { NextResponse } from 'next/server';
import axios from 'axios';
import { getRuijieToken } from "@/lib/getToken";

export async function POST(request) {
  try {
    const body = await request.json();
    const { startDate, endDate, groupId, type = 'day' } = body;

    // Validate required fields
    if (!startDate || !endDate || !groupId) {
      return NextResponse.json(
        { 
          code: 400, 
          msg: 'Missing required fields: startDate, endDate, and groupId are required' 
        },
        { status: 400 }
      );
    }

    // Validate dates are numbers
    if (isNaN(startDate) || isNaN(endDate)) {
      return NextResponse.json(
        { 
          code: 400, 
          msg: 'startDate and endDate must be valid timestamps (milliseconds)' 
        },
        { status: 400 }
      );
    }

    // Get Ruijie access token
    const ruijieToken = await getRuijieToken();

    // Make request to Ruijie API
    const response = await axios.post(
      `https://cloud-as.ruijienetworks.com/logbizagent/logbiz/api/sta/building/sta_users?access_token=${ruijieToken}`,
      {
        startDate: String(startDate),
        endDate: String(endDate),
        groupId: String(groupId),
        type: type
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      }
    );

    // Return the Ruijie API response
    return NextResponse.json(response.data);

  } catch (error) {
    console.error('Ruijie Users Report API error:', error.response?.data || error.message);
    
    // Handle specific error cases
    let errorCode = 500;
    let errorMessage = 'Failed to fetch user statistics';
    
    if (error.response) {
      errorCode = error.response.status;
      errorMessage = error.response.data?.msg || error.response.statusText;
    } else if (error.request) {
      errorMessage = 'No response received from Ruijie API';
    } else {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { 
        code: errorCode,
        msg: errorMessage,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: errorCode }
    );
  }
}

// Optional: Also support GET method for convenience
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const groupId = searchParams.get('groupId');
  const type = searchParams.get('type') || 'day';
  
  if (!startDate || !endDate || !groupId) {
    return NextResponse.json(
      { 
        code: 400, 
        msg: 'Missing required query parameters: startDate, endDate, and groupId' 
      },
      { status: 400 }
    );
  }

  try {
    // Reuse the POST logic
    const response = await POST({
      json: async () => ({ startDate, endDate, groupId, type })
    });
    
    return response;
  } catch (error) {
    return NextResponse.json(
      { 
        code: 500,
        msg: 'Failed to process GET request'
      },
      { status: 500 }
    );
  }
}