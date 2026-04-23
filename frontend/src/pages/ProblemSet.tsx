import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import {
    AlertTriangle, Trophy, ThumbsUp, Book, History, BookOpen,
    ArrowLeft, PlayCircle, CheckCircle, XCircle, Sparkles, Cpu, Flag
} from 'lucide-react';
import './ProblemSet.css';

interface Choice { label: string; text: string; }
interface Problem {
    id: number;
    type: 'objective' | 'subjective';
    difficulty: 'easy' | 'normal' | 'hard';
    question: string;
    position: number;
    choices?: Choice[];
}

interface ProblemSet {
    id: number;
    title: string;
    note_id: number;
    problems: Problem[];
}

export default function ProblemSet() {
    const { id } = useParams<{ id: string }>();

    const [problemSet, setProblemSet] = useState<ProblemSet | null>(null);
    const [sessionId, setSessionId] = useState<number | null>(null);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resumed, setResumed] = useState(false);

    // Per-question state
    const [selectedChoice, setSelectedChoice] = useState<string>('');
    const [subjectiveAnswer, setSubjectiveAnswer] = useState('');
    const [feedback, setFeedback] = useState<{ isCorrect: boolean | null; aiFeedback: string | null; correctAnswer: string | null } | null>(null);

    // Completion
    const [completed, setCompleted] = useState(false);
    const [finalSession, setFinalSession] = useState<{ score: number; total: number; id: number } | null>(null);

    // Initialize problem set and session (resume-aware)
    const init = useCallback(async () => {
        if (!id) return;
        try {
            // Fetch problem set
            const psRes = await api.get(`/problem-sets/${id}`);
            setProblemSet(psRes.data);

            // Start or resume session
            const sessionRes = await api.post(`/problem-sets/${id}/sessions`);
            const session = sessionRes.data;
            setSessionId(session.id);
            setResumed(!!session.resumed);

            if (session.resumed) {
                // Load already-answered problem IDs and jump to saved index
                const stateRes = await api.get(`/problem-sets/sessions/${session.id}`);
                const answeredIds: number[] = stateRes.data.answeredProblemIds;
                const savedIdx = session.current_question_idx ?? 0;

                // Validate savedIdx against answered count; use the higher
                const lastAnsweredIdx = answeredIds.length > 0 ? answeredIds.length : 0;
                setCurrentIdx(Math.max(savedIdx, lastAnsweredIdx));
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to load problem set');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { init(); }, [init]);

    const resetQuestionState = () => {
        setSelectedChoice('');
        setSubjectiveAnswer('');
        setFeedback(null);
    };

    const saveProgress = async (nextIdx: number, sid: number) => {
        try {
            await api.patch(`/problem-sets/sessions/${sid}/progress`, { currentQuestionIdx: nextIdx });
        } catch (_) { /* best-effort */ }
    };

    const handleSubmitAnswer = async () => {
        if (!problemSet || sessionId === null) return;
        const problem = problemSet.problems[currentIdx];
        const answer = problem.type === 'objective' ? selectedChoice : subjectiveAnswer;

        if (!answer.trim()) { setError('Please provide an answer.'); return; }
        setError(null);
        setSubmitting(true);

        try {
            const res = await api.post(`/problem-sets/sessions/${sessionId}/answer`, {
                problemId: problem.id,
                answer,
            });
            setFeedback(res.data);
            // Save progress: current idx is now answered, next idx = currentIdx + 1
            await saveProgress(currentIdx + 1, sessionId);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to submit answer');
        } finally {
            setSubmitting(false);
        }
    };

    const handleNext = async () => {
        if (!problemSet || sessionId === null) return;
        const isLast = currentIdx >= problemSet.problems.length - 1;

        if (isLast) {
            try {
                const res = await api.post(`/problem-sets/sessions/${sessionId}/complete`);
                setFinalSession({ score: res.data.score, total: res.data.total, id: res.data.id });
                setCompleted(true);
            } catch (err: any) {
                setError(err.response?.data?.error || 'Failed to complete session');
            }
        } else {
            setCurrentIdx(prev => prev + 1);
            resetQuestionState();
        }
    };

    if (loading) return <div className="page container"><div className="loader-wrapper"><div className="spinner" /></div></div>;
    if (error && !problemSet) return <div className="page container"><div className="empty-state"><p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}><AlertTriangle size={18} /> {error}</p></div></div>;
    if (!problemSet) return null;

    // Score screen
    if (completed && finalSession) {
        const pct = finalSession.total > 0 ? Math.round((finalSession.score / finalSession.total) * 100) : 0;
        const emoji = pct >= 80 ? <Trophy size={48} color="#f5a623" /> : pct >= 60 ? <ThumbsUp size={48} color="#0071e3" /> : <Book size={48} color="#8e8e93" />;
        return (
            <div className="page container">
                <div className="problem-set-page">
                    <div className="ps-score-card">
                        <div style={{ fontSize: '3rem', marginBottom: 'var(--space-3)' }}>{emoji}</div>
                        <div className="ps-score-number">{finalSession.score}/{finalSession.total}</div>
                        <p className="ps-score-label">
                            {pct}% correct — {pct >= 80 ? 'Excellent work!' : pct >= 60 ? 'Good effort!' : 'Keep studying!'}
                        </p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-6)' }}>
                            (Subjective questions are graded automatically by AI)
                        </p>
                        <div className="ps-score-actions">
                            <Link
                                to={`/problem-set/${id}/session/${finalSession.id}/history`}
                                className="btn btn-primary"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                <History size={16} /> View Answer History
                            </Link>
                            <Link to={`/note/${problemSet.note_id}/problem-sets`} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                <BookOpen size={16} /> Browse Problem Sets
                            </Link>
                            <Link to={`/note/${problemSet.note_id}`} className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                                <ArrowLeft size={16} /> Back to Note
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const problem = problemSet.problems[currentIdx];
    const total = problemSet.problems.length;
    const progress = ((currentIdx) / total) * 100;
    const answered = feedback !== null;

    return (
        <div className="page container">
            <div className="problem-set-page">
                <Link to={`/note/${problemSet.note_id}/problem-sets`} className="btn btn-secondary btn-sm" style={{ marginBottom: 'var(--space-4)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <ArrowLeft size={16} /> Problem Sets
                </Link>
                <h2 style={{ marginBottom: 'var(--space-2)', fontSize: 'var(--font-size-xl)' }}>{problemSet.title}</h2>

                {/* Resumed banner */}
                {resumed && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)',
                        borderRadius: 'var(--radius-md)', padding: 'var(--space-2) var(--space-4)',
                        marginBottom: 'var(--space-4)', fontSize: 'var(--font-size-sm)', color: 'var(--text-accent)'
                    }}>
                        <PlayCircle size={16} /> Resumed from where you left off (Question {currentIdx + 1})
                    </div>
                )}

                {/* Progress */}
                <div className="ps-progress-bar-wrapper">
                    <div className="ps-progress-meta">
                        <span>Question {currentIdx + 1} of {total}</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="ps-progress-bar">
                        <div className="ps-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                </div>

                {/* Question */}
                <div className="ps-question-card">
                    <div className="ps-question-meta">
                        <span className={`ps-type-badge ps-type-badge--${problem.type}`}>
                            {problem.type === 'objective' ? ' Multiple Choice' : ' Short Answer'}
                        </span>
                        <span className={`ps-difficulty-badge ps-difficulty-badge--${problem.difficulty}`}>
                            {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
                        </span>
                    </div>

                    <p className="ps-question-text">
                        Q{currentIdx + 1}. {problem.question}
                    </p>

                    {/* Objective: radio choices */}
                    {problem.type === 'objective' && problem.choices && (
                        <div className="ps-choices">
                            {problem.choices.map(c => {
                                let extraClass = '';
                                if (answered) {
                                    if (c.label === feedback?.correctAnswer) extraClass = 'ps-choice--correct';
                                    else if (c.label === selectedChoice && !feedback?.isCorrect) extraClass = 'ps-choice--wrong';
                                } else if (c.label === selectedChoice) {
                                    extraClass = 'ps-choice--selected';
                                }

                                return (
                                    <label
                                        key={c.label}
                                        className={`ps-choice ${extraClass} ${answered ? 'ps-choice--disabled' : ''}`}
                                    >
                                        <input
                                            type="radio"
                                            name="choice"
                                            value={c.label}
                                            checked={selectedChoice === c.label}
                                            disabled={answered}
                                            onChange={() => setSelectedChoice(c.label)}
                                        />
                                        <span className="ps-choice-label">{c.label}.</span>
                                        <span className="ps-choice-text">{c.text}</span>
                                    </label>
                                );
                            })}
                        </div>
                    )}

                    {/* Subjective: textarea */}
                    {problem.type === 'subjective' && (
                        <textarea
                            className="ps-subjective-area"
                            placeholder="Write your answer here…"
                            value={subjectiveAnswer}
                            onChange={e => setSubjectiveAnswer(e.target.value)}
                            disabled={answered}
                        />
                    )}

                    {/* Feedback */}
                    {answered && feedback && (
                        <div className={`ps-feedback ${feedback.isCorrect ? 'ps-feedback--correct' : 'ps-feedback--wrong'}`}>
                            {problem.type === 'objective' ? (
                                <>
                                    <span className="ps-feedback-title" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        {feedback.isCorrect ? <CheckCircle size={18} /> : <XCircle size={18} />}
                                        {feedback.isCorrect ? 'Correct!' : `Incorrect — Correct answer: ${feedback.correctAnswer}`}
                                    </span>
                                    {feedback.aiFeedback && <span>{feedback.aiFeedback}</span>}
                                </>
                            ) : (
                                <>
                                    <span className="ps-feedback-title" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        {feedback.isCorrect ? <CheckCircle size={18} /> : <XCircle size={18} />}
                                        <Sparkles size={16} />
                                        {feedback.isCorrect ? 'AI Evaluation: Pass' : 'AI Evaluation: Needs Improvement'}
                                    </span>
                                    <span>{feedback.aiFeedback}</span>
                                </>
                            )}
                        </div>
                    )}

                    {error && <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#ef4444', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-3)' }}><AlertTriangle size={14} /> {error}</div>}

                    <div className="ps-nav-actions">
                        {!answered ? (
                            <button
                                className="btn btn-primary"
                                onClick={handleSubmitAnswer}
                                disabled={submitting || (problem.type === 'objective' ? !selectedChoice : !subjectiveAnswer.trim())}
                                id="submit-answer-btn"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                {submitting ? <Cpu size={16} className="animate-spin" /> : ''}
                                {submitting ? (problem.type === 'subjective' ? 'Evaluating…' : 'Submitting…') : 'Submit Answer'}
                            </button>
                        ) : (
                            <button
                                className="btn btn-primary"
                                onClick={handleNext}
                                id="next-question-btn"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
                            >
                                {currentIdx >= total - 1 ? <Flag size={16} /> : ''}
                                {currentIdx >= total - 1 ? 'Finish & See Score' : 'Next Question →'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
