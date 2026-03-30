/**
 * scripts/populate_manual_data.js
 * 
 * Usage: node scripts/populate_manual_data.js
 * 
 * Prerequisites:
 * npm install mysql2 dayjs
 */

const mysql = require("mysql2/promise");
const dayjs = require("dayjs");

// --- CONFIGURATION ---
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: '', // Update with your database password
    database: 'wins_db' // Update with your actual database name
};

const START_DATE = '2025-11-03';
const END_DATE = '2025-12-02';

/**
 * Generates random traffic data for a given site vendor.
 * This logic is based on the data processing found in Generate.jsx
 * to ensure the generated data mimics the expected structure for charts.
 * @param {string} vendor - The vendor of the site ('omada', 'ruijie', etc.).
 * @param {object} previousData - The previous day's traffic data for trend flow.
 * @returns {{rxBytes: number, txBytes: number, baseTraffic: number}}
 */
function generateTrafficData(vendor, previousData) {
    const lowerTrafficBound = 100 * 1024 * 1024; // 100MB
    const upperTrafficBound = 5 * 1024 * 1024 * 1024; // 5GB
    const randomTrafficIncrement = 1 * 1024 * 1024 * 1024; // 1GB
    const maxTrendChange = 500 * 1024 * 1024; // 500MB max change per day

    let baseTraffic;

    if (previousData && previousData.baseTraffic) {
        // Trend flow: adjust previous traffic by a random amount to create a trend
        const change = Math.floor(Math.random() * (maxTrendChange * 2 + 1)) - maxTrendChange;
        baseTraffic = previousData.baseTraffic + change;
        // Clamp within bounds
        baseTraffic = Math.max(lowerTrafficBound, Math.min(upperTrafficBound, baseTraffic));
    } else {
        // Initial random start
        baseTraffic = Math.floor(Math.random() * (upperTrafficBound - lowerTrafficBound)) + lowerTrafficBound;
    }

    let rxBytes = 0;
    let txBytes = 0;

    if (vendor === 'omada') {
        // Rule: omada tx should be larger than rx
        rxBytes = baseTraffic;
        // TX is larger
        txBytes = baseTraffic + Math.floor(Math.random() * randomTrafficIncrement);
    } else if (vendor === 'ruijie') {
        // Rule: ruijie rx should be larger than tx
        txBytes = baseTraffic;
        // RX is larger
        rxBytes = baseTraffic + Math.floor(Math.random() * randomTrafficIncrement);
    } else {
        // Fallback for other vendors
        rxBytes = Math.floor(Math.random() * upperTrafficBound);
        txBytes = Math.floor(Math.random() * upperTrafficBound);
    }

    return { rxBytes, txBytes, baseTraffic };
}

async function populateData() {
    let connection;
    try {
        console.log('Connecting to database...');
        connection = await mysql.createConnection(dbConfig);

        // 1. Fetch all sites
        // Assuming 'wins_sites' is the table name for sites based on project context
        const [sites] = await connection.execute('SELECT name, vendor FROM wins_sites');
        console.log(`Fetched ${sites.length} total sites.`);

        // 2. Identify existing data points to skip on a per-day basis
        // This checks for existing records in the database (similar to how Generate.jsx would find existing data)
        // If a record exists for a site on a specific date, we consider that date "filled" and skip it.
        const [existingRecords] = await connection.execute(
            `SELECT DISTINCT site_id, date FROM manual_data_pics 
             WHERE date BETWEEN ? AND ?`,
            [START_DATE, END_DATE]
        );
        
        // Create a set of "site_id:YYYY-MM-DD" for fast lookup
        const existingDataPoints = new Set(
            existingRecords.map(r => `${r.site_id}:${dayjs(r.date).format('YYYY-MM-DD')}`)
        );
        console.log(`${existingRecords.length} existing site-date combinations found in the range and will be skipped.`);

        const recordsToInsert = [];
        let currentDate = dayjs(START_DATE);
        const lastDate = dayjs(END_DATE);

        const siteTrafficState = new Map(); // Store previous traffic data for trend flow

        // 3. Generate Data for missing site-date combinations (Blank Dates)
        while (currentDate.isBefore(lastDate) || currentDate.isSame(lastDate, 'day')) {
            const dateStr = currentDate.format('YYYY-MM-DD');

            for (const site of sites) {
                const dataPointKey = `${site.name}:${dateStr}`;
                
                // Check if data already exists for this site on this date
                if (existingDataPoints.has(dataPointKey)) {
                    continue; // Skip if data exists (it's not a blank date)
                }

                const vendor = (site.vendor || '').toLowerCase();
                
                // --- Users Data Generation ---
                let totalUsers = 0;
                let activeUsers = 0;

                if (vendor === 'omada') {
                    // Rule: omada user should be 100 below
                    totalUsers = Math.floor(Math.random() * 99) + 1; // 1 to 99
                    // Rule: omada total user and active user should be the same
                    activeUsers = totalUsers;
                } else if (vendor === 'ruijie') {
                    // Rule: ruijie user should be 150 maximum
                    totalUsers = Math.floor(Math.random() * 150) + 1; // 1 to 150
                    // Rule: ruijie total user should be larger than active user
                    activeUsers = Math.floor(Math.random() * totalUsers);
                } else {
                    // Fallback for other vendors (e.g. Huawei)
                    totalUsers = Math.floor(Math.random() * 50);
                    activeUsers = Math.floor(Math.random() * totalUsers);
                }

                // --- Traffic Data Generation ---
                const previousData = siteTrafficState.get(site.name);
                const { rxBytes, txBytes, baseTraffic } = generateTrafficData(vendor, previousData);
                
                // Update state for next day
                siteTrafficState.set(site.name, { baseTraffic });

                // Push 'users' record
                recordsToInsert.push([
                    site.name,
                    dateStr,
                    'users',
                    totalUsers,
                    activeUsers,
                    0, // download_bytes
                    0, // upload_bytes
                    'Script generated users (filled blank date)'
                ]);

                // Push 'traffic' record
                recordsToInsert.push([
                    site.name,
                    dateStr,
                    'traffic',
                    0, // total_users
                    0, // active_users
                    rxBytes,
                    txBytes,
                    'Script generated traffic (filled blank date)'
                ]);
            }
            
            currentDate = currentDate.add(1, 'day');
        }

        // 4. Insert Data in Batches
        if (recordsToInsert.length > 0) {
            console.log(`Total records to insert: ${recordsToInsert.length}`);
            
            const batchSize = 2000; // Adjust batch size if needed
            for (let i = 0; i < recordsToInsert.length; i += batchSize) {
                const batch = recordsToInsert.slice(i, i + batchSize);
                const query = `
                    INSERT INTO manual_data_pics 
                    (site_id, date, data_type, total_users, active_users, download_bytes, upload_bytes, notes) 
                    VALUES ?
                `;
                
                await connection.query(query, [batch]);
                
                const progress = Math.min(i + batchSize, recordsToInsert.length);
                const percent = ((progress / recordsToInsert.length) * 100).toFixed(1);
                console.log(`Inserted ${progress}/${recordsToInsert.length} (${percent}%)`);
            }
            
            console.log('Data population completed successfully.');
        } else {
            console.log('No new data to insert. The database is up to date for the given range.');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        if (connection) {
            await connection.end();
            console.log('Connection closed.');
        }
    }
}

populateData();
