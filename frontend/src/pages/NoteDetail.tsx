import { useState, useEffect, useCallback } from 'react';
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
