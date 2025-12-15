const sql = require('mssql');
const config = require('./dbconfig');

const insertScan = async (employeeId, scanDateTime, scanType, deviceInfo) => {
    try {
        let pool = await sql.connect(config);

        const query = `
      INSERT INTO AttendanceScans (EmployeeID, ScanDateTime, BarcodeType, DeviceInfo)
      VALUES (@employeeId, @scanDateTime, @scanType, @deviceInfo)
    `;

        await pool
            .request()
            .input('employeeId', sql.VarChar, employeeId)
            .input('scanDateTime', sql.DateTime, new Date(scanDateTime))
            .input('scanType', sql.VarChar, scanType)
            .input('deviceInfo', sql.VarChar, deviceInfo || 'Unknown')
            .query(query);

        console.log('Scan inserted successfully for', employeeId);
    } catch (error) {
        console.error('DB error in insertScan:', error);
        throw error;
    }
};

module.exports = {
    insertScan,
};