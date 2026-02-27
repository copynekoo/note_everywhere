const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/subjects?majorId=...
router.get('/', async (req, res) => {
    try {
        const { majorId } = req.query;
        let query = 'SELECT * FROM subjects';
        let params = [];
        if (majorId) {
            query += ' WHERE major_id = $1';
            params.push(majorId);
        }
        query += ' ORDER BY year_level, code';
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Subjects error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/subjects/:subjectId
router.get('/:subjectId', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT s.*, m.name as major_name, f.name as faculty_name, m.faculty_id
       FROM subjects s
       JOIN majors m ON s.major_id = m.id
       JOIN faculties f ON m.faculty_id = f.id
       WHERE s.id = $1`,
            [req.params.subjectId]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Subject not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Subject detail error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/subjects/:subjectId/follow
router.post('/:subjectId/follow', auth, async (req, res) => {
    try {
        await db.query(
            'INSERT INTO follows (user_id, subject_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [req.user.id, req.params.subjectId]
        );
        res.json({ message: 'Followed subject' });
    } catch (err) {
        console.error('Follow error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/subjects/:subjectId/follow
router.delete('/:subjectId/follow', auth, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM follows WHERE user_id = $1 AND subject_id = $2',
            [req.user.id, req.params.subjectId]
        );
        res.json({ message: 'Unfollowed subject' });
    } catch (err) {
        console.error('Unfollow error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/subjects/:subjectId/is-following
router.get('/:subjectId/is-following', auth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id FROM follows WHERE user_id = $1 AND subject_id = $2',
            [req.user.id, req.params.subjectId]
        );
        res.json({ following: result.rows.length > 0 });
    } catch (err) {
        console.error('Is-following error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
