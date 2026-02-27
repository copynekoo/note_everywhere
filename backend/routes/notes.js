const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const router = express.Router();

// GET /api/notes?subjectId=...&sort=...&userId=...&search=...
router.get('/', async (req, res) => {
    try {
        const { subjectId, sort, userId, search, limit = 20, offset = 0 } = req.query;
        let query = `
      SELECT n.*, u.student_id as uploader_student_id,
        s.name as subject_name, s.code as subject_code,
        COALESCE(SUM(r.value), 0) as rating_score,
        COUNT(DISTINCT r.id) as rating_count,
        COUNT(DISTINCT c.id) as comment_count
      FROM notes n
      JOIN users u ON n.user_id = u.id
      JOIN subjects s ON n.subject_id = s.id
      LEFT JOIN ratings r ON r.note_id = n.id
      LEFT JOIN comments c ON c.note_id = n.id
      WHERE n.is_public = true
    `;
        const params = [];
        let paramIndex = 1;

        if (subjectId) {
            query += ` AND n.subject_id = $${paramIndex++}`;
            params.push(subjectId);
        }
        if (userId) {
            query += ` AND n.user_id = $${paramIndex++}`;
            params.push(userId);
        }
        if (search) {
            query += ` AND (n.title ILIKE $${paramIndex} OR n.description ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        query += ' GROUP BY n.id, u.student_id, s.name, s.code';

        switch (sort) {
            case 'popular':
                query += ' ORDER BY rating_score DESC';
                break;
            case 'oldest':
                query += ' ORDER BY n.created_at ASC';
                break;
            default:
                query += ' ORDER BY n.created_at DESC';
        }

        query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
        params.push(limit, offset);

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Notes list error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/notes/dashboard - personalized feed
router.get('/dashboard', auth, async (req, res) => {
    try {
        // Get user info
        const userRes = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
        const user = userRes.rows[0];

        // Get recommended notes (same major)
        const recommended = await db.query(`
      SELECT n.*, u.student_id as uploader_student_id,
        s.name as subject_name, s.code as subject_code,
        COALESCE(SUM(r.value), 0) as rating_score,
        COUNT(DISTINCT c.id) as comment_count
      FROM notes n
      JOIN users u ON n.user_id = u.id
      JOIN subjects s ON n.subject_id = s.id
      LEFT JOIN ratings r ON r.note_id = n.id
      LEFT JOIN comments c ON c.note_id = n.id
      WHERE n.is_public = true AND s.major_id = $1
      GROUP BY n.id, u.student_id, s.name, s.code
      ORDER BY n.created_at DESC
      LIMIT 10
    `, [user.major_id]);

        // Get popular notes across the university
        const popular = await db.query(`
      SELECT n.*, u.student_id as uploader_student_id,
        s.name as subject_name, s.code as subject_code,
        COALESCE(SUM(r.value), 0) as rating_score,
        COUNT(DISTINCT c.id) as comment_count
      FROM notes n
      JOIN users u ON n.user_id = u.id
      JOIN subjects s ON n.subject_id = s.id
      LEFT JOIN ratings r ON r.note_id = n.id
      LEFT JOIN comments c ON c.note_id = n.id
      WHERE n.is_public = true
      GROUP BY n.id, u.student_id, s.name, s.code
      HAVING COALESCE(SUM(r.value), 0) > 0
      ORDER BY rating_score DESC
      LIMIT 10
    `);

        // Get recent notes from user's faculty
        const recent = await db.query(`
      SELECT n.*, u.student_id as uploader_student_id,
        s.name as subject_name, s.code as subject_code,
        COALESCE(SUM(r.value), 0) as rating_score,
        COUNT(DISTINCT c.id) as comment_count
      FROM notes n
      JOIN users u ON n.user_id = u.id
      JOIN subjects s ON n.subject_id = s.id
      JOIN majors m ON s.major_id = m.id
      LEFT JOIN ratings r ON r.note_id = n.id
      LEFT JOIN comments c ON c.note_id = n.id
      WHERE n.is_public = true AND m.faculty_id = $1
      GROUP BY n.id, u.student_id, s.name, s.code
      ORDER BY n.created_at DESC
      LIMIT 10
    `, [user.faculty_id]);

        res.json({
            recommended: recommended.rows,
            popular: popular.rows,
            recent: recent.rows,
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/notes/:noteId
router.get('/:noteId', async (req, res) => {
    try {
        const result = await db.query(`
      SELECT n.*, u.student_id as uploader_student_id,
        s.name as subject_name, s.code as subject_code,
        m.name as major_name, f.name as faculty_name,
        COALESCE(SUM(r.value), 0) as rating_score,
        COUNT(DISTINCT r.id) FILTER (WHERE r.value = 1) as likes,
        COUNT(DISTINCT r.id) FILTER (WHERE r.value = -1) as dislikes,
        COUNT(DISTINCT c.id) as comment_count
      FROM notes n
      JOIN users u ON n.user_id = u.id
      JOIN subjects s ON n.subject_id = s.id
      JOIN majors m ON s.major_id = m.id
      JOIN faculties f ON m.faculty_id = f.id
      LEFT JOIN ratings r ON r.note_id = n.id
      LEFT JOIN comments c ON c.note_id = n.id
      WHERE n.id = $1
      GROUP BY n.id, u.student_id, s.name, s.code, m.name, f.name
    `, [req.params.noteId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Note detail error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/notes
router.post('/', auth, upload.single('file'), async (req, res) => {
    try {
        const { subjectId, title, description, externalLink, isPublic } = req.body;

        if (!subjectId || !title) {
            return res.status(400).json({ error: 'Subject and title are required' });
        }

        const filePath = req.file ? req.file.filename : null;
        const fileType = req.file ? req.file.mimetype : null;

        const result = await db.query(
            `INSERT INTO notes (user_id, subject_id, title, description, file_path, file_type, external_link, is_public)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
            [req.user.id, subjectId, title, description || null, filePath, fileType, externalLink || null, isPublic !== 'false']
        );

        const note = result.rows[0];

        // Notify followers of this subject
        if (req.app.get('io')) {
            const followers = await db.query(
                'SELECT user_id FROM follows WHERE subject_id = $1 AND user_id != $2',
                [subjectId, req.user.id]
            );

            for (const follower of followers.rows) {
                await db.query(
                    `INSERT INTO notifications (user_id, type, message, reference_id)
           VALUES ($1, $2, $3, $4)`,
                    [follower.user_id, 'new_note', `New note "${title}" uploaded`, note.id]
                );
            }

            req.app.get('io').to(`subject_${subjectId}`).emit('new_notification', {
                type: 'new_note',
                message: `New note "${title}" uploaded`,
                noteId: note.id,
            });
        }

        res.status(201).json(note);
    } catch (err) {
        console.error('Note create error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/notes/:noteId
router.put('/:noteId', auth, async (req, res) => {
    try {
        const { title, description, isPublic } = req.body;

        // Check ownership
        const noteCheck = await db.query('SELECT user_id FROM notes WHERE id = $1', [req.params.noteId]);
        if (noteCheck.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
        if (noteCheck.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

        const result = await db.query(
            `UPDATE notes SET title = COALESCE($1, title), description = COALESCE($2, description),
       is_public = COALESCE($3, is_public), updated_at = NOW()
       WHERE id = $4 RETURNING *`,
            [title, description, isPublic, req.params.noteId]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Note update error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/notes/:noteId
router.delete('/:noteId', auth, async (req, res) => {
    try {
        const noteCheck = await db.query('SELECT user_id FROM notes WHERE id = $1', [req.params.noteId]);
        if (noteCheck.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
        if (noteCheck.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

        await db.query('DELETE FROM notes WHERE id = $1', [req.params.noteId]);
        res.json({ message: 'Note deleted' });
    } catch (err) {
        console.error('Note delete error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/notes/:noteId/rate
router.post('/:noteId/rate', auth, async (req, res) => {
    try {
        const { value } = req.body;
        if (![1, -1].includes(value)) {
            return res.status(400).json({ error: 'Value must be 1 or -1' });
        }

        // Upsert rating
        await db.query(
            `INSERT INTO ratings (note_id, user_id, value)
       VALUES ($1, $2, $3)
       ON CONFLICT (note_id, user_id) DO UPDATE SET value = $3`,
            [req.params.noteId, req.user.id, value]
        );

        // Return updated counts
        const result = await db.query(`
      SELECT
        COALESCE(SUM(value), 0) as rating_score,
        COUNT(*) FILTER (WHERE value = 1) as likes,
        COUNT(*) FILTER (WHERE value = -1) as dislikes
      FROM ratings WHERE note_id = $1
    `, [req.params.noteId]);

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Rating error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/notes/:noteId/rate - remove user's rating
router.delete('/:noteId/rate', auth, async (req, res) => {
    try {
        await db.query(
            'DELETE FROM ratings WHERE note_id = $1 AND user_id = $2',
            [req.params.noteId, req.user.id]
        );
        const result = await db.query(`
      SELECT
        COALESCE(SUM(value), 0) as rating_score,
        COUNT(*) FILTER (WHERE value = 1) as likes,
        COUNT(*) FILTER (WHERE value = -1) as dislikes
      FROM ratings WHERE note_id = $1
    `, [req.params.noteId]);
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Rating remove error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/notes/:noteId/user-rating
router.get('/:noteId/user-rating', auth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT value FROM ratings WHERE note_id = $1 AND user_id = $2',
            [req.params.noteId, req.user.id]
        );
        res.json({ value: result.rows.length > 0 ? result.rows[0].value : 0 });
    } catch (err) {
        console.error('User rating error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/notes/:noteId/related
router.get('/:noteId/related', async (req, res) => {
    try {
        const noteRes = await db.query('SELECT subject_id FROM notes WHERE id = $1', [req.params.noteId]);
        if (noteRes.rows.length === 0) return res.status(404).json({ error: 'Note not found' });

        const result = await db.query(`
      SELECT n.*, u.student_id as uploader_student_id,
        s.name as subject_name, s.code as subject_code,
        COALESCE(SUM(r.value), 0) as rating_score
      FROM notes n
      JOIN users u ON n.user_id = u.id
      JOIN subjects s ON n.subject_id = s.id
      LEFT JOIN ratings r ON r.note_id = n.id
      WHERE n.subject_id = $1 AND n.id != $2 AND n.is_public = true
      GROUP BY n.id, u.student_id, s.name, s.code
      ORDER BY n.created_at DESC
      LIMIT 5
    `, [noteRes.rows[0].subject_id, req.params.noteId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Related notes error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
