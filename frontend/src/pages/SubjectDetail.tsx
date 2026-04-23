import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import NoteCard from '../components/NoteCard';
import { BookOpen, FileQuestion } from 'lucide-react';
import './SubjectDetail.css';

interface SubjectInfo {
    id: number;
    code: string;
    name: string;
    year_level: number;
    major_name: string;
    faculty_name: string;
}

interface Note {
    id: number;
    title: string;
    description?: string;
    subject_name: string;
    subject_code: string;
    uploader_student_id: string;
    rating_score: number;
    comment_count?: number;
    file_type?: string;
    created_at: string;
}

export default function SubjectDetail() {
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();
    const [subject, setSubject] = useState<SubjectInfo | null>(null);
    const [notes, setNotes] = useState<Note[]>([]);
    const [following, setFollowing] = useState(false);
    const [sort, setSort] = useState('newest');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!id) return;
        const load = async () => {
            try {
                const [subRes, notesRes] = await Promise.all([
                    api.get(`/subjects/${id}`),
                    api.get(`/notes?subjectId=${id}&sort=${sort}`),
                ]);
                setSubject(subRes.data);
                setNotes(notesRes.data);
                if (user) {
                    const fRes = await api.get(`/subjects/${id}/is-following`);
                    setFollowing(fRes.data.following);
                }
            } catch (err) {
                console.error(err);
            }
            setLoading(false);
        };
        load();
    }, [id, sort, user]);

    const toggleFollow = async () => {
        if (!id) return;
        try {
            if (following) {
                await api.delete(`/subjects/${id}/follow`);
            } else {
                await api.post(`/subjects/${id}/follow`);
            }
            setFollowing(!following);
        } catch (err) {
            console.error(err);
        }
    };

    if (loading) {
        return <div className="page container"><div className="loader-wrapper"><div className="spinner" /></div></div>;
    }

    if (!subject) {
        return <div className="page container"><div className="empty-state"><p>Subject not found</p></div></div>;
    }

    return (
        <div className="page container" id="subject-detail-page">
            <div className="subject-hero glass-card animate-fade-in">
                <div className="subject-breadcrumb">
                    <Link to="/browse">Browse</Link> / {subject.faculty_name} / {subject.major_name}
                </div>
                <div className="subject-header">
                    <div>
                        <span className="badge badge-primary subject-code-badge">{subject.code}</span>
                        <h1 className="subject-title">{subject.name}</h1>
                        <p className="subject-meta">
                            Curriculum Year: {subject.year_level} &nbsp;·&nbsp; {subject.major_name}
                        </p>
                    </div>
                    {user && (
                        <button
                            className={`btn ${following ? 'btn-secondary' : 'btn-primary'}`}
                            onClick={toggleFollow}
                            id="follow-btn"
                        >
                            {following ? ' Following' : '+ Follow'}
                        </button>
                    )}
                </div>
            </div>

            <div className="subject-notes-header">
                <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <BookOpen size={24} color="#0071e3" /> Notes ({notes.length})
                </h2>
                <div className="sort-controls">
                    <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} id="sort-select">
                        <option value="newest">Newest First</option>
                        <option value="oldest">Oldest First</option>
                        <option value="popular">Most Popular</option>
                    </select>
                    <Link to="/upload" className="btn btn-primary btn-sm">Upload Note</Link>
                </div>
            </div>

            {notes.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-icon"><FileQuestion size={48} color="#94a3b8" strokeWidth={1.5} /></div>
                    <p>No notes uploaded for this subject yet.</p>
                    <Link to="/upload" className="btn btn-primary">Be the first to upload!</Link>
                </div>
            ) : (
                <div className="note-grid stagger">
                    {notes.map((n) => <NoteCard key={n.id} note={n} />)}
                </div>
            )}
        </div>
    );
}
