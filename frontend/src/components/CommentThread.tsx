import { useState } from 'react';
import type { FormEvent } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import StudentProfileModal from './StudentProfileModal';
import './CommentThread.css';

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

interface CommentThreadProps {
    noteId: number;
    comments: Comment[];
    onRefresh: () => void;
}

export default function CommentThread({ noteId, comments, onRefresh }: CommentThreadProps) {
    const { user } = useAuth();
    const [newComment, setNewComment] = useState('');
    const [replyTo, setReplyTo] = useState<number | null>(null);
    const [editId, setEditId] = useState<number | null>(null);
    const [editContent, setEditContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [profileStudentId, setProfileStudentId] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!newComment.trim() || submitting) return;
        setSubmitting(true);
        try {
            await api.post(`/comments/note/${noteId}`, {
                content: newComment.trim(),
                parentId: replyTo,
            });
            setNewComment('');
            setReplyTo(null);
            onRefresh();
        } catch (err) {
            console.error(err);
        }
        setSubmitting(false);
    };

    const handleEdit = async (id: number) => {
        if (!editContent.trim()) return;
        try {
            await api.put(`/comments/${id}`, { content: editContent.trim() });
            setEditId(null);
            setEditContent('');
            onRefresh();
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await api.delete(`/comments/${id}`);
            onRefresh();
        } catch (err) {
            console.error(err);
        }
    };

    const topLevel = comments.filter((c) => !c.parent_id);
    const replies = (parentId: number) => comments.filter((c) => c.parent_id === parentId);

    const formatCommenter = (c: Comment) => {
        return c.commenter_name
            ? `${c.commenter_name} (${c.commenter_student_id})`
            : c.commenter_student_id;
    };

    const renderComment = (c: Comment, depth: number = 0) => (
        <div key={c.id} className={`comment ${depth > 0 ? 'reply' : ''}`} style={{ marginLeft: depth * 24 }} id={`comment-${c.id}`}>
            <div className="comment-header">
                <span
                    className="comment-author clickable-student-id"
                    onClick={() => setProfileStudentId(c.commenter_student_id)}
                    title="View profile"
                >
                    🎓 {formatCommenter(c)}
                </span>
                <span className="comment-time">{new Date(c.created_at).toLocaleString()}</span>
            </div>

            {editId === c.id ? (
                <div className="comment-edit">
                    <textarea
                        className="textarea"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={2}
                    />
                    <div className="comment-edit-actions">
                        <button className="btn btn-primary btn-sm" onClick={() => handleEdit(c.id)}>Save</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setEditId(null)}>Cancel</button>
                    </div>
                </div>
            ) : (
                <p className="comment-content">{c.content}</p>
            )}

            <div className="comment-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => { setReplyTo(c.id); }}>Reply</button>
                {user && user.id === c.user_id && editId !== c.id && (
                    <>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditId(c.id); setEditContent(c.content); }}>Edit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id)}>Delete</button>
                    </>
                )}
            </div>

            {replies(c.id).map((r) => renderComment(r, depth + 1))}
        </div>
    );

    return (
        <div className="comment-thread" id="comment-thread">
            <h3 className="section-title">💬 Comments ({comments.length})</h3>

            <form className="comment-form" onSubmit={handleSubmit}>
                {replyTo && (
                    <div className="reply-indicator">
                        Replying to comment...
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setReplyTo(null)}>✕</button>
                    </div>
                )}
                <textarea
                    className="textarea"
                    placeholder="Write a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={3}
                    id="comment-input"
                />
                <button type="submit" className="btn btn-primary" disabled={!newComment.trim() || submitting} id="post-comment-btn">
                    {submitting ? 'Posting...' : 'Post Comment'}
                </button>
            </form>

            <div className="comments-list stagger">
                {topLevel.length === 0 ? (
                    <div className="empty-state">
                        <p>No comments yet. Be the first!</p>
                    </div>
                ) : (
                    topLevel.map((c) => renderComment(c))
                )}
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
