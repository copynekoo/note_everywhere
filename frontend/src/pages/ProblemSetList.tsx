import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { BookOpen, Sparkles, Globe, Play, History, ArrowLeft, Hash } from 'lucide-react';
import './ProblemSetList.css';

interface ProblemSetInfo {
    id: number;
    title: string;
    source: string;
    problem_count: number;
    creator_student_id: string;
    creator_name?: string;
    created_at: string;
}

interface SessionInfo {
    id: number;
    problem_set_id: number;
    problem_set_title: string;
    score: number;
    total: number;
    completed: boolean;
    started_at: string;
    completed_at?: string;
}

export default function ProblemSetList() {
    const { id: noteId } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [note, setNote] = useState<{ title: string } | null>(null);
    const [sets, setSets] = useState<ProblemSetInfo[]>([]);
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!noteId) return;
        Promise.all([
            api.get(`/notes/${noteId}`),
            api.get(`/problem-sets/note/${noteId}`),
            api.get('/problem-sets/my-sessions'),
        ]).then(([noteRes, setsRes, sessionsRes]) => {
            setNote(noteRes.data);
            setSets(setsRes.data);
            // Filter sessions belonging to this note's problem sets
            const noteSetIds = new Set(setsRes.data.map((s: ProblemSetInfo) => s.id));
            setSessions(sessionsRes.data.filter((s: SessionInfo) => noteSetIds.has(s.problem_set_id)));
        }).catch(console.error).finally(() => setLoading(false));
    }, [noteId]);

    if (loading) return <div className="page container"><div className="loader-wrapper"><div className="spinner" /></div></div>;

    return (
        <div className="page container">
            <div className="ps-list-page">
                <Link to={`/note/${noteId}`} className="btn btn-secondary btn-sm" style={{ marginBottom: 'var(--space-4)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <ArrowLeft size={16} /> Back to Note
                </Link>
                <h1><BookOpen size={28} style={{ marginRight: '0.5rem', color: 'var(--accent-primary)', verticalAlign: 'middle' }} /> Problem Sets</h1>
                <p className="ps-list-subtitle">for "{note?.title}"</p>

                <Link to={`/note/${noteId}/generate-problems`} className="btn btn-primary" style={{ marginBottom: 'var(--space-5)', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Sparkles size={16} /> Generate New Problem Set
                </Link>

                <div className="ps-list-section-title">All Problem Sets ({sets.length})</div>
                {sets.length === 0 ? (
                    <div className="ps-empty">No problem sets yet. Generate one above!</div>
                ) : (
                    sets.map(ps => (
                        <div key={ps.id} className="ps-list-card">
                            <div className="ps-list-card-info">
                                <span className="ps-list-card-title">{ps.title}</span>
                                <div className="ps-list-card-meta">
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Hash size={14} /> {ps.problem_count} questions</span>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>{ps.source === 'ai_summary' ? <Sparkles size={14} /> : <Globe size={14} />} {ps.source === 'ai_summary' ? 'From AI Summary' : 'From Topic'}</span>
                                    <span>by {ps.creator_name || ps.creator_student_id}</span>
                                    <span>{new Date(ps.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={() => navigate(`/problem-set/${ps.id}/take`)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            >
                                <Play size={14} className="fill-current" /> Take Quiz
                            </button>
                        </div>
                    ))
                )}

                <div className="ps-list-section-title">My Past Sessions ({sessions.length})</div>
                {sessions.length === 0 ? (
                    <div className="ps-empty">You haven't taken any quizzes for this note yet.</div>
                ) : (
                    sessions.map(s => (
                        <div key={s.id} className="ps-session-card">
                            <div>
                                <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{s.problem_set_title}</div>
                                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                    {s.completed
                                        ? `Completed · ${new Date(s.completed_at!).toLocaleDateString()}`
                                        : `In progress · ${new Date(s.started_at).toLocaleDateString()}`}
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                                {s.completed && (
                                    <span className="ps-session-score">{s.score}/{s.total}</span>
                                )}
                                {s.completed && (
                                    <Link
                                        to={`/problem-set/${s.problem_set_id}/session/${s.id}/history`}
                                        className="btn btn-secondary btn-sm"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                                    >
                                        <History size={14} /> History
                                    </Link>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
