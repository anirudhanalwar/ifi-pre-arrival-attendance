const sql = require('mssql');
const config = require('./dbconfig');

const insertScan = async (employeeId, scanDateTime, scanType, deviceInfo) => {
    try {
        let pool = await sql.connect(config);

        // Check for recent duplicate scan (5 minutes)
        const duplicateCheck = await pool
            .request()
            .input('employeeId', sql.VarChar, employeeId)
            .input('scanDateTime', sql.DateTime, new Date(scanDateTime))
            .query(`
                SELECT TOP 1 ScanDateTime 
                FROM AttendanceScans 
                WHERE EmployeeID = @employeeId 
                AND DATEDIFF(MINUTE, ScanDateTime, @scanDateTime) < 5
            `);
        
        if (duplicateCheck.recordset.length > 0) {
            const error = new Error(`Employee ${employeeId} was recently scanned`);
            error.code = 'DUPLICATE';
            throw error;
        }

        // Insert the scan
        await pool
            .request()
            .input('employeeId', sql.VarChar, employeeId)
            .input('scanDateTime', sql.DateTime, new Date(scanDateTime))
            .input('scanType', sql.VarChar, scanType)
            .input('deviceInfo', sql.VarChar, deviceInfo || 'Unknown')
            .query(`
                INSERT INTO AttendanceScans (EmployeeID, ScanDateTime, BarcodeType, DeviceInfo)
                VALUES (@employeeId, @scanDateTime, @scanType, @deviceInfo)
            `);

        console.log(`Scan saved: ${employeeId}`);
        return { success: true };
        
    } catch (error) {
        console.error('Database error:', error);
        throw error;
    }
};

module.exports = {
    insertScan
};