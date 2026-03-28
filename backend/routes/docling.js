const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const db = require('../db');
const auth = require('../middleware/auth');
const router = express.Router();

const PYTHON_BIN = '/home/miku/env/python3-default/bin/python';
const WORKER_SCRIPT = path.join(__dirname, '..', 'docling_worker.py');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const DB_URL = process.env.DATABASE_URL;

// POST /api/docling/:noteId/process — starts processing, streams SSE progress
router.post('/:noteId/process', auth, async (req, res) => {
    const { noteId } = req.params;

    try {
        // Fetch note
        const noteRes = await db.query(
            'SELECT id, file_path, docling_status FROM notes WHERE id = $1',
            [noteId]
        );
        if (noteRes.rows.length === 0) {
            return res.status(404).json({ error: 'Note not found' });
        }

        const note = noteRes.rows[0];

        if (!note.file_path) {
            return res.status(400).json({ error: 'Note has no uploaded file to process' });
        }

        if (note.docling_status === 'processing') {
            return res.status(409).json({ error: 'Processing already in progress' });
        }

        // Reset DB state
        await db.query(
            "UPDATE notes SET docling_status='processing', docling_progress=0, docling_result=NULL WHERE id=$1",
            [noteId]
        );

        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();

        const sendEvent = (data) => {
            if (!res.writableEnded) {
                res.write(`data: ${JSON.stringify(data)}\n\n`);
            }
        };

        sendEvent({ progress: 0, message: 'Starting...' });

        const filePath = path.join(UPLOADS_DIR, note.file_path);

        const worker = spawn(PYTHON_BIN, [
            WORKER_SCRIPT,
            '--file', filePath,
            '--note-id', String(noteId),
            '--db-url', DB_URL,
        ]);

        // Buffer to accumulate partial JSON lines from stdout
        let buffer = '';

        worker.stdout.on('data', (chunk) => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep last incomplete line

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;
                try {
                    const parsed = JSON.parse(trimmed);
                    sendEvent(parsed);
                } catch {
                    // Non-JSON output — ignore
                }
            }
        });

        worker.stderr.on('data', (chunk) => {
            console.error('[docling worker stderr]', chunk.toString());
        });

        worker.on('close', (code) => {
            if (code === 0) {
                sendEvent({ progress: 100, done: true });
            } else {
                sendEvent({ progress: 0, error: 'Processing failed', done: true });
            }
            if (!res.writableEnded) res.end();
        });

        req.on('close', () => {
            // Client disconnected — kill worker to free resources
            worker.kill();
        });

    } catch (err) {
        console.error('Docling process error:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        } else {
            res.end();
        }
    }
});

// GET /api/docling/:noteId/status — poll-based fallback
router.get('/:noteId/status', async (req, res) => {
    try {
        const result = await db.query(
            'SELECT docling_status, docling_progress, docling_result FROM notes WHERE id = $1',
            [req.params.noteId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Note not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Docling status error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
