import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

function generateTrafficData(vendor, previousData) {
    const lowerTrafficBound = 100 * 1024 * 1024; // 100MB
    const upperTrafficBound = 5 * 1024 * 1024 * 1024; // 5GB
    const randomTrafficIncrement = 1 * 1024 * 1024 * 1024; // 1GB
    const maxTrendChange = 2 * 1024 * 1024 * 1024; // 2GB max change per day

    let baseTraffic;

    if (previousData && previousData.baseTraffic) {
        // Trend flow: adjust previous traffic by a random amount to create a trend
        // Bias towards increase: range from -80% to +100% of maxTrendChange
        const minChange = -Math.floor(maxTrendChange * 0.8);
        const change = Math.floor(Math.random() * (maxTrendChange - minChange + 1)) + minChange;
        baseTraffic = previousData.baseTraffic + change;
        // Clamp within bounds
        baseTraffic = Math.max(lowerTrafficBound, baseTraffic);
    } else {
        // Initial random start
        baseTraffic = Math.floor(Math.random() * (upperTrafficBound - lowerTrafficBound)) + lowerTrafficBound;
    }

    let rxBytes = 0;
    let txBytes = 0;

    if (vendor === 'omada') {
        // Rule: omada tx should be larger than rx
        rxBytes = baseTraffic;
        // TX is larger (add min 10MB to ensure strict inequality)
        txBytes = baseTraffic + Math.floor(Math.random() * randomTrafficIncrement) + (10 * 1024 * 1024);
    } else if (vendor === 'ruijie') {
        // Rule: ruijie rx should be larger than tx
        txBytes = baseTraffic;
        // RX is larger (add min 10MB to ensure strict inequality)
        rxBytes = baseTraffic + Math.floor(Math.random() * randomTrafficIncrement) + (10 * 1024 * 1024);
    } else {
        // Fallback for other vendors
        rxBytes = Math.floor(Math.random() * upperTrafficBound);
        txBytes = Math.floor(Math.random() * upperTrafficBound);
    }

    return { rxBytes, txBytes, baseTraffic };
}

function generateUsersData(vendor, isWeekend, previousData) {
    let lowerUserBound, upperUserBound, maxTrendChange;

    if (vendor === 'omada') {
        upperUserBound = isWeekend ? 50 : 99;
        lowerUserBound = isWeekend ? 5 : 20;
    } else if (vendor === 'ruijie') {
        upperUserBound = isWeekend ? 70 : 150;
        lowerUserBound = isWeekend ? 10 : 40;
    } else {
        upperUserBound = isWeekend ? 20 : 50;
        lowerUserBound = 1;
    }
    maxTrendChange = Math.max(5, Math.floor(upperUserBound * 0.2)); // Max change is 20% of upper bound, min 5

    let baseUsers;
    if (previousData && previousData.baseUsers) {
        // Trend flow for users, similar to traffic
        // Bias towards increase: range from -80% to +100% of maxTrendChange
        const minChange = -Math.floor(maxTrendChange * 0.8);
        const change = Math.floor(Math.random() * (maxTrendChange - minChange + 1)) + minChange;
        baseUsers = previousData.baseUsers + change;
        // Clamp within bounds for users
        baseUsers = Math.max(lowerUserBound, Math.min(upperUserBound, baseUsers));
    } else {
        // Initial random start for users
        baseUsers = Math.floor(Math.random() * (upperUserBound - lowerUserBound + 1)) + lowerUserBound;
    }

    const totalUsers = Math.floor(baseUsers);
    let activeUsers = 0;

    if (vendor === 'omada') {
        activeUsers = totalUsers; // Rule: omada total user and active user should be the same
    } else if (vendor === 'ruijie') {
        const activeRatio = 0.6 + (Math.random() * 0.3); // Active users roughly 60-90% of total
        activeUsers = Math.floor(totalUsers * activeRatio);
    } else {
        activeUsers = Math.floor(Math.random() * totalUsers);
    }

    return { totalUsers, activeUsers, baseUsers: totalUsers };
}

export async function POST(request) {
    let connection;
    try {
        const body = await request.json();
        const { siteId, dates, vendor, preview } = body;

        if (!siteId || !dates || !Array.isArray(dates) || dates.length === 0) {
            return NextResponse.json({ success: false, error: 'Invalid parameters' }, { status: 400 });
        }

        connection = await pool.getConnection();
        const recordsToInsert = [];
        const siteState = new Map();
        const normalizedVendor = (vendor || '').toLowerCase();

        // Sort dates to ensure trend flow works chronologically
        const sortedDates = [...dates].sort();

        for (const dateStr of sortedDates) {
            // Parse date to determine if it's a weekend (assuming YYYYMMDD format)
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1;
            const day = parseInt(dateStr.substring(6, 8));
            const dateObj = new Date(year, month, day);
            const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            const previousData = siteState.get(siteId);

            // --- Users Data Generation ---
            const { totalUsers, activeUsers, baseUsers } = generateUsersData(normalizedVendor, isWeekend, previousData);

            // --- Traffic Data Generation ---
            const { rxBytes, txBytes, baseTraffic } = generateTrafficData(normalizedVendor, previousData);

            // Push 'users' record
            recordsToInsert.push([
                siteId,
                dateStr,
                'users',
                totalUsers,
                activeUsers,
                0,
                0,
                'Auto-generated users (Gap Fill)'
            ]);

            // Push 'traffic' record
            recordsToInsert.push([
                siteId,
                dateStr,
                'traffic',
                0,
                0,
                rxBytes,
                txBytes,
                'Auto-generated traffic (Gap Fill)'
            ]);

            // Update state for next day
            siteState.set(siteId, { baseTraffic, baseUsers });
        }

        if (preview) {
            const previewData = recordsToInsert.map(r => ({
                site_id: r[0],
                date: r[1], // YYYYMMDD
                data_type: r[2],
                total_users: r[3],
                active_users: r[4],
                download_bytes: r[5],
                upload_bytes: r[6],
                notes: r[7]
            }));
            return NextResponse.json({ success: true, data: previewData });
        }

        if (recordsToInsert.length > 0) {
            const query = `
                INSERT INTO manual_data 
                (site_id, date, data_type, total_users, active_users, download_bytes, upload_bytes, notes) 
                VALUES ?
            `;
            await connection.query(query, [recordsToInsert]);
        }

        return NextResponse.json({ success: true, inserted: recordsToInsert.length });

    } catch (error) {
        console.error('Error populating data:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}