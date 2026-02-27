const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db');
const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { studentId, facultyId, majorId, year } = req.body;

        if (!studentId || !/^\d{10}$/.test(studentId)) {
            return res.status(400).json({ error: 'Student ID must be exactly 10 digits' });
        }
        if (!facultyId || !majorId || !year) {
            return res.status(400).json({ error: 'Faculty, major, and year are required' });
        }

        // Check if user already exists
        const existing = await db.query('SELECT id FROM users WHERE student_id = $1', [studentId]);
        if (existing.rows.length > 0) {
            return res.status(409).json({ error: 'Student ID already registered' });
        }

        const result = await db.query(
            'INSERT INTO users (student_id, faculty_id, major_id, year) VALUES ($1, $2, $3, $4) RETURNING *',
            [studentId, facultyId, majorId, year]
        );

        const user = result.rows[0];
        const token = jwt.sign(
            { id: user.id, studentId: user.student_id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.status(201).json({ user, token });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { studentId } = req.body;

        if (!studentId || !/^\d{10}$/.test(studentId)) {
            return res.status(400).json({ error: 'Student ID must be exactly 10 digits' });
        }

        const result = await db.query(
            `SELECT u.*, f.name as faculty_name, m.name as major_name
       FROM users u
       LEFT JOIN faculties f ON u.faculty_id = f.id
       LEFT JOIN majors m ON u.major_id = m.id
       WHERE u.student_id = $1`,
            [studentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Student ID not found. Please register first.' });
        }

        const user = result.rows[0];
        const token = jwt.sign(
            { id: user.id, studentId: user.student_id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.json({ user, token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/auth/me - get current user info
router.get('/me', require('../middleware/auth'), async (req, res) => {
    try {
        const result = await db.query(
            `SELECT u.*, f.name as faculty_name, m.name as major_name
       FROM users u
       LEFT JOIN faculties f ON u.faculty_id = f.id
       LEFT JOIN majors m ON u.major_id = m.id
       WHERE u.id = $1`,
            [req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Auth me error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/auth/profile - update profile
router.put('/profile', require('../middleware/auth'), async (req, res) => {
    try {
        const { facultyId, majorId, year } = req.body;
        const result = await db.query(
            `UPDATE users SET faculty_id = $1, major_id = $2, year = $3
       WHERE id = $4 RETURNING *`,
            [facultyId, majorId, year, req.user.id]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Profile update error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
