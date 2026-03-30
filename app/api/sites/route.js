import { NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET() {
  let connection;
  
  try {
    // Get a connection from the pool
    connection = await pool.getConnection();
    
    const [sites] = await connection.execute(
      `SELECT 
        id, site_id as siteId, name, display_name as displayName, 
        site_code as siteCode, vendor, latitude, longitude, 
        address, region, group_id as groupId, 
        DATE_FORMAT(last_sync, '%Y-%m-%d %H:%i:%s') as lastSync,
        sync_status as syncStatus, 
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as createdAt
       FROM wins_sites 
       WHERE sync_status = 'active' AND name != 'LOT 6'
       ORDER BY vendor, name`
    );
    
    // Release the connection back to the pool
    connection.release();
    
    return NextResponse.json({
      success: true,
      totalRecords: sites.length,
      data: sites,
      timestamp: new Date().toISOString()
    });
    
  } catch (err) {
    console.error("Database error:", err);
    
    // Make sure to release connection on error
    if (connection) {
      connection.release();
    }
    
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch sites from database",
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
      },
      { status: 500 }
    );
  }
}