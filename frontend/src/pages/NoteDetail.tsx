import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import RatingWidget from '../components/RatingWidget';
import CommentThread from '../components/CommentThread';
import NoteCard from '../components/NoteCard';
import StudentProfileModal from '../components/StudentProfileModal';
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

    // Docling state
    const [doclingProcessing, setDoclingProcessing] = useState(false);
    const [doclingProgress, setDoclingProgress] = useState(0);
    const [doclingMessage, setDoclingMessage] = useState('');
    const [doclingError, setDoclingError] = useState<string | null>(null);
    const [showDocResult, setShowDocResult] = useState(false);
    const sseRef = useRef<AbortController | null>(null);

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
        setShowDocResult(false);

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
                                    setShowDocResult(true);
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
                        <a href={url} className="btn btn-secondary" download>
                            📥 Download File
                        </a>
                    );
                })()}
                {note.external_link && (
                    <a href={note.external_link} target="_blank" rel="noopener noreferrer" className="btn btn-secondary" style={{ marginTop: note.file_path ? '0.75rem' : 0, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        🔗 Open External Link
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
                                🎓 {uploaderDisplay}
                            </span>
                            <span>📚 {note.subject_name}</span>
                            <span>🗓 {new Date(note.created_at).toLocaleDateString()}</span>
                        </div>
                        {/* Delete button for owner */}
                        {user && user.id === note.user_id && (
                            <button
                                className="btn btn-danger btn-sm"
                                onClick={handleDelete}
                                disabled={deleting}
                                style={{ marginTop: '0.75rem' }}
                                id="delete-note-btn"
                            >
                                {deleting ? 'Deleting...' : '🗑️ Delete Note'}
                            </button>
                        )}
                    </div>

                    {/* File Viewer */}
                    {renderFileViewer() && (
                        <div className="file-viewer glass-card animate-fade-in">
                            {renderFileViewer()}
                        </div>
                    )}

                    {/* Docling — Process Document */}
                    {note.file_path && user && (
                        <div className="docling-section glass-card animate-fade-in">
                            <div className="docling-header">
                                <div className="docling-title-row">
                                    <span className="docling-icon">🤖</span>
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
                                    {doclingProcessing
                                        ? '⚙️ Processing...'
                                        : alreadyProcessed
                                            ? '🔄 Re-process Document'
                                            : '⚡ Process Document'}
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
                                <div className="docling-error">
                                    ⚠️ Processing failed. Please try again.
                                </div>
                            )}

                            {/* Result toggle */}
                            {hasDoclingResult && !doclingProcessing && (
                                <button
                                    className="btn btn-secondary btn-sm docling-toggle"
                                    onClick={() => setShowDocResult((v) => !v)}
                                >
                                    {showDocResult ? '🔼 Hide Processed Content' : '🔽 View Processed Content'}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Docling Result Panel */}
                    {hasDoclingResult && showDocResult && !doclingProcessing && (
                        <div className="docling-result glass-card animate-fade-in">
                            <div className="docling-result-header">
                                <h3>📄 Processed Document</h3>
                                <span className="docling-result-hint">Extracted by Docling · Markdown format</span>
                            </div>
                            <pre className="docling-result-content">{note.docling_result}</pre>
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
                    <h3 className="section-title">📎 Related Notes</h3>
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
