import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, NotebookText, HelpCircle, FileQuestion, Trash2, Cpu, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api';
import './Bookmarks.css';

interface Choice { label: string; text: string; }

interface BookmarkItem {
    id: number;
    item_type: 'note' | 'problem_set' | 'problem';
    item_id: number;
    title: string;
    created_at: string;
    problem_set_id?: number;
    question?: string;
    problem_type?: 'objective' | 'subjective';
    choices?: Choice[];
    correct_answer?: string;
    explanation?: string;
}

function InlineProblem({ b }: { b: BookmarkItem }) {
    const [expanded, setExpanded] = useState(false);
    const [selectedChoice, setSelectedChoice] = useState('');
    const [subjectiveAnswer, setSubjectiveAnswer] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{ isCorrect: boolean | null; aiFeedback: string | null; correctAnswer: string | null } | null>(null);
    const [showCorrect, setShowCorrect] = useState(false);

    const handleSubmit = async () => {
        const answer = b.problem_type === 'objective' ? selectedChoice : subjectiveAnswer;
        if (!answer.trim()) return;
        setSubmitting(true);
        try {
            const res = await api.post(`/problem-sets/problems/${b.item_id}/evaluate`, { answer });
            setFeedback(res.data);
            setShowCorrect(true);
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    if (!b.question) return <div style={{ marginTop: 'var(--space-2)' }}>Problem data not found.</div>;

    return (
        <div style={{ marginTop: 'var(--space-3)' }}>
            <p className="ps-question-text" style={{ fontSize: '1rem', fontWeight: '500', marginBottom: 'var(--space-2)' }}>{b.question}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: expanded ? 'var(--space-3)' : 0 }}>
                <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setExpanded(!expanded)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                >
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    {expanded ? 'Hide Problem' : 'Show Problem'}
                </button>
                <Link
                    to={`/problem-set/${b.problem_set_id || ''}/take?problemId=${b.item_id}`}
                    style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent-primary)', textDecoration: 'none' }}
                >
                    View original problem set →
                </Link>
            </div>

            {expanded && (
                <div style={{ padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
                    {b.problem_type === 'objective' && b.choices && (
                        <div className="ps-choices" style={{ marginTop: 0 }}>
                            {b.choices.map(c => {
                                let extraClass = '';
                                if (feedback || showCorrect) {
                                    if (c.label === b.correct_answer && showCorrect) extraClass = 'ps-choice--correct';
                                    else if (c.label === selectedChoice && feedback && !feedback.isCorrect) extraClass = 'ps-choice--wrong';
                                } else if (c.label === selectedChoice) {
                                    extraClass = 'ps-choice--selected';
                                }

                                return (
                                    <label key={c.label} className={`ps-choice ${extraClass} ${feedback ? 'ps-choice--disabled' : ''}`}>
                                        <input type="radio" checked={selectedChoice === c.label} onChange={() => setSelectedChoice(c.label)} disabled={!!feedback} />
                                        <span className="ps-choice-label">{c.label}.</span>
                                        <span className="ps-choice-text">{c.text}</span>
                                    </label>
                                );
                            })}
                        </div>
                    )}

                    {b.problem_type === 'subjective' && (
                        <textarea
                            className="ps-subjective-area"
                            placeholder="Write your answer here…"
                            value={subjectiveAnswer}
                            onChange={e => setSubjectiveAnswer(e.target.value)}
                            disabled={!!feedback}
                        />
                    )}

                    {/* Submit Button & Show Answer Button */}
                    {!feedback && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'var(--space-3)' }}>
                            {b.problem_type === 'objective' && !showCorrect ? (
                                <button className="btn btn-ghost btn-sm" onClick={() => setShowCorrect(true)}>
                                    View Correct Answer and Explanation
                                </button>
                            ) : b.problem_type === 'objective' && showCorrect ? (
                                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                    <strong>Explanation:</strong> {b.explanation || 'No explanation provided.'}
                                </div>
                            ) : <div />}

                            <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || (!selectedChoice && !subjectiveAnswer.trim())} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                {submitting ? <Cpu size={16} className="animate-spin" /> : ''} Submit Answer
                            </button>
                        </div>
                    )}

                    {/* Feedback */}
                    {feedback && (
                        <div className={`ps-feedback ${feedback.isCorrect ? 'ps-feedback--correct' : 'ps-feedback--wrong'}`} style={{ marginTop: 'var(--space-3)' }}>
                            <span className="ps-feedback-title" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                {feedback.isCorrect ? <CheckCircle size={18} /> : <XCircle size={18} />}
                                {feedback.isCorrect ? 'Correct!' : (b.problem_type === 'objective' ? `Incorrect — Correct answer: ${b.correct_answer}` : 'Needs Improvement')}
                            </span>
                            {feedback.aiFeedback && <span>{feedback.aiFeedback}</span>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function Bookmarks() {
    const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'note' | 'problem_set' | 'problem'>('note');

    useEffect(() => {
        fetchBookmarks();
    }, []);

    const fetchBookmarks = async () => {
        try {
            const res = await api.get('/bookmarks');
            setBookmarks(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const deleteBookmark = async (type: string, id: number) => {
        try {
            await api.delete(`/bookmarks/${type}/${id}`);
            setBookmarks(bookmarks.filter(b => !(b.item_type === type && b.item_id === id)));
        } catch (err) {
            console.error('Failed to delete bookmark');
        }
    };

    const filtered = bookmarks.filter(b => b.item_type === activeTab);

    if (loading) return <div className="page container"><div className="loader-wrapper"><div className="spinner" /></div></div>;

    return (
        <div className="page container">
            <h1 style={{ marginBottom: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Bookmark size={28} color="var(--accent-primary)" /> My Bookmarks
            </h1>

            <div className="bookmarks-tabs">
                <button
                    className={`btn ${activeTab === 'note' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('note')}
                >
                    <NotebookText size={16} /> Notes
                </button>
                <button
                    className={`btn ${activeTab === 'problem_set' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('problem_set')}
                >
                    <FileQuestion size={16} /> Problem Sets
                </button>
                <button
                    className={`btn ${activeTab === 'problem' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setActiveTab('problem')}
                >
                    <HelpCircle size={16} /> Specific Problems
                </button>
            </div>

            <div className="bookmarks-list">
                {filtered.length === 0 ? (
                    <div className="empty-state">
                        <Bookmark size={48} color="var(--border-strong)" />
                        <p>No bookmarks found for this category.</p>
                    </div>
                ) : (
                    filtered.map(b => (
                        <div key={b.id} className="bookmark-card">
                            <div className="bookmark-info" style={{ width: '100%', flex: 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h3 className="bookmark-title">{b.title}</h3>
                                        <span className="bookmark-date">Bookmarked on {new Date(b.created_at).toLocaleDateString()}</span>
                                    </div>
                                    <div className="bookmark-actions" style={{ marginTop: 0 }}>
                                        {b.item_type === 'note' && (
                                            <Link to={`/note/${b.item_id}`} className="btn btn-secondary btn-sm">View Note</Link>
                                        )}
                                        {b.item_type === 'problem_set' && (
                                            <>
                                                <Link to={`/problem-set/${b.item_id}/take`} className="btn btn-secondary btn-sm">Take Set</Link>
                                                <Link to={`/problem-set/${b.item_id}/answers`} className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-secondary)' }}>View Answers</Link>
                                            </>
                                        )}
                                        {/* For objective/problem, Review Problem is replaced by InlineProblem component */}
                                        <button className="btn btn-ghost btn-sm text-danger" onClick={() => deleteBookmark(b.item_type, b.item_id)}>
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                {b.item_type === 'problem' && <InlineProblem b={b} />}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
