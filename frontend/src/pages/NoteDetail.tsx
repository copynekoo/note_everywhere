import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import RatingWidget from '../components/RatingWidget';
import CommentThread from '../components/CommentThread';
import NoteCard from '../components/NoteCard';
import StudentProfileModal from '../components/StudentProfileModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { marked } from 'marked';
import {
    Trash2, Settings, Sparkles, AlertTriangle,
    Download, ExternalLink, BrainCircuit, BookOpen,
    BarChart2, FileText, Cpu, Bookmark
} from 'lucide-react';
import './NoteDetail.css';

interface NoteInfo {
    id: number;
    title: string;
    description?: string;
    file_path?: string;
    file_type?: string;
    external_link?: string;
    subject_name: string;
    subject_code: string;
    subject_id: number;
    major_name: string;
    faculty_name: string;
    uploader_student_id: string;
    uploader_name?: string;
    user_id: number;
    rating_score: number;
    likes: number;
    dislikes: number;
    comment_count: number;
    created_at: string;
    docling_status?: string;
    docling_result?: string;
    docling_progress?: number;
    ai_summary?: string;
}

interface Comment {
    id: number;
    note_id: number;
    user_id: number;
    parent_id: number | null;
    content: string;
    commenter_student_id: string;
    commenter_name?: string;
    created_at: string;
    updated_at: string;
}

interface RelatedNote {
    id: number;
    title: string;
    description?: string;
    subject_name: string;
    subject_code: string;
    uploader_student_id: string;
    uploader_name?: string;
    rating_score: number;
    file_type?: string;
    created_at: string;
}

