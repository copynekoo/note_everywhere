import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle, FileText, AlertTriangle } from 'lucide-react';
import api from '../api';
import './ProblemSet.css';

interface Choice { label: string; text: string; }
interface Problem {
    id: number;
    type: 'objective' | 'subjective';
    difficulty: 'easy' | 'normal' | 'hard';
    question: string;
    position: number;
    choices?: Choice[];
    correct_answer?: string;
    explanation?: string;
}
interface ProblemSet {
    id: number;
    title: string;
    note_id: number;
    problems: Problem[];
}

export default function ProblemSetAnswers() {
    const { id } = useParams<{ id: string }>();
    const [problemSet, setProblemSet] = useState<ProblemSet | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchSet = async () => {
            try {
                const res = await api.get(`/problem-sets/${id}`);
                setProblemSet(res.data);
            } catch (err: any) {
                setError(err.response?.data?.error || 'Failed to load answers');
            } finally {
                setLoading(false);
            }
        };
        fetchSet();
    }, [id]);

    if (loading) return <div className="page container"><div className="loader-wrapper"><div className="spinner" /></div></div>;
    if (error && !problemSet) return <div className="page container"><div className="empty-state"><p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center' }}><AlertTriangle size={18} /> {error}</p></div></div>;
    if (!problemSet) return null;

    return (
        <div className="page container">
            <div className="problem-set-page">
                <Link to="/bookmarks" className="btn btn-secondary btn-sm" style={{ marginBottom: 'var(--space-4)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <ArrowLeft size={16} /> Back to Bookmarks
                </Link>
                <h1 style={{ marginBottom: 'var(--space-2)' }}>{problemSet.title} - Answer Sheet</h1>
                <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>Contains all questions, acceptable choices, and explanations.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    {problemSet.problems.map((problem, i) => (
                        <div key={problem.id} className="ps-question-card" style={{ marginBottom: 0 }}>
                            <div className="ps-question-meta" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                                    <span className={`ps-type-badge ps-type-badge--${problem.type}`}>
                                        {problem.type === 'objective' ? ' Multiple Choice' : ' Short Answer'}
                                    </span>
                                    <span className={`ps-difficulty-badge ps-difficulty-badge--${problem.difficulty}`}>
                                        {problem.difficulty.charAt(0).toUpperCase() + problem.difficulty.slice(1)}
                                    </span>
                                </div>
                            </div>

                            <p className="ps-question-text" style={{ marginTop: '0.5rem' }}>
                                Q{i + 1}. {problem.question}
                            </p>

                            {problem.type === 'objective' && problem.choices && (
                                <div className="ps-choices">
                                    {problem.choices.map(c => (
                                        <label key={c.label} className={`ps-choice ps-choice--disabled ${c.label === problem.correct_answer ? 'ps-choice--correct' : ''}`}>
                                            <input type="radio" disabled checked={c.label === problem.correct_answer} />
                                            <span className="ps-choice-label">{c.label}.</span>
                                            <span className="ps-choice-text">{c.text}</span>
                                        </label>
                                    ))}
                                </div>
                            )}

                            <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                                {problem.type === 'objective' ? (
                                    <>
                                        <strong style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 'var(--space-2)' }}><CheckCircle size={16} /> Correct Answer: {problem.correct_answer}</strong>
                                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}><strong>Explanation:</strong> {problem.explanation || 'No explanation provided.'}</span>
                                    </>
                                ) : (
                                    <>
                                        <strong style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 'var(--space-2)' }}><FileText size={16} /> Subjective Answer</strong>
                                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>Answers to subjective questions are evaluated dynamically based on individual responses by the AI. Pre-determined model answers are unavailable.</span>
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
