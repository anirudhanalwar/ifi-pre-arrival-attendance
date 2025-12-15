const sql = require('mssql');
const config = require('./dbconfig');

// Add a function to check for recent duplicate scans
const checkRecentScan = async (employeeId, minutesThreshold = 5) => {
    try {
        let pool = await sql.connect(config);
        
        const query = `
            SELECT TOP 1 ScanDateTime 
            FROM AttendanceScans 
            WHERE EmployeeID = @employeeId 
            AND DATEDIFF(MINUTE, ScanDateTime, GETDATE()) < @minutesThreshold
            ORDER BY ScanDateTime DESC
        `;
        
        const result = await pool
            .request()
            .input('employeeId', sql.VarChar, employeeId)
            .input('minutesThreshold', sql.Int, minutesThreshold)
            .query(query);
            
        return result.recordset.length > 0;
    } catch (error) {
        console.error('DB error in checkRecentScan:', error);
        throw error;
    }
};

const insertScan = async (employeeId, scanDateTime, scanType, deviceInfo) => {
    let pool;
    try {
        pool = await sql.connect(config);

        // First, check if this employee was recently scanned (within 5 minutes)
        const hasRecentScan = await checkRecentScan(employeeId, 5);
        
        if (hasRecentScan) {
            // Return specific error for duplicate scan
            const error = new Error(`Employee ID ${employeeId} was recently scanned (within 5 minutes)`);
            error.code = 'DUPLICATE';
            throw error;
        }

        const query = `
            INSERT INTO AttendanceScans (EmployeeID, ScanDateTime, BarcodeType, DeviceInfo)
            VALUES (@employeeId, @scanDateTime, @scanType, @deviceInfo)
        `;

        const request = pool.request();
        request.input('employeeId', sql.VarChar, employeeId);
        request.input('scanDateTime', sql.DateTime, new Date(scanDateTime));
        request.input('scanType', sql.VarChar, scanType);
        request.input('deviceInfo', sql.VarChar, deviceInfo || 'Unknown');

        await request.query(query);

        console.log(`Scan inserted successfully for ${employeeId} at ${new Date(scanDateTime).toLocaleString()}`);
        return { success: true, message: 'Scan recorded successfully' };
    } catch (error) {
        console.error('DB error in insertScan:', error);
        
        // If it's a duplicate error we threw, rethrow it
        if (error.code === 'DUPLICATE') {
            throw error;
        }
        
        // For other errors, throw generic error
        throw new Error(`Database error: ${error.message}`);
    } finally {
        // Close the connection pool
        if (pool) {
            await pool.close();
        }
    }
};

// Optional: Add function to get recent scans for debugging
const getRecentScans = async (employeeId, hours = 24) => {
    try {
        let pool = await sql.connect(config);
        
        const query = `
            SELECT TOP 10 
                EmployeeID, 
                ScanDateTime, 
                BarcodeType, 
                DeviceInfo,
                DATEDIFF(MINUTE, ScanDateTime, GETDATE()) as MinutesAgo
            FROM AttendanceScans 
            WHERE EmployeeID = @employeeId 
            AND ScanDateTime >= DATEADD(HOUR, @hours * -1, GETDATE())
            ORDER BY ScanDateTime DESC
        `;
        
        const result = await pool
            .request()
            .input('employeeId', sql.VarChar, employeeId)
            .input('hours', sql.Int, hours)
            .query(query);
            
        return result.recordset;
    } catch (error) {
        console.error('DB error in getRecentScans:', error);
        throw error;
    }
};

module.exports = {
    insertScan,
    checkRecentScan,
    getRecentScans // Optional, for debugging
};