export default function NoteDetail() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();
    const [note, setNote] = useState<NoteInfo | null>(null);
    const [comments, setComments] = useState<Comment[]>([]);
    const [related, setRelated] = useState<RelatedNote[]>([]);
    const [userRating, setUserRating] = useState(0);
    const [loading, setLoading] = useState(true);
    const [profileStudentId, setProfileStudentId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [isBookmarked, setIsBookmarked] = useState(false);
    const [bookmarkLoading, setBookmarkLoading] = useState(false);

    const toggleBookmarkNote = async () => {
        if (!note || bookmarkLoading) return;
        setBookmarkLoading(true);
        try {
            if (isBookmarked) {
                await api.delete(`/bookmarks/note/${note.id}`);
                setIsBookmarked(false);
            } else {
                await api.post('/bookmarks', {
                    item_type: 'note',
                    item_id: note.id,
                    title: note.title
                });
                setIsBookmarked(true);
            }
        } catch (err: any) {
            console.error('Bookmark error:', err);
        } finally {
            setBookmarkLoading(false);
        }
    };

    // Docling state
    const [doclingProcessing, setDoclingProcessing] = useState(false);
    const [doclingProgress, setDoclingProgress] = useState(0);
    const [doclingMessage, setDoclingMessage] = useState('');
    const [doclingError, setDoclingError] = useState<string | null>(null);
    const sseRef = useRef<AbortController | null>(null);

    // AI state
    const [aiProcessing, setAiProcessing] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'file' | 'raw' | 'summary'>('file');
    const tabRef = useRef<HTMLDivElement>(null);
    const summaryBodyRef = useRef<HTMLDivElement>(null);

    const handleViewProcessedContent = () => {
        setActiveTab('raw');
        tabRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // ── Export helpers ─────────────────────────────────────────────────────
    const handleExportMd = () => {
        if (!note?.ai_summary) return;
        const blob = new Blob([note.ai_summary], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${note.title.replace(/[^a-z0-9]/gi, '_')}_summary.md`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const [exportingPdf, setExportingPdf] = useState(false);
    const handleExportPdf = () => {
        if (!note?.ai_summary) return;
        setExportingPdf(true);
        try {
            // Pre-process LaTeX delimiters: convert \[...\] and \(...\) to $$...$$ and $...$
            const processedMarkdown = note.ai_summary
                .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
                .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$');

            const htmlBody = marked.parse(processedMarkdown) as string;
            const safeTitle = note.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');

            const printHtml = `<!DOCTYPE html>
        <html lang="en">
            <head>
            <meta charset="UTF-8" />
            <title>${safeTitle} – AI Summary</title>
            <!-- KaTeX for math rendering -->
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/katex.min.css" crossorigin="anonymous" />
            <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/katex.min.js" crossorigin="anonymous"></script>
            <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.45/dist/contrib/auto-render.min.js" crossorigin="anonymous"
                onload="renderMathInElement(document.body, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false}
                ],
                throwOnError: false
                });"></script>
            <style>
                *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
                html { font-size: 15px; }
                body {
                font-family: 'Segoe UI', 'Inter', system-ui, sans-serif;
                color: #1a1a2e;
                background: #fff;
                padding: 2.5rem 3rem;
                line-height: 1.8;
                max-width: 860px;
                margin: 0 auto;
                }
                .doc-title {
                font-size: 1.5rem;
                font-weight: 800;
                color: #1a1a2e;
                margin-bottom: 0.25rem;
                }
                .doc-meta {
                font-size: 0.78rem;
                color: #6b7280;
                margin-bottom: 2rem;
                padding-bottom: 1rem;
                border-bottom: 2px solid #e5e7eb;
                }
                h1, h2, h3, h4, h5, h6 {
                font-weight: 700;
                line-height: 1.3;
                color: #111827;
                margin-top: 1.6em;
                margin-bottom: 0.5em;
                }
                h1 { font-size: 1.5rem; border-bottom: 2px solid #6366f1; padding-bottom: 0.3em; }
                h2 { font-size: 1.2rem; border-bottom: 1px solid #e5e7eb; padding-bottom: 0.2em; color: #4f46e5; }
                h3 { font-size: 1.05rem; color: #6366f1; }
                h4 { font-size: 0.95rem; color: #374151; }
                h5, h6 { font-size: 0.875rem; color: #6b7280; }
                p { margin-bottom: 0.85em; color: #374151; }
                ul, ol { margin: 0.5em 0 0.85em 1.6em; }
                ul { list-style: none; }
                ul > li { position: relative; padding-left: 0.2em; margin-bottom: 0.3em; }
                ul > li::before { content: "•"; position: absolute; left: -1.1em; color: #6366f1; font-size: 1.1em; }
                ul ul { margin-top: 0.25em; margin-bottom: 0.25em; }
                ul ul > li::before { content: "◇"; color: #8b5cf6; font-size: 0.85em; }
                ul ul ul > li::before { content: "–"; color: #9ca3af; }
                ol { list-style: decimal; }
                ol > li { padding-left: 0.2em; margin-bottom: 0.3em; color: #374151; }
                ol ol { list-style: lower-alpha; margin-top: 0.25em; }
                ol ol ol { list-style: lower-roman; }
                li { color: #374151; }
                code {
                font-family: 'Fira Code', 'Courier New', monospace;
                font-size: 0.82em;
                background: #f3f0ff;
                color: #5b21b6;
                border: 1px solid #ddd6fe;
                border-radius: 4px;
                padding: 0.1em 0.4em;
                }
                pre {
                background: #f8fafc;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                padding: 1em 1.25em;
                overflow-x: auto;
                margin: 0.75em 0;
                page-break-inside: avoid;
                }
                pre code { background: none; border: none; padding: 0; color: #374151; font-size: 0.85rem; }
                blockquote {
                margin: 0.75em 0;
                padding: 0.5em 1em;
                border-left: 3px solid #6366f1;
                background: #f5f3ff;
                border-radius: 0 4px 4px 0;
                color: #4b5563;
                font-style: italic;
                }
                hr { border: none; border-top: 1px solid #e5e7eb; margin: 1.5em 0; }
                strong, b { font-weight: 700; color: #111827; }
                em, i { font-style: italic; color: #374151; }
                a { color: #4f46e5; text-decoration: underline; }
                table {
                width: 100%;
                border-collapse: collapse;
                margin: 1em 0;
                font-size: 0.88rem;
                page-break-inside: avoid;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                overflow: hidden;
                }
                th, td {
                padding: 0.55rem 0.85rem;
                text-align: left;
                border-bottom: 1px solid #e5e7eb;
                border-right: 1px solid #e5e7eb;
                }
                th {
                background: #eef2ff;
                font-weight: 700;
                color: #312e81;
                text-transform: uppercase;
                font-size: 0.75rem;
                letter-spacing: 0.04em;
                }
                tr:last-child td { border-bottom: 2px solid #e5e7eb; }
                td:last-child, th:last-child { border-right: none; }
                /* KaTeX display math spacing */
                .katex-display {
                margin: 1em 0;
                overflow-x: auto;
                overflow-y: hidden;
                }
                @media print {
                body { padding: 1.5rem 2rem; }
                h1, h2, h3 { page-break-after: avoid; }
                pre, table, blockquote, .katex-display { page-break-inside: avoid; }
                }
            </style>
            </head>
            <body>
            <div class="doc-title">${safeTitle}</div>
            <div class="doc-meta">AI Summary &nbsp;·&nbsp; Generated by DeepSeek &nbsp;·&nbsp; ${new Date().toLocaleDateString()}</div>
            ${htmlBody}
            </body>
            </html>`;

            const win = window.open('', '_blank', 'width=900,height=700');
            if (!win) { setExportingPdf(false); return; }
            win.document.write(printHtml);
            win.document.close();

            // Wait for KaTeX scripts to load and render before printing
            win.onload = () => {
                // Poll until renderMathInElement has run (KaTeX auto-render fires on DOMContentLoaded)
                let attempts = 0;
                const waitForKatex = setInterval(() => {
                    attempts++;
                    const hasKatex = win.document.querySelector('.katex') !== null;
                    const timeout = attempts > 30; // ~3 seconds max
                    if (hasKatex || timeout) {
                        clearInterval(waitForKatex);
                        setTimeout(() => {
                            win.print();
                            setExportingPdf(false);
                        }, 200);
                    }
                }, 100);
            };

            // Fallback
            setTimeout(() => setExportingPdf(false), 8000);
        } catch (e) {
            console.error('PDF export failed:', e);
            setExportingPdf(false);
        }
    };

    const loadData = useCallback(async () => {
        if (!id) return;
        try {
            const [noteRes, commentsRes, relatedRes] = await Promise.all([
                api.get(`/notes/${id}`),
                api.get(`/comments/note/${id}`),
                api.get(`/notes/${id}/related`),
            ]);
            setNote(noteRes.data);
            setComments(commentsRes.data);
            setRelated(relatedRes.data);
            if (user) {
                const rateRes = await api.get(`/notes/${id}/user-rating`);
                setUserRating(rateRes.data.value);

                try {
                    const bmRes = await api.get('/bookmarks');
                    if (bmRes.data.some((b: any) => b.item_type === 'note' && String(b.item_id) === String(id))) {
                        setIsBookmarked(true);
                    }
                } catch (e) {
                    console.error('Failed to load bookmarks');
                }
            }
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    }, [id, user]);

    useEffect(() => { loadData(); }, [loadData]);

    const refreshComments = async () => {
        if (!id) return;
        const res = await api.get(`/comments/note/${id}`);
        setComments(res.data);
    };

    const handleDelete = async () => {
        if (!note || !window.confirm('Are you sure you want to delete this note? This cannot be undone.')) return;
        setDeleting(true);
        try {
            await api.delete(`/notes/${note.id}`);
            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            setDeleting(false);
        }
    };

    const handleProcessDocument = async () => {
        if (!note || !id) return;
        setDoclingProcessing(true);
        setDoclingProgress(0);
        setDoclingMessage('Connecting...');
        setDoclingError(null);

        // Abort any existing SSE stream
        if (sseRef.current) sseRef.current.abort();
        const controller = new AbortController();
        sseRef.current = controller;

        try {
            const token = localStorage.getItem('ne_token');
            const response = await fetch(
                `/api/docling/${id}/process`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                    signal: controller.signal,
                }
            );

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(errText || 'Failed to start processing');
            }

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buf = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buf += decoder.decode(value, { stream: true });
                const lines = buf.split('\n');
                buf = lines.pop() ?? '';
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const parsed = JSON.parse(line.slice(6));
                            if (parsed.progress !== undefined) {
                                setDoclingProgress(parsed.progress);
                            }
                            if (parsed.message) {
                                setDoclingMessage(parsed.message);
                            }
                            if (parsed.error) {
                                setDoclingError(parsed.error);
                            }
                            if (parsed.done) {
                                // Refresh note data to get the result
                                const noteRes = await api.get(`/notes/${id}`);
                                setNote(noteRes.data);
                                if (!parsed.error) {
                                    // Removed setting showDocResult, tabs handle visibility natively
                                }
                            }
                        } catch { /* ignore parse errors */ }
                    }
                }
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name !== 'AbortError') {
                setDoclingError(String(err));
            }
        } finally {
            setDoclingProcessing(false);
        }
    };

    const handleAiSummarize = async () => {
        if (!note || !id) return;
        setAiProcessing(true);
        setAiError(null);
        try {
            const res = await api.post(`/notes/${id}/summarize`);
            setNote({ ...note, ai_summary: res.data.ai_summary });
            setActiveTab('summary');
        } catch (err: any) {
            setAiError(err.response?.data?.error || err.message || 'Failed to summarize');
        } finally {
            setAiProcessing(false);
        }
    };

    if (loading) {
        return <div className="page container"><div className="loader-wrapper"><div className="spinner" /></div></div>;
    }

    if (!note) {
        return <div className="page container"><div className="empty-state"><p>Note not found</p></div></div>;
    }

    const uploaderDisplay = note.uploader_name
        ? `${note.uploader_name} (${note.uploader_student_id})`
        : note.uploader_student_id;

    const renderFileViewer = () => {
        if (!note.file_path && !note.external_link) return null;

        return (
            <>
                {note.file_path && (() => {
                    const url = `/uploads/${note.file_path}`;
                    if (note.file_type?.includes('pdf')) {
                        return <iframe className="file-viewer-iframe" src={url} title={note.title} />;
                    }
                    if (note.file_type?.includes('image')) {
                        return <img className="file-viewer-image" src={url} alt={note.title} />;
                    }
                    if (note.file_type?.includes('audio')) {
                        return <audio className="file-viewer-audio" controls src={url} />;
                    }
                    if (note.file_type?.includes('video')) {
                        return <video className="file-viewer-video" controls src={url} />;
                    }
                    return (
                        <a href={url} className="btn btn-secondary" download style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Download size={16} /> Download File
                        </a>
                    );
                })()}
                {note.external_link && (
                    <a href={note.external_link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ marginTop: note.file_path ? '0.75rem' : 0, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        <ExternalLink size={16} /> Open External Link
                    </a>
                )}
            </>
        );
    };

    const hasDoclingResult = note.docling_status === 'done' && note.docling_result;
    const alreadyProcessed = note.docling_status === 'done';

    return (
        <div className="page container" id="note-detail-page">
            <div className="note-detail-layout">
                <div className="note-detail-main">
                    {/* Header */}
                    <div className="note-detail-header glass-card animate-fade-in">
                        <div className="note-detail-breadcrumb">
                            <Link to="/browse">Browse</Link> /&nbsp;
                            <Link to={`/subject/${note.subject_id}`}>{note.subject_code} – {note.subject_name}</Link>
                        </div>
                        <h1 className="note-detail-title">{note.title}</h1>
                        {note.description && <p className="note-detail-desc">{note.description}</p>}
                        <div className="note-detail-meta">
                            <span
                                className="clickable-student-id"
                                onClick={() => setProfileStudentId(note.uploader_student_id)}
                                title="View profile"
                            >
                                {uploaderDisplay}
                            </span>
                            <span> {note.subject_name}</span>
                            <span> {new Date(note.created_at).toLocaleDateString()}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: '0.75rem' }}>
                            <button
                                className={`btn btn-sm ${isBookmarked ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={toggleBookmarkNote}
                                disabled={bookmarkLoading}
                            >
                                <Bookmark size={14} fill={isBookmarked ? "currentColor" : "none"} />
                                {bookmarkLoading ? '...' : isBookmarked ? 'Bookmarked' : 'Bookmark Note'}
                            </button>
                            {/* Delete button for owner */}
                            {user && user.id === note.user_id && (
                                <button
                                    className="btn btn-danger btn-sm"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    id="delete-note-btn"
                                >
                                    {deleting ? <Settings size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                    {deleting ? ' Deleting...' : ' Delete Note'}
                                </button>
                            )}
                        </div>
                    </div>

                    {/* File Viewer merged into tabs below */}

                    {/* Docling — Process Document */}
                    {note.file_path && user && (
                        <div className="docling-section glass-card animate-fade-in">
                            <div className="docling-header">
                                <div className="docling-title-row">
                                    <span className="docling-icon"><Settings size={22} color="#0071e3" /></span>
                                    <h3 className="docling-title">Document Processing</h3>
                                    {alreadyProcessed && (
                                        <span className="docling-badge docling-badge--done">Processed</span>
                                    )}
                                    {note.docling_status === 'error' && (
                                        <span className="docling-badge docling-badge--error">Error</span>
                                    )}
                                </div>
                                <button
                                    id="process-document-btn"
                                    className={`btn btn-process-doc ${doclingProcessing ? 'btn-process-doc--loading' : ''}`}
                                    onClick={handleProcessDocument}
                                    disabled={doclingProcessing}
                                >
                                    <Settings size={16} className={doclingProcessing ? "animate-spin" : ""} />
                                    {doclingProcessing
                                        ? ' Processing...'
                                        : alreadyProcessed
                                            ? ' Re-process Document'
                                            : ' Process Document'}
                                </button>
                            </div>

                            {/* Progress bar */}
                            {doclingProcessing && (
                                <div className="docling-progress-wrapper">
                                    <div className="docling-progress-bar">
                                        <div
                                            className="docling-progress-fill"
                                            style={{ width: `${doclingProgress}%` }}
                                        />
                                    </div>
                                    <div className="docling-progress-meta">
                                        <span className="docling-progress-msg">{doclingMessage}</span>
                                        <span className="docling-progress-pct">{doclingProgress}%</span>
                                    </div>
                                </div>
                            )}

                            {/* Error */}
                            {doclingError && !doclingProcessing && (
                                <div className="docling-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <AlertTriangle size={16} /> Processing failed. Please try again.
                                </div>
                            )}

                            {/* Result toggle */}
                            {hasDoclingResult && !doclingProcessing && (
                                <button
                                    className="btn btn-secondary btn-sm docling-toggle"
                                    onClick={handleViewProcessedContent}
                                >
                                    <FileText size={16} /> View Processed Content
                                </button>
                            )}
                        </div>
                    )}

                    {/* Problem Set Quick Actions */}
                    {user && (
                        <div className="glass-card animate-fade-in" style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', padding: 'var(--space-4) var(--space-5)', marginBottom: 'var(--space-4)' }}>
                            <Link
                                to={`/note/${note.id}/generate-problems`}
                                className="btn btn-secondary btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                                <BrainCircuit size={16} color="#0071e3" /> Generate Problem Set
                            </Link>
                            <Link
                                to={`/note/${note.id}/problem-sets`}
                                className="btn btn-secondary btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                                <BookOpen size={16} color="#0071e3" /> Browse Problem Sets
                            </Link>
                            <Link
                                to={`/note/${note.id}/analytics`}
                                className="btn btn-secondary btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                            >
                                <BarChart2 size={16} color="#0071e3" /> Analytics
                            </Link>
                        </div>
                    )}


                    {/* Output Tabs */}
                    {(note.file_path || note.external_link) && (
                        <div className="output-tabs-container animate-fade-in" style={{ marginBottom: 'var(--space-6)' }} ref={tabRef}>
                            <div className="tab-header" style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                                <button
                                    className={`btn btn-sm ${activeTab === 'file' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setActiveTab('file')}
                                    style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', padding: 'var(--space-3) var(--space-5)', borderBottom: 'none' }}
                                >
                                    File Viewer
                                </button>
                                {hasDoclingResult && (
                                    <button
                                        className={`btn btn-sm ${activeTab === 'raw' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setActiveTab('raw')}
                                        style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', padding: 'var(--space-3) var(--space-5)', borderBottom: 'none' }}
                                    >
                                        Raw File Content
                                    </button>
                                )}
                                {note.ai_summary && (
                                    <button
                                        className={`btn btn-sm ${activeTab === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
                                        onClick={() => setActiveTab('summary')}
                                        style={{ borderRadius: 'var(--radius-md) var(--radius-md) 0 0', padding: 'var(--space-3) var(--space-5)', borderBottom: 'none' }}
                                    >
                                        AI Summary
                                    </button>
                                )}
                            </div>

                            <div className="tab-content glass-card" style={{ borderTopLeftRadius: activeTab === 'file' ? '0' : '0', padding: activeTab === 'file' ? '0' : 'var(--space-6)' }}>
                                {activeTab === 'file' && (
                                    <div className="file-viewer-tab">
                                        {renderFileViewer()}
                                    </div>
                                )}

                                {activeTab === 'raw' && hasDoclingResult && (
                                    <div className="docling-result-content-wrapper">
                                        <div className="docling-result-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)', alignItems: 'center' }}>
                                            <div>
                                                <h3 style={{ margin: 0, fontSize: 'var(--font-size-lg)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <FileText size={20} /> Processed Document
                                                </h3>
                                                <span className="docling-result-hint">Extracted by Docling · Markdown format</span>
                                            </div>
                                            {!note.ai_summary && (
                                                <button
                                                    className={`btn btn-sm btn-process-doc ${aiProcessing ? 'btn-process-doc--loading' : ''}`}
                                                    onClick={handleAiSummarize}
                                                    disabled={aiProcessing}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                >
                                                    {aiProcessing ? <Cpu size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                                    {aiProcessing ? 'Generating Summary...' : ' Generate AI Summary'}
                                                </button>
                                            )}
                                        </div>
                                        {aiError && (
                                            <div className="docling-error" style={{ marginBottom: 'var(--space-3)' }}>
                                                ️ {aiError}
                                            </div>
                                        )}
                                        <pre className="docling-result-content">{note.docling_result}</pre>
                                    </div>
                                )}

                                {activeTab === 'summary' && note.ai_summary && (() => {
                                    const wordCount = note.ai_summary.trim().split(/\s+/).length;
                                    return (
                                        <div className="ai-summary-wrapper">
                                            {/* Toolbar */}
                                            <div className="ai-summary-toolbar">
                                                <div className="ai-summary-toolbar-left">
                                                    <span className="ai-summary-toolbar-title"><Sparkles size={18} color="#0071e3" /> AI Summary</span>
                                                    <span style={{
                                                        fontSize: '0.7rem', fontWeight: 600,
                                                        background: 'rgba(99,102,241,0.18)', color: '#a5b4fc',
                                                        border: '1px solid rgba(99,102,241,0.3)',
                                                        borderRadius: '999px', padding: '1px 8px',
                                                    }}>DeepSeek</span>
                                                    <span className="ai-summary-hint">{wordCount.toLocaleString()} words</span>
                                                </div>
                                                <div className="ai-summary-export-btns">
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={handleExportMd}
                                                        title="Download as Markdown file"
                                                    >
                                                        ⬇ .md
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary btn-sm"
                                                        onClick={handleExportPdf}
                                                        disabled={exportingPdf}
                                                        title="Export as PDF"
                                                    >
                                                        {exportingPdf ? ' Exporting…' : '⬇ PDF'}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Scrollable body */}
                                            <div className="ai-summary-body" ref={summaryBodyRef}>
                                                <div className="markdown-preview">
                                                    <ReactMarkdown
                                                        remarkPlugins={[remarkGfm, remarkMath]}
                                                        rehypePlugins={[rehypeKatex]}
                                                    >
                                                        {note.ai_summary ? note.ai_summary
                                                            .replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$')
                                                            .replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$$') : ''}
                                                    </ReactMarkdown>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                    )}

                    {/* Rating */}
                    {user && (
                        <div className="note-detail-rating animate-fade-in">
                            <RatingWidget
                                noteId={note.id}
                                initialScore={Number(note.rating_score)}
                                initialLikes={Number(note.likes)}
                                initialDislikes={Number(note.dislikes)}
                                initialUserRating={userRating}
                            />
                        </div>
                    )}

                    {/* Comments */}
                    <CommentThread noteId={note.id} comments={comments} onRefresh={refreshComments} />
                </div>

                {/* Sidebar */}
                <aside className="note-detail-sidebar">
                    <h3 className="section-title"><BookOpen size={20} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} /> Related Notes</h3>
                    {related.length === 0 ? (
                        <p className="empty-state" style={{ padding: '1rem' }}>No related notes</p>
                    ) : (
                        <div className="related-notes stagger">
                            {related.map((n) => <NoteCard key={n.id} note={n} />)}
                        </div>
                    )}
                </aside>
            </div>

            {/* Student Profile Modal */}
            {profileStudentId && (
                <StudentProfileModal
                    studentId={profileStudentId}
                    onClose={() => setProfileStudentId(null)}
                />
            )}
        </div>
    );
}
