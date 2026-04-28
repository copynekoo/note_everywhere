const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');

// Get all bookmarks for a user
router.get('/', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT b.id, b.item_type, b.item_id, b.title, b.created_at, 
                    p.problem_set_id, p.question, p.type as problem_type, p.correct_answer, p.explanation,
                    (SELECT json_agg(json_build_object('label', pc.label, 'text', pc.text)) 
                     FROM problem_choices pc WHERE pc.problem_id = p.id) as choices
             FROM bookmarks b
             LEFT JOIN problems p ON b.item_type = 'problem' AND b.item_id = p.id
             WHERE b.user_student_id = $1 
             ORDER BY b.created_at DESC`,
            [req.user.studentId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching bookmarks:', err);
        res.status(500).json({ error: 'Server error fetching bookmarks' });
    }
});

// Create a new bookmark
router.post('/', auth, async (req, res) => {
    const { item_type, item_id, title } = req.body;
    if (!item_type || !item_id) {
        return res.status(400).json({ error: 'Missing item_type or item_id' });
    }

    try {
        const result = await db.query(
            `INSERT INTO bookmarks (user_student_id, item_type, item_id, title) 
             VALUES ($1, $2, $3, $4) 
             RETURNING id, item_type, item_id, title, created_at`,
            [req.user.studentId, item_type, item_id, title]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') { // Unique violation
            return res.status(409).json({ error: 'Bookmark already exists' });
        }
        console.error('Error creating bookmark:', err);
        res.status(500).json({ error: 'Server error creating bookmark' });
    }
});

// Delete a bookmark
router.delete('/:item_type/:item_id', auth, async (req, res) => {
    const { item_type, item_id } = req.params;
    try {
        const result = await db.query(
            `DELETE FROM bookmarks WHERE user_student_id = $1 AND item_type = $2 AND item_id = $3 RETURNING id`,
            [req.user.studentId, item_type, item_id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Bookmark not found' });
        }

        res.json({ message: 'Bookmark removed successfully', id: result.rows[0].id });
    } catch (err) {
        console.error('Error deleting bookmark:', err);
        res.status(500).json({ error: 'Server error deleting bookmark' });
    }
});

module.exports = router;
