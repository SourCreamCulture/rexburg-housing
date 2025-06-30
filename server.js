const express = require('express');
const mysql = require('mysql2/promise');
const path = require('path');
const app = express();

let pool;

async function initializePool() {
    try {
        pool = await mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'class_project',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
        console.log('MySQL connection pool initialized');
    } catch (error) {
        console.error('Error initializing MySQL connection pool:', error);
        process.exit(1);
    }
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/search', async (req, res) => {
    if (!pool) {
        return res.status(500).json({ error: 'Database connection not initialized' });
    }

    try {
        const { name, gender, maxCost, pool: hasPool, unitLaundry, gym, grill } = req.query;
        
        // Input validation
        if (name && typeof name !== 'string') {
            return res.status(400).json({ error: 'Invalid name parameter' });
        }
        if (gender && !['M', 'F'].includes(gender)) {
            return res.status(400).json({ error: 'Invalid gender parameter' });
        }
        if (maxCost && (isNaN(parseFloat(maxCost)) || parseFloat(maxCost) < 0)) {
            return res.status(400).json({ error: 'Invalid maxCost parameter' });
        }
        
        // Validate amenity parameters
        const amenityParams = [hasPool, unitLaundry, gym, grill];
        for (const param of amenityParams) {
            if (param && param !== 'Y') {
                return res.status(400).json({ error: 'Invalid amenity parameter' });
            }
        }
        
        let query = `
            SELECT DISTINCT a.*, ac.website, ac.email, ac.address 
            FROM apartment a
            LEFT JOIN amenities am ON a.apartment_id = am.apartment_id
            LEFT JOIN \`apt contact\` ac ON a.apartment_id = ac.apartment_id
            WHERE 1=1
        `;
        const params = [];

        if (name) {
            query += ' AND a.name LIKE ?';
            params.push(`%${name}%`);
        }
        if (gender) {
            query += ' AND a.gender = ?';
            params.push(gender);
        }
        if (maxCost) {
            query += ' AND a.avg_cost <= ?';
            params.push(parseFloat(maxCost));
        }
        if (hasPool === 'Y') {
            query += ' AND am.pool = ?';
            params.push('Y');
        }
        if (unitLaundry === 'Y') {
            query += ' AND am.unit_laundry = ?';
            params.push('Y');
        }
        if (gym === 'Y') {
            query += ' AND am.gym = ?';
            params.push('Y');
        }
        if (grill === 'Y') {
            query += ' AND am.grill = ?';
            params.push('Y');
        }

        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'An error occurred while searching for apartments' });
    }
});

const PORT = process.env.PORT || 3000;

async function startServer() {
    await initializePool();
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

startServer().catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
});