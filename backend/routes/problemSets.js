const express = require('express');
const db = require('../db');
const auth = require('../middleware/auth');
const { OpenAI } = require('openai');
const router = express.Router();

const openai = new OpenAI({
    baseURL: 'https://api.deepseek.com',
    apiKey: process.env.DEEPSEEK_API_KEY,
});

// ─── helpers ────────────────────────────────────────────────────────────────

function buildGenerationPrompt(source, context, mcqCounts, subjectiveCounts, customBlocks = []) {
    const mcqTotal = (mcqCounts.easy || 0) + (mcqCounts.normal || 0) + (mcqCounts.hard || 0);
    const subTotal = (subjectiveCounts.easy || 0) + (subjectiveCounts.normal || 0) + (subjectiveCounts.hard || 0);

    const mcqLines = [
        mcqCounts.easy > 0 ? `  - ${mcqCounts.easy} Easy` : '',
        mcqCounts.normal > 0 ? `  - ${mcqCounts.normal} Normal` : '',
        mcqCounts.hard > 0 ? `  - ${mcqCounts.hard} Hard` : '',
    ].filter(Boolean).join('\n');

    const subLines = [
        subjectiveCounts.easy > 0 ? `  - ${subjectiveCounts.easy} Easy` : '',
        subjectiveCounts.normal > 0 ? `  - ${subjectiveCounts.normal} Normal` : '',
        subjectiveCounts.hard > 0 ? `  - ${subjectiveCounts.hard} Hard` : '',
    ].filter(Boolean).join('\n');

    let customBlockSection = '';
    if (customBlocks.length > 0) {
        const blockLines = customBlocks.map((b, i) =>
            `  Block ${i + 1}: ${b.count} ${b.difficulty} ${b.type} question(s) about "${b.topic}"`
        ).join('\n');
        customBlockSection = `\n- Custom Topic Blocks (use the specified topic regardless of main source, generate from your general knowledge on that topic):\n${blockLines}`;
    }

    return `You are an expert educator. Generate a structured problem set in valid JSON based on the following content.

${source === 'ai_summary'
            ? `Use ONLY the knowledge from the provided document summary below for the main questions:\n\n${context}`
            : `The topic is: "${context}". Generate questions about this topic from your general knowledge.`
        }

Generate exactly:
- ${mcqTotal} Multiple Choice Questions (type: "objective") from the main source:
${mcqLines}
- ${subTotal} Subjective (short-answer) Questions (type: "subjective") from the main source:
${subLines}${customBlockSection}

Return ONLY a valid JSON array with NO extra text wrapped in a code block. Each element must follow this schema EXACTLY:
{
  "type": "objective" | "subjective",
  "difficulty": "easy" | "normal" | "hard",
  "question": "...",
  "choices": [   // ONLY for objective — omit for subjective
    { "label": "A", "text": "..." },
    { "label": "B", "text": "..." },
    { "label": "C", "text": "..." },
    { "label": "D", "text": "..." }
  ],
  "correct_answer": "A" | "B" | "C" | "D",  // ONLY for objective
  "explanation": "Brief explanation of why the correct answer is right",  // ONLY for objective
  "model_answer": "A concise model answer"   // ONLY for subjective
}

Order: all objective questions first, then subjective questions.
Return ONLY the JSON array, no markdown, no extra commentary.`;
}

// ─── routes ─────────────────────────────────────────────────────────────────

