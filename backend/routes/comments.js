const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

// GET /api/notes/:noteId/comments
router.get('/note/:noteId', async (req, res) => {
    try {
        const result = await db.query(`
      SELECT c.*, u.student_id as commenter_student_id, u.name as commenter_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.note_id = $1
      ORDER BY c.created_at ASC
    `, [req.params.noteId]);
        res.json(result.rows);
    } catch (err) {
        console.error('Comments list error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/comments/note/:noteId
router.post('/note/:noteId', auth, async (req, res) => {
    try {
        const { content, parentId } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Comment content is required' });
        }

        const result = await db.query(
            `INSERT INTO comments (note_id, user_id, content, parent_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.params.noteId, req.user.id, content.trim(), parentId || null]
        );

        const comment = result.rows[0];

        // Get commenter info
        const userRes = await db.query('SELECT student_id FROM users WHERE id = $1', [req.user.id]);
        comment.commenter_student_id = userRes.rows[0].student_id;

        // Notify note owner
        if (req.app.get('io')) {
            const noteRes = await db.query('SELECT user_id, title, subject_id FROM notes WHERE id = $1', [req.params.noteId]);
            if (noteRes.rows.length > 0 && noteRes.rows[0].user_id !== req.user.id) {
                await db.query(
                    `INSERT INTO notifications (user_id, type, message, reference_id)
           VALUES ($1, $2, $3, $4)`,
                    [noteRes.rows[0].user_id, 'new_comment', `New comment on "${noteRes.rows[0].title}"`, parseInt(req.params.noteId)]
                );
                req.app.get('io').to(`user_${noteRes.rows[0].user_id}`).emit('new_notification', {
                    type: 'new_comment',
                    message: `New comment on "${noteRes.rows[0].title}"`,
                    noteId: parseInt(req.params.noteId),
                });
            }
        }

        res.status(201).json(comment);
    } catch (err) {
        console.error('Comment create error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/comments/:commentId
router.put('/:commentId', auth, async (req, res) => {
    try {
        const { content } = req.body;
        const check = await db.query('SELECT user_id FROM comments WHERE id = $1', [req.params.commentId]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
        if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

        const result = await db.query(
            'UPDATE comments SET content = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
            [content, req.params.commentId]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Comment update error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/comments/:commentId
router.delete('/:commentId', auth, async (req, res) => {
    try {
        const check = await db.query('SELECT user_id FROM comments WHERE id = $1', [req.params.commentId]);
        if (check.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
        if (check.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

        await db.query('DELETE FROM comments WHERE id = $1', [req.params.commentId]);
        res.json({ message: 'Comment deleted' });
    } catch (err) {
        console.error('Comment delete error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
