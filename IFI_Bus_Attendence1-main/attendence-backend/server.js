const express = require('express');
const cors = require('cors');
const dbOperation = require('./dboperation');
const API_PORT = 5000;
const app = express();
// Middlewares
app.use(cors());              // allow frontend/mobile to call this
app.use(express.json());      // parse JSON body
// Health check (optional)
app.get('/', (req, res) => {
    res.send('Attendance API running');
});
// POST /api/scan - receive scan from app
app.post('/api/scan', async (req, res) => {
    const { employeeId, scanDateTime, scanType, deviceInfo } = req.body;
    if (!employeeId || !scanDateTime || !scanType) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields',
        });
    }
    try {
        await dbOperation.insertScan(employeeId, scanDateTime, scanType, deviceInfo);
        return res.json({
            success: true,
            message: 'Scan recorded successfully',
        });
    } catch (error) {
        console.error('Error inserting scan:', error);
        return res.status(500).json({
            success: false,
            message: 'Server error while saving scan',
        });
    }
});
// Start server
app.listen(API_PORT, () => {
    console.log(`Attendance API listening on port ${API_PORT}`);
});