// POST /api/problem-sets/generate
router.post('/generate', auth, async (req, res) => {
    try {
        const { noteId, source, mcqCounts = {}, subjectiveCounts = {}, customBlocks = [] } = req.body;

        if (!noteId) return res.status(400).json({ error: 'noteId is required' });
        if (!['ai_summary', 'free'].includes(source)) return res.status(400).json({ error: 'source must be ai_summary or free' });

        const noteRes = await db.query(
            `SELECT n.*, s.name as subject_name FROM notes n JOIN subjects s ON n.subject_id = s.id WHERE n.id = $1`,
            [noteId]
        );
        if (noteRes.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
        const note = noteRes.rows[0];

        if (source === 'ai_summary') {
            if (!note.ai_summary) return res.status(400).json({ error: 'Note does not have an AI summary yet.' });
        }

        const context = source === 'ai_summary' ? note.ai_summary : `${note.title} — ${note.subject_name}`;
        const prompt = buildGenerationPrompt(source, context, mcqCounts, subjectiveCounts, customBlocks);

        const completion = await openai.chat.completions.create({
            model: 'deepseek-chat',
            temperature: 0.7,
            max_tokens: 6000,
            messages: [
                { role: 'system', content: 'You are an expert educator who creates accurate, well-structured exam questions. Always return valid JSON only.' },
                { role: 'user', content: prompt },
            ],
        });

        let raw = completion.choices[0].message.content.trim();
        // Strip possible markdown code fences
        raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

        let questions;
        try {
            questions = JSON.parse(raw);
        } catch {
            console.error('AI returned invalid JSON:', raw.slice(0, 500));
            return res.status(500).json({ error: 'AI returned invalid JSON. Please try again.' });
        }

        if (!Array.isArray(questions) || questions.length === 0) {
            return res.status(500).json({ error: 'AI returned no questions. Please try again.' });
        }

        const mcqTotal = (mcqCounts.easy || 0) + (mcqCounts.normal || 0) + (mcqCounts.hard || 0);
        const subTotal = (subjectiveCounts.easy || 0) + (subjectiveCounts.normal || 0) + (subjectiveCounts.hard || 0);
        const customTotal = customBlocks.reduce((sum, b) => sum + (parseInt(b.count) || 0), 0);
        const title = `Problem Set for "${note.title}" (${mcqTotal} MCQ, ${subTotal} Subjective${customTotal > 0 ? `, ${customTotal} Custom` : ''})`;


        // Insert problem set
        const psRes = await db.query(
            `INSERT INTO problem_sets (note_id, created_by, title, source) VALUES ($1, $2, $3, $4) RETURNING *`,
            [noteId, req.user.id, title, source]
        );
        const problemSetId = psRes.rows[0].id;

        // Insert each problem
        for (let i = 0; i < questions.length; i++) {
            const q = questions[i];
            const isObjective = q.type === 'objective';
            const probRes = await db.query(
                `INSERT INTO problems (problem_set_id, type, difficulty, question, correct_answer, explanation, position)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                [
                    problemSetId,
                    isObjective ? 'objective' : 'subjective',
                    q.difficulty || 'normal',
                    q.question,
                    isObjective ? q.correct_answer : (q.model_answer || null),
                    isObjective ? (q.explanation || null) : null,
                    i + 1,
                ]
            );
            const probId = probRes.rows[0].id;

            if (isObjective && Array.isArray(q.choices)) {
                for (const choice of q.choices) {
                    await db.query(
                        `INSERT INTO problem_choices (problem_id, label, text) VALUES ($1, $2, $3)`,
                        [probId, choice.label, choice.text]
                    );
                }
            }
        }

        res.status(201).json({ id: problemSetId, title });
    } catch (err) {
        console.error('Problem set generation error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/problem-sets/my-sessions  (must be before /:id to avoid conflict)
router.get('/my-sessions', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT pss.*, ps.title as problem_set_title, ps.note_id
             FROM problem_set_sessions pss
             JOIN problem_sets ps ON pss.problem_set_id = ps.id
             WHERE pss.user_id = $1
             ORDER BY pss.started_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('My sessions error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/problem-sets/note/:noteId – list problem sets for a note
router.get('/note/:noteId', auth, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT ps.*, u.student_id as creator_student_id, u.name as creator_name,
               COUNT(DISTINCT p.id) as problem_count
             FROM problem_sets ps
             JOIN users u ON ps.created_by = u.id
             LEFT JOIN problems p ON p.problem_set_id = ps.id
             WHERE ps.note_id = $1
             GROUP BY ps.id, u.student_id, u.name
             ORDER BY ps.created_at DESC`,
            [req.params.noteId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Problem sets list error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/problem-sets/sessions/:sessionId/history
router.get('/sessions/:sessionId/history', auth, async (req, res) => {
    try {
        const sessionRes = await db.query(
            `SELECT pss.*, ps.title as problem_set_title, ps.note_id
             FROM problem_set_sessions pss
             JOIN problem_sets ps ON pss.problem_set_id = ps.id
             WHERE pss.id = $1 AND pss.user_id = $2`,
            [req.params.sessionId, req.user.id]
        );
        if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

        const attemptsRes = await db.query(
            `SELECT pa.*, p.question, p.type, p.difficulty, p.correct_answer, p.explanation, p.position
             FROM problem_attempts pa
             JOIN problems p ON pa.problem_id = p.id
             WHERE pa.session_id = $1
             ORDER BY p.position`,
            [req.params.sessionId]
        );

        // For each objective attempt, also fetch choices
        const attempts = attemptsRes.rows;
        for (const a of attempts) {
            if (a.type === 'objective') {
                const choicesRes = await db.query(
                    `SELECT label, text FROM problem_choices WHERE problem_id = $1 ORDER BY label`,
                    [a.problem_id]
                );
                a.choices = choicesRes.rows;
            }
        }

        res.json({ session: sessionRes.rows[0], attempts });
    } catch (err) {
        console.error('Session history error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/problem-sets/problems/:id/evaluate – evaluate an answer out of session (e.g. from bookmarks)
router.post('/problems/:id/evaluate', auth, async (req, res) => {
    try {
        const { answer } = req.body;
        const problemId = req.params.id;

        if (answer === undefined) return res.status(400).json({ error: 'answer is required' });

        const problemRes = await db.query('SELECT * FROM problems WHERE id = $1', [problemId]);
        if (problemRes.rows.length === 0) return res.status(404).json({ error: 'Problem not found' });
        const problem = problemRes.rows[0];

        let isCorrect = null;
        let aiFeedback = null;

        if (problem.type === 'objective') {
            isCorrect = answer.trim().toUpperCase() === (problem.correct_answer || '').trim().toUpperCase();
            aiFeedback = problem.explanation || null;
        } else {
            const completion = await openai.chat.completions.create({
                model: 'deepseek-chat',
                temperature: 0.5,
                max_tokens: 600,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful tutor evaluating student short answers. You must respond with ONLY a valid JSON object with exactly two keys: "feedback" (a brief 2-4 sentence string explaining what is correct or missing) and "isCorrect" (a boolean, true if the answer is reasonably correct or good enough to pass, false otherwise).'
                    },
                    {
                        role: 'user',
                        content: `Question: ${problem.question}\n\nModel Answer: ${problem.correct_answer || '(No model answer provided)'}\n\nStudent Answer: ${answer}`
                    }
                ],
            });

            try {
                let raw = completion.choices[0].message.content.trim();
                raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
                const evalData = JSON.parse(raw);
                aiFeedback = evalData.feedback || 'No feedback provided.';
                isCorrect = !!evalData.isCorrect;
            } catch (err) {
                console.error("Failed to parse subjective feedback:", err);
                aiFeedback = "Failed to parse AI output: " + completion.choices[0].message.content.trim();
                isCorrect = false;
            }
        }
        res.json({ isCorrect, aiFeedback, correctAnswer: problem.type === 'objective' ? problem.correct_answer : null });
    } catch (err) {
        console.error('Evaluate answer error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/problem-sets/:id – get full problem set with problems & choices
router.get('/:id', auth, async (req, res) => {
    try {
        const psRes = await db.query(
            `SELECT ps.*, u.student_id as creator_student_id, u.name as creator_name,
               n.title as note_title
             FROM problem_sets ps
             JOIN users u ON ps.created_by = u.id
             JOIN notes n ON ps.note_id = n.id
             WHERE ps.id = $1`,
            [req.params.id]
        );
        if (psRes.rows.length === 0) return res.status(404).json({ error: 'Problem set not found' });

        const problemsRes = await db.query(
            `SELECT * FROM problems WHERE problem_set_id = $1 ORDER BY position`,
            [req.params.id]
        );

        const problems = problemsRes.rows;
        for (const p of problems) {
            if (p.type === 'objective') {
                const choicesRes = await db.query(
                    `SELECT label, text FROM problem_choices WHERE problem_id = $1 ORDER BY label`,
                    [p.id]
                );
                p.choices = choicesRes.rows;
            }
        }

        res.json({ ...psRes.rows[0], problems });
    } catch (err) {
        console.error('Problem set detail error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/problem-sets/:id/sessions – start or resume a session
router.post('/:id/sessions', auth, async (req, res) => {
    try {
        const psRes = await db.query('SELECT id FROM problem_sets WHERE id = $1', [req.params.id]);
        if (psRes.rows.length === 0) return res.status(404).json({ error: 'Problem set not found' });

        // Check for an existing in-progress session for this user
        const existingRes = await db.query(
            `SELECT * FROM problem_set_sessions
             WHERE problem_set_id = $1 AND user_id = $2 AND completed = false
             ORDER BY started_at DESC LIMIT 1`,
            [req.params.id, req.user.id]
        );

        if (existingRes.rows.length > 0) {
            // Return the existing session with a resumed flag
            return res.status(200).json({ ...existingRes.rows[0], resumed: true });
        }

        const totalRes = await db.query('SELECT COUNT(*) FROM problems WHERE problem_set_id = $1', [req.params.id]);
        const total = parseInt(totalRes.rows[0].count);

        const sessionRes = await db.query(
            `INSERT INTO problem_set_sessions (problem_set_id, user_id, total) VALUES ($1, $2, $3) RETURNING *`,
            [req.params.id, req.user.id, total]
        );
        res.status(201).json({ ...sessionRes.rows[0], resumed: false });
    } catch (err) {
        console.error('Create session error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/problem-sets/sessions/:sessionId/progress – save current question index
router.patch('/sessions/:sessionId/progress', auth, async (req, res) => {
    try {
        const { currentQuestionIdx } = req.body;
        if (currentQuestionIdx === undefined) return res.status(400).json({ error: 'currentQuestionIdx is required' });

        const updated = await db.query(
            `UPDATE problem_set_sessions SET current_question_idx = $1
             WHERE id = $2 AND user_id = $3 AND completed = false
             RETURNING *`,
            [currentQuestionIdx, req.params.sessionId, req.user.id]
        );
        if (updated.rows.length === 0) return res.status(404).json({ error: 'Session not found or already completed' });
        res.json(updated.rows[0]);
    } catch (err) {
        console.error('Save progress error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/problem-sets/sessions/:sessionId – get session state
router.get('/sessions/:sessionId', auth, async (req, res) => {
    try {
        const sessionRes = await db.query(
            `SELECT pss.*, ps.title as problem_set_title
             FROM problem_set_sessions pss
             JOIN problem_sets ps ON pss.problem_set_id = ps.id
             WHERE pss.id = $1 AND pss.user_id = $2`,
            [req.params.sessionId, req.user.id]
        );
        if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

        const answeredRes = await db.query(
            `SELECT problem_id FROM problem_attempts WHERE session_id = $1`,
            [req.params.sessionId]
        );
        const answeredIds = answeredRes.rows.map(r => r.problem_id);

        res.json({ session: sessionRes.rows[0], answeredProblemIds: answeredIds });
    } catch (err) {
        console.error('Session state error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/problem-sets/sessions/:sessionId/answer – submit an answer
router.post('/sessions/:sessionId/answer', auth, async (req, res) => {
    try {
        const { problemId, answer } = req.body;
        if (!problemId || answer === undefined) return res.status(400).json({ error: 'problemId and answer are required' });

        const sessionRes = await db.query(
            `SELECT pss.* FROM problem_set_sessions pss WHERE pss.id = $1 AND pss.user_id = $2`,
            [req.params.sessionId, req.user.id]
        );
        if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Session not found' });
        if (sessionRes.rows[0].completed) return res.status(400).json({ error: 'Session is already completed' });

        // Check if already answered
        const existingAttempt = await db.query(
            `SELECT id FROM problem_attempts WHERE session_id = $1 AND problem_id = $2`,
            [req.params.sessionId, problemId]
        );
        if (existingAttempt.rows.length > 0) return res.status(400).json({ error: 'Already answered this question' });

        const problemRes = await db.query('SELECT * FROM problems WHERE id = $1', [problemId]);
        if (problemRes.rows.length === 0) return res.status(404).json({ error: 'Problem not found' });
        const problem = problemRes.rows[0];

        let isCorrect = null;
        let aiFeedback = null;

        if (problem.type === 'objective') {
            // Static feedback — no AI call needed
            isCorrect = answer.trim().toUpperCase() === (problem.correct_answer || '').trim().toUpperCase();
            aiFeedback = problem.explanation || null;
        } else {
            // Subjective — dynamic AI feedback
            const completion = await openai.chat.completions.create({
                model: 'deepseek-chat',
                temperature: 0.5,
                max_tokens: 600,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful tutor evaluating student short answers. You must respond with ONLY a valid JSON object with exactly two keys: "feedback" (a brief 2-4 sentence string explaining what is correct or missing) and "isCorrect" (a boolean, true if the answer is reasonably correct or good enough to pass, false otherwise).'
                    },
                    {
                        role: 'user',
                        content: `Question: ${problem.question}\n\nModel Answer: ${problem.correct_answer || '(No model answer provided)'}\n\nStudent Answer: ${answer}`
                    }
                ],
            });

            try {
                let raw = completion.choices[0].message.content.trim();
                raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
                const evalData = JSON.parse(raw);
                aiFeedback = evalData.feedback || 'No feedback provided.';
                isCorrect = !!evalData.isCorrect;
            } catch (err) {
                console.error("Failed to parse subjective feedback:", err);
                aiFeedback = "Failed to parse AI output: " + completion.choices[0].message.content.trim();
                isCorrect = false;
            }
        }

        await db.query(
            `INSERT INTO problem_attempts (session_id, problem_id, user_answer, ai_feedback, is_correct)
             VALUES ($1, $2, $3, $4, $5)`,
            [req.params.sessionId, problemId, answer, aiFeedback, isCorrect]
        );

        res.json({ isCorrect, aiFeedback, correctAnswer: problem.type === 'objective' ? problem.correct_answer : null });
    } catch (err) {
        console.error('Submit answer error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/problem-sets/sessions/:sessionId/complete
router.post('/sessions/:sessionId/complete', auth, async (req, res) => {
    try {
        const sessionRes = await db.query(
            `SELECT * FROM problem_set_sessions WHERE id = $1 AND user_id = $2`,
            [req.params.sessionId, req.user.id]
        );
        if (sessionRes.rows.length === 0) return res.status(404).json({ error: 'Session not found' });

        // Compute score — count correct objective answers
        const scoreRes = await db.query(
            `SELECT COUNT(*) FROM problem_attempts WHERE session_id = $1 AND is_correct = true`,
            [req.params.sessionId]
        );
        const score = parseInt(scoreRes.rows[0].count);

        const updated = await db.query(
            `UPDATE problem_set_sessions SET completed = true, completed_at = NOW(), score = $1 WHERE id = $2 RETURNING *`,
            [score, req.params.sessionId]
        );

        res.json(updated.rows[0]);
    } catch (err) {
        console.error('Complete session error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
