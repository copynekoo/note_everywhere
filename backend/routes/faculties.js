const express = require('express');
const db = require('../db');
const router = express.Router();

// GET /api/faculties
router.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM faculties ORDER BY name');
        res.json(result.rows);
    } catch (err) {
        console.error('Faculties error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/faculties/:facultyId/majors
router.get('/:facultyId/majors', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM majors WHERE faculty_id = $1 ORDER BY name',
            [req.params.facultyId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Majors error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
