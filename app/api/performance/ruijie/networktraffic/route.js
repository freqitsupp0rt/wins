import { NextResponse } from 'next/server';
import axios from 'axios';
import { getRuijieToken } from "@/lib/getToken";

export async function POST(request) {
  try {
    const ruijieToken = await getRuijieToken();
    const body = await request.json();
    const { sn, startDate, endDate } = body;

    if (!sn) {
      return NextResponse.json(
        { error: 'Serial number is required' },
        { status: 400 }
      );
    }

    const response = await axios.post(
      'https://cloud-as.ruijienetworks.com/logbizagent/logbiz/api/flow/show/hour',
      {
        sn,
        startDate,
        endDate
      },
      {
        params: { access_token: ruijieToken }
      }
    );

    return NextResponse.json(response.data);
    
  } catch (error) {
    console.error('Ruijie Performance API error:', error.response?.data || error.message);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch Ruijie performance data',
        details: error.response?.data || error.message 
      },
      { status: 500 }
    );
  }
}