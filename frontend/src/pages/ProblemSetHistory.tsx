import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { ArrowLeft, History } from 'lucide-react';
import './ProblemSetHistory.css';

interface Choice { label: string; text: string; }

interface AttemptItem {
    id: number;
    problem_id: number;
    session_id: number;
    question: string;
    type: 'objective' | 'subjective';
    difficulty: 'easy' | 'normal' | 'hard';
    correct_answer?: string;
    explanation?: string;
    position: number;
    user_answer: string;
    ai_feedback?: string;
    is_correct: boolean | null;
    choices?: Choice[];
}

interface SessionInfo {
    id: number;
    problem_set_id: number;
    problem_set_title: string;
    note_id: number;
    score: number;
    total: number;
    completed: boolean;
    completed_at?: string;
}

export default function ProblemSetHistory() {
    const { sessionId } = useParams<{ id: string; sessionId: string }>();
    const [session, setSession] = useState<SessionInfo | null>(null);
    const [attempts, setAttempts] = useState<AttemptItem[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!sessionId) return;
        api.get(`/problem-sets/sessions/${sessionId}/history`)
            .then(res => {
                setSession(res.data.session);
                setAttempts(res.data.attempts);
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [sessionId]);

    if (loading) return <div className="page container"><div className="loader-wrapper"><div className="spinner" /></div></div>;
    if (!session) return <div className="page container"><div className="empty-state"><p>Session not found.</p></div></div>;

    const pct = session.total > 0 ? Math.round((session.score / session.total) * 100) : 0;

    return (
        <div className="page container">
            <div className="ps-history-page">
                <Link
                    to={`/note/${session.note_id}/problem-sets`}
                    className="btn btn-secondary btn-sm"
                    style={{ marginBottom: 'var(--space-4)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                >
                    <ArrowLeft size={16} /> Problem Sets
                </Link>

                <h1><History size={28} style={{ marginRight: '0.5rem', color: 'var(--accent-primary)', verticalAlign: 'middle' }} /> Answer History</h1>
                <p className="ps-history-subtitle">{session.problem_set_title}</p>

                <div className="ps-history-score-banner">
                    <span className="ps-history-score-value">{session.score}/{session.total}</span>
                    <span className="ps-history-score-label">
                        {pct}% correct · Completed {session.completed_at ? new Date(session.completed_at).toLocaleDateString() : ''}
                    </span>
                </div>

                {attempts.map((a, i) => {
                    const feedbackClass = a.type === 'subjective'
                        ? 'ps-history-feedback--subjective'
                        : a.is_correct ? 'ps-history-feedback--correct' : 'ps-history-feedback--wrong';

                    return (
                        <div key={a.id} className="ps-history-item">
                            <div className="ps-history-item-header">
                                <span className="ps-history-question-number">Q{i + 1}.</span>
                                <span className="ps-history-question-text">{a.question}</span>
                            </div>

                            <div className="ps-history-badges">
                                <span className={`ps-type-badge ps-type-badge--${a.type}`} style={{
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 700,
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '999px',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em',
                                    background: a.type === 'objective' ? 'rgba(99,102,241,0.15)' : 'rgba(16,185,129,0.15)',
                                    color: a.type === 'objective' ? 'var(--primary)' : '#10b981',
                                }}>
                                    {a.type === 'objective' ? ' MCQ' : ' Subjective'}
                                </span>
                                <span style={{
                                    fontSize: 'var(--font-size-xs)',
                                    fontWeight: 600,
                                    padding: '0.2rem 0.6rem',
                                    borderRadius: '999px',
                                    background: a.difficulty === 'easy' ? 'rgba(34,197,94,0.15)' : a.difficulty === 'hard' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                                    color: a.difficulty === 'easy' ? '#22c55e' : a.difficulty === 'hard' ? '#ef4444' : '#f59e0b',
                                }}>
                                    {a.difficulty.charAt(0).toUpperCase() + a.difficulty.slice(1)}
                                </span>
                                {a.type === 'objective' && (
                                    <span style={{
                                        fontSize: 'var(--font-size-xs)',
                                        fontWeight: 700,
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '999px',
                                        background: a.is_correct ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                                        color: a.is_correct ? '#22c55e' : '#ef4444',
                                    }}>
                                        {a.is_correct ? ' Correct' : ' Incorrect'}
                                    </span>
                                )}
                            </div>

                            {/* For objective, show choices with highlights */}
                            {a.type === 'objective' && a.choices && (
                                <div className="ps-history-choices">
                                    {a.choices.map(c => {
                                        const isCorrect = c.label === a.correct_answer;
                                        const isUserWrong = c.label === a.user_answer && !a.is_correct;
                                        return (
                                            <div
                                                key={c.label}
                                                className={`ps-history-choice-row ${isCorrect ? 'ps-history-choice-row--correct' : isUserWrong ? 'ps-history-choice-row--wrong' : ''}`}
                                            >
                                                <span className="ps-history-choice-label">{c.label}.</span>
                                                <span>{c.text}</span>
                                                {isCorrect && <span></span>}
                                                {isUserWrong && <span>← your answer</span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Subjective: side-by-side user answer vs model answer */}
                            {a.type === 'subjective' && (
                                <div className="ps-history-answer-row">
                                    <div className="ps-history-answer-box ps-history-answer-box--user">
                                        <label>Your Answer</label>
                                        <p>{a.user_answer || '(no answer)'}</p>
                                    </div>
                                    {a.correct_answer && (
                                        <div className="ps-history-answer-box ps-history-answer-box--correct">
                                            <label>Model Answer</label>
                                            <p>{a.correct_answer}</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Feedback */}
                            {a.ai_feedback && (
                                <div className={`ps-history-feedback ${feedbackClass}`}>
                                    <strong>
                                        {a.type === 'objective'
                                            ? (a.is_correct ? ' Explanation' : ' Explanation')
                                            : ' AI Feedback'}
                                    </strong>
                                    {a.ai_feedback}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
