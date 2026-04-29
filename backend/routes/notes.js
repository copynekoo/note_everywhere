const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const router = express.Router();

// Optional auth middleware — attaches req.user if token present but doesn't reject
const optAuth = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) return next();
    const jwt = require('jsonwebtoken');
    try {
        req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    } catch (_) { /* ignore invalid token */ }
    next();
};

// GET /api/notes?subjectId=...&sort=...&userId=...&search=...
router.get('/', async (req, res) => {
    try {
        const { subjectId, sort, userId, search, limit = 20, offset = 0 } = req.query;
        let query = `
      SELECT n.*, u.student_id as uploader_student_id, u.name as uploader_name,
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

        query += ' GROUP BY n.id, u.student_id, u.name, s.name, s.code';

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
      SELECT n.*, u.student_id as uploader_student_id, u.name as uploader_name,
        s.name as subject_name, s.code as subject_code,
        COALESCE(SUM(r.value), 0) as rating_score,
        COUNT(DISTINCT c.id) as comment_count
      FROM notes n
      JOIN users u ON n.user_id = u.id
      JOIN subjects s ON n.subject_id = s.id
      LEFT JOIN ratings r ON r.note_id = n.id
      LEFT JOIN comments c ON c.note_id = n.id
      WHERE n.is_public = true AND s.major_id = $1
      GROUP BY n.id, u.student_id, u.name, s.name, s.code
      ORDER BY n.created_at DESC
      LIMIT 10
    `, [user.major_id]);

        // Get popular notes across the university
        const popular = await db.query(`
      SELECT n.*, u.student_id as uploader_student_id, u.name as uploader_name,
        s.name as subject_name, s.code as subject_code,
        COALESCE(SUM(r.value), 0) as rating_score,
        COUNT(DISTINCT c.id) as comment_count
      FROM notes n
      JOIN users u ON n.user_id = u.id
      JOIN subjects s ON n.subject_id = s.id
      LEFT JOIN ratings r ON r.note_id = n.id
      LEFT JOIN comments c ON c.note_id = n.id
      WHERE n.is_public = true
      GROUP BY n.id, u.student_id, u.name, s.name, s.code
      HAVING COALESCE(SUM(r.value), 0) > 0
      ORDER BY rating_score DESC
      LIMIT 10
    `);

        // Get recent notes from user's faculty
        const recent = await db.query(`
      SELECT n.*, u.student_id as uploader_student_id, u.name as uploader_name,
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
      GROUP BY n.id, u.student_id, u.name, s.name, s.code
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
router.get('/:noteId', optAuth, async (req, res) => {
    try {
        const result = await db.query(`
      SELECT n.*, u.student_id as uploader_student_id, u.name as uploader_name,
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
      GROUP BY n.id, u.student_id, u.name, s.name, s.code, m.name, f.name
    `, [req.params.noteId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        // Track view (fire-and-forget)
        db.query(
            'INSERT INTO note_views (note_id, user_id) VALUES ($1, $2)',
            [req.params.noteId, req.user?.id || null]
        ).catch(() => { });

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Note detail error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/notes/:noteId/analytics
router.get('/:noteId/analytics', auth, async (req, res) => {
    try {
        const noteId = req.params.noteId;

        // Verify note exists
        const noteRes = await db.query(
            `SELECT n.id, n.title, n.user_id, u.student_id as creator_student_id,
                COALESCE(SUM(r.value), 0) as rating_score,
                COUNT(DISTINCT r.id) FILTER (WHERE r.value = 1) as likes,
                COUNT(DISTINCT r.id) FILTER (WHERE r.value = -1) as dislikes,
                COUNT(DISTINCT c.id) as comment_count
             FROM notes n
             JOIN users u ON n.user_id = u.id
             LEFT JOIN ratings r ON r.note_id = n.id
             LEFT JOIN comments c ON c.note_id = n.id
             WHERE n.id = $1
             GROUP BY n.id, n.title, n.user_id, u.student_id`,
            [noteId]
        );
        if (noteRes.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
        const note = noteRes.rows[0];

        // Total views
        const totalViewsRes = await db.query(
            'SELECT COUNT(*) FROM note_views WHERE note_id = $1', [noteId]
        );
        const totalViews = parseInt(totalViewsRes.rows[0].count);

        // Unique viewers
        const uniqueViewersRes = await db.query(
            'SELECT COUNT(DISTINCT user_id) FROM note_views WHERE note_id = $1 AND user_id IS NOT NULL', [noteId]
        );
        const uniqueViewers = parseInt(uniqueViewersRes.rows[0].count);

        // Views per day (last 30 days)
        const viewsByDayRes = await db.query(
            `SELECT DATE(viewed_at) as date, COUNT(*) as views
             FROM note_views
             WHERE note_id = $1 AND viewed_at >= NOW() - INTERVAL '30 days'
             GROUP BY DATE(viewed_at)
             ORDER BY date ASC`,
            [noteId]
        );

        // Problem sets for this note
        const problemSetsRes = await db.query(
            `SELECT ps.id, ps.title, ps.created_at,
                COUNT(DISTINCT pss.id) as total_sessions,
                COUNT(DISTINCT pss.id) FILTER (WHERE pss.completed = true) as completed_sessions,
                COALESCE(AVG(pss.score) FILTER (WHERE pss.completed = true), 0) as avg_score
             FROM problem_sets ps
             LEFT JOIN problem_set_sessions pss ON pss.problem_set_id = ps.id
             WHERE ps.note_id = $1
             GROUP BY ps.id, ps.title, ps.created_at
             ORDER BY ps.created_at DESC`,
            [noteId]
        );

        // Per-problem first-try pass rates for each problem set
        const problemSets = problemSetsRes.rows;
        for (const ps of problemSets) {
            // Get all problems in this set
            const problemsRes = await db.query(
                `SELECT p.id, p.question, p.type, p.difficulty, p.position
                 FROM problems p WHERE p.problem_set_id = $1 ORDER BY p.position`,
                [ps.id]
            );

            // For each problem, count first-try attempts and how many were correct
            const problemStats = [];
            for (const prob of problemsRes.rows) {
                const statsRes = await db.query(
                    `SELECT
                        COUNT(*) as total_attempts,
                        COUNT(*) FILTER (WHERE is_correct = true) as correct_attempts
                     FROM (
                         SELECT DISTINCT ON (pss.user_id)
                             pa.is_correct
                         FROM problem_attempts pa
                         JOIN problem_set_sessions pss ON pa.session_id = pss.id
                         WHERE pa.problem_id = $1
                         ORDER BY pss.user_id, pss.started_at ASC
                     ) first_attempts`,
                    [prob.id]
                );
                const s = statsRes.rows[0];
                const total = parseInt(s.total_attempts);
                const correct = parseInt(s.correct_attempts);
                problemStats.push({
                    id: prob.id,
                    question: prob.question,
                    type: prob.type,
                    difficulty: prob.difficulty,
                    position: prob.position,
                    totalFirstTryAttempts: total,
                    correctFirstTryAttempts: correct,
                    firstTryPassRate: total > 0 ? Math.round((correct / total) * 100) : null,
                });
            }
            ps.problems = problemStats;
        }

        res.json({
            note: { ...note, totalViews, uniqueViewers },
            viewsByDay: viewsByDayRes.rows,
            problemSets,
        });
    } catch (err) {
        console.error('Note analytics error:', err);
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
        const noteCheck = await db.query('SELECT user_id, file_path FROM notes WHERE id = $1', [req.params.noteId]);
        if (noteCheck.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
        if (noteCheck.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

        const filePath = noteCheck.rows[0].file_path;

        await db.query('DELETE FROM notes WHERE id = $1', [req.params.noteId]);

        // Attempt to delete file from local storage
        if (filePath) {
            const absolutePath = path.join(__dirname, '..', 'uploads', filePath);
            fs.unlink(absolutePath, (err) => {
                if (err) console.error('Failed to delete file from local storage:', err);
            });
        }

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
      SELECT n.*, u.student_id as uploader_student_id, u.name as uploader_name,
        s.name as subject_name, s.code as subject_code,
        COALESCE(SUM(r.value), 0) as rating_score
      FROM notes n
      JOIN users u ON n.user_id = u.id
      JOIN subjects s ON n.subject_id = s.id
      LEFT JOIN ratings r ON r.note_id = n.id
      WHERE n.subject_id = $1 AND n.id != $2 AND n.is_public = true
      GROUP BY n.id, u.student_id, u.name, s.name, s.code
      ORDER BY n.created_at DESC
      LIMIT 5
    `, [noteRes.rows[0].subject_id, req.params.noteId]);

        res.json(result.rows);
    } catch (err) {
        console.error('Related notes error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/notes/:noteId/summarize
router.post('/:noteId/summarize', auth, async (req, res) => {
    try {
        // Fetch note to check ownership (optional) and get docling_result
        const noteRes = await db.query('SELECT docling_result, ai_summary, docling_status FROM notes WHERE id = $1', [req.params.noteId]);
        if (noteRes.rows.length === 0) return res.status(404).json({ error: 'Note not found' });

        const note = noteRes.rows[0];

        if (note.docling_status !== 'done' || !note.docling_result) {
            return res.status(400).json({ error: 'Note has not been successfully processed by Docling yet.' });
        }

        // If it already has an AI summary, return it to save tokens
        if (note.ai_summary) {
            return res.json({ ai_summary: note.ai_summary });
        }

        const openai = new OpenAI({
            baseURL: 'https://api.deepseek.com',
            apiKey: process.env.DEEPSEEK_API_KEY,
        });

        const completion = await openai.chat.completions.create({
            messages: [
                {
                    role: "system",
                    content: `You are a highly skilled expert in document and content analysis, summarization, and information organization, with advanced proficiency in extracting, structuring, and condensing content into clear, accurate, and well-organized summaries.
                    
                    CRITICAL: All mathematical formulas MUST be written in LaTeX with backslashes.
                    - Inline formulas: MUST use \\( ... \\)
                    - Display formulas: MUST use \\[ ... \\]

                    Examples of CORRECT output:
                    \\( \\sigma = P/A \\)
                    \\[ \\sigma = \\lim_{\\Delta A \\to 0} \\frac{\\Delta F}{\\Delta A} \\]
                    \\( F_{BC} = 50 \\text{ kN} \\)
                    \\( A = \\pi (10 \\text{ mm})^2 = 314 \\times 10^{-6} \\text{ m}^2 \\)

                    Examples of WRONG output (NEVER use these):
                    ( sigma = P/A )
                    [ sigma = lim_{Delta A to 0} frac{Delta F}{Delta A} ]
                    sigma = P/A (without any delimiters)

                    You MUST include backslashes for: \\sigma, \\lim, \\frac, \\pi, \\text, \\Delta, \\to, \\times, \\sum, \\int.
                    Never write "lim" without a backslash – always "\\lim".
                    Never write "frac" without a backslash – always "\\frac".
                    `
                },
                {
                    role: "user",
                    content: `Act as a highly skilled expert in content analysis and summarization, with advanced proficiency in extracting, organizing, and condensing information into clear, structured, and highly accurate summaries. Your task is to carefully analyze the provided content in its entirety, ensuring that every section, topic, or logical segment is thoroughly reviewed and logically categorized. Begin by identifying the overall structure of the content, including any chapters, headings, sections, topics, or natural breaks, and then produce a detailed summary for each part using clear and concise bullet points that highlight the key points, core ideas, and any essential data, insights, or instructions. Maintain the original meaning and context of the content while avoiding unnecessary reduction of important details, ensuring that the summaries are as minimally compressed as possible to preserve critical information. If the content contains instructions, guidelines, procedures, steps, or actionable items, prioritize clarity and completeness by capturing these elements in their entirety without significant summarization, presenting them in a clear, easy-to-follow format. Your final output should reflect a well-organized, section-by-section breakdown of the content, where each segment includes bullet point summaries that retain the depth and accuracy of the original material while enhancing readability and quick comprehension.

Here is the content to summarize:

${note.docling_result}`
                }
            ],
            model: "deepseek-v4-flash",
            temperature: 0.3,
            max_tokens: 6000,
        });

        const newSummary = completion.choices[0].message.content;

        // Save back to database
        await db.query('UPDATE notes SET ai_summary = $1 WHERE id = $2', [newSummary, req.params.noteId]);

        res.json({ ai_summary: newSummary });
    } catch (err) {
        console.error('AI summarization error:', err);
        res.status(500).json({ error: 'Internal server error while summarizing' });
    }
});

module.exports = router;
