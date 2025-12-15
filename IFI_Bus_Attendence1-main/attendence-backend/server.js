const express = require('express');
const cors = require('cors');
const dbOperation = require('./dboperation');
const API_PORT = 5000;
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// POST /api/scan - receive scan from app
app.post('/api/scan', async (req, res) => {
    const { employeeId, scanDateTime, scanType, deviceInfo } = req.body;
    
    // Basic validation
    if (!employeeId || !scanDateTime || !scanType) {
        return res.status(400).json({
            success: false,
            message: 'Missing required fields',
        });
    }

    try {
        await dbOperation.insertScan(
            employeeId.trim(),
            scanDateTime,
            scanType,
            deviceInfo || 'Unknown'
        );
        
        return res.json({
            success: true,
            message: 'Scan recorded successfully',
        });
        
    } catch (error) {
        console.error('Error:', error);
        
        // Handle duplicate scan
        if (error.code === 'DUPLICATE') {
            return res.status(409).json({
                success: false,
                message: error.message,
            });
        }
        
        // Other errors
        return res.status(500).json({
            success: false,
            message: 'Server error',
        });
    }
});

// Start server
app.listen(API_PORT, () => {
    console.log(`Server running on port ${API_PORT}`);
});

module.exports = app;