import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
    AlertTriangle, Eye, Users, ThumbsUp, ThumbsDown,
    MessageSquare, LayoutList, TrendingUp, Brain, Inbox, Award
} from 'lucide-react';

import './NoteAnalytics.css';

// ─── types ───────────────────────────────────────────────────────────────────
interface ProblemStat {
    id: number;
    question: string;
    type: 'objective' | 'subjective';
    difficulty: 'easy' | 'normal' | 'hard';
    position: number;
    totalFirstTryAttempts: number;
    correctFirstTryAttempts: number;
    firstTryPassRate: number | null;
}

interface ProblemSetAnalytics {
    id: number;
    title: string;
    created_at: string;
    total_sessions: number;
    completed_sessions: number;
    avg_score: number;
    problems: ProblemStat[];
}

interface NoteInfo {
    id: number;
    title: string;
    user_id: number;
    rating_score: number;
    likes: number;
    dislikes: number;
    comment_count: number;
    totalViews: number;
    uniqueViewers: number;
}

interface ViewsByDay { date: string; views: number; }

interface AnalyticsData {
    note: NoteInfo;
    viewsByDay: ViewsByDay[];
    problemSets: ProblemSetAnalytics[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────
const DIFF_COLOUR: Record<string, string> = {
    easy: '#34d399',
    normal: '#fbbf24',
    hard: '#f87171',
};

function passRateColour(rate: number | null): string {
    if (rate === null) return '#64748b';
    if (rate >= 70) return '#34d399';
    if (rate >= 40) return '#fbbf24';
    return '#f87171';
}

// Custom tooltip for the pass-rate bar chart
const PassRateTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as ProblemStat;
    return (
        <div className="an-tooltip">
            <p className="an-tooltip-q">Q{d.position}. {d.question.slice(0, 80)}{d.question.length > 80 ? '…' : ''}</p>
            <p>Type: <strong>{d.type}</strong> · Difficulty: <span style={{ color: DIFF_COLOUR[d.difficulty] }}>{d.difficulty}</span></p>
            <p>First-try attempts: <strong>{d.totalFirstTryAttempts}</strong></p>
            {d.firstTryPassRate !== null
                ? <p>Pass rate: <strong style={{ color: passRateColour(d.firstTryPassRate) }}>{d.firstTryPassRate}%</strong></p>
                : <p style={{ color: '#64748b' }}>No data yet</p>
            }
        </div>
    );
};

// ─── component ───────────────────────────────────────────────────────────────
export default function NoteAnalytics() {
    const { id: noteId } = useParams<{ id: string }>();
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedPS, setExpandedPS] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (!noteId) return;
        api.get(`/notes/${noteId}/analytics`)
            .then(r => { setData(r.data); setExpandedPS(new Set([r.data.problemSets[0]?.id])); })
            .catch(e => setError(e.response?.data?.error || 'Failed to load analytics'))
            .finally(() => setLoading(false));
    }, [noteId]);

    const togglePS = (id: number) => {
        setExpandedPS(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    if (loading) return <div className="page container"><div className="loader-wrapper"><div className="spinner" /></div></div>;
    if (error) return <div className="page container"><div className="empty-state"><p style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}><AlertTriangle size={18} /> {error}</p></div></div>;
    if (!data) return null;

    const { note, viewsByDay, problemSets } = data;

    // Fill gaps in viewsByDay: last 30 days
    const filledViews = (() => {
        const map: Record<string, number> = {};
        viewsByDay.forEach(v => { map[v.date] = parseInt(v.views as any); });
        const result = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const key = d.toISOString().slice(0, 10);
            result.push({ date: key.slice(5), views: map[key] || 0 });
        }
        return result;
    })();

    return (
        <div className="page container" id="note-analytics-page">
            {/* Header */}
            <div className="an-header animate-fade-in">
                <div className="an-header-top">
                    <Link to={`/note/${noteId}`} className="btn btn-secondary btn-sm">← Back to Note</Link>
                    <span className="an-note-title"> {note.title}</span>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="an-stat-grid animate-fade-in">
                <div className="an-stat-card">
                    <div className="an-stat-icon"><Eye size={24} color="#6366f1" /></div>
                    <div className="an-stat-value">{note.totalViews.toLocaleString()}</div>
                    <div className="an-stat-label">Total Views</div>
                </div>
                <div className="an-stat-card">
                    <div className="an-stat-icon"><Users size={24} color="#6366f1" /></div>
                    <div className="an-stat-value">{note.uniqueViewers.toLocaleString()}</div>
                    <div className="an-stat-label">Unique Viewers</div>
                </div>
                <div className="an-stat-card">
                    <div className="an-stat-icon"><ThumbsUp size={24} color="var(--accent-success)" /></div>
                    <div className="an-stat-value" style={{ color: 'var(--accent-success)' }}>{note.likes}</div>
                    <div className="an-stat-label">Likes</div>
                </div>
                <div className="an-stat-card">
                    <div className="an-stat-icon"><ThumbsDown size={24} color="var(--accent-danger)" /></div>
                    <div className="an-stat-value" style={{ color: 'var(--accent-danger)' }}>{note.dislikes}</div>
                    <div className="an-stat-label">Dislikes</div>
                </div>
                <div className="an-stat-card">
                    <div className="an-stat-icon"><MessageSquare size={24} color="#6366f1" /></div>
                    <div className="an-stat-value">{note.comment_count}</div>
                    <div className="an-stat-label">Comments</div>
                </div>
                <div className="an-stat-card">
                    <div className="an-stat-icon"><LayoutList size={24} color="#6366f1" /></div>
                    <div className="an-stat-value">{problemSets.length}</div>
                    <div className="an-stat-label">Problem Sets</div>
                </div>
            </div>

            {/* Views Over Time */}
            <div className="an-section-card animate-fade-in">
                <h2 className="an-section-title"><TrendingUp size={20} style={{ marginRight: '0.4rem', verticalAlign: 'middle', color: '#6366f1' }} /> Views Over Time <span className="an-section-sub">(last 30 days)</span></h2>
                <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={filledViews} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis dataKey="date" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} interval={4} />
                        <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: '#111827', border: '1px solid rgba(255,255,255,.1)', borderRadius: 8, color: '#f1f5f9', fontSize: 13 }} />
                        <Line type="monotone" dataKey="views" stroke="#6366f1" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#6366f1' }} />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            {/* Problem Sets */}
            <h2 className="an-section-title an-ps-title animate-fade-in"><Brain size={24} style={{ marginRight: '0.5rem', color: '#6366f1', verticalAlign: 'text-bottom' }} /> Problem Set Analysis</h2>

            {problemSets.length === 0 && (
                <div className="empty-state animate-fade-in">
                    <div className="empty-icon"><Inbox size={40} color="#94a3b8" /></div>
                    <p>No problem sets generated for this note yet.</p>
                </div>
            )}

            {problemSets.map(ps => {
                const isOpen = expandedPS.has(ps.id);
                const objectiveProblems = ps.problems.filter(p => p.type === 'objective' && p.firstTryPassRate !== null);
                const avgPass = objectiveProblems.length > 0
                    ? Math.round(objectiveProblems.reduce((s, p) => s + (p.firstTryPassRate ?? 0), 0) / objectiveProblems.length)
                    : null;

                return (
                    <div key={ps.id} className="an-ps-card animate-fade-in">
                        {/* PS Header */}
                        <div className="an-ps-header" onClick={() => togglePS(ps.id)}>
                            <div className="an-ps-header-left">
                                <span className="an-ps-chevron">{isOpen ? '▾' : '▸'}</span>
                                <div>
                                    <div className="an-ps-name">{ps.title}</div>
                                    <div className="an-ps-meta">
                                        {new Date(ps.created_at).toLocaleDateString()} ·
                                        {' '}{ps.total_sessions} sessions · {ps.completed_sessions} completed
                                        {avgPass !== null && (
                                            <> · Avg first-try: <span style={{ color: passRateColour(avgPass), fontWeight: 600 }}>{avgPass}%</span></>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="an-ps-header-right">
                                <div className="an-ps-stat-pill">
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}><Award size={14} /> Avg Score</span>
                                    <strong>{parseFloat(ps.avg_score as any).toFixed(1)}</strong>
                                </div>
                                <Link
                                    to={`/note/${noteId}/problem-sets`}
                                    className="btn btn-secondary btn-sm"
                                    onClick={e => e.stopPropagation()}
                                >
                                    Take Quiz
                                </Link>
                            </div>
                        </div>

                        {/* PS Body */}
                        {isOpen && (
                            <div className="an-ps-body">
                                {ps.problems.length === 0 ? (
                                    <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>No problems in this set.</p>
                                ) : (
                                    <>
                                        {/* Objective chart */}
                                        {objectiveProblems.length > 0 && (
                                            <>
                                                <p className="an-chart-label">MCQ First-Try Pass Rate by Question</p>
                                                <ResponsiveContainer width="100%" height={Math.max(180, objectiveProblems.length * 38)}>
                                                    <BarChart
                                                        data={objectiveProblems}
                                                        layout="vertical"
                                                        margin={{ top: 0, right: 32, left: 8, bottom: 0 }}
                                                    >
                                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                                        <XAxis type="number" domain={[0, 100]} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
                                                        <YAxis type="category" dataKey="position" tickFormatter={v => `Q${v}`} tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={28} />
                                                        <Tooltip content={<PassRateTooltip />} />
                                                        <Bar dataKey="firstTryPassRate" radius={[0, 4, 4, 0]} maxBarSize={22}>
                                                            {objectiveProblems.map(p => (
                                                                <Cell key={p.id} fill={passRateColour(p.firstTryPassRate)} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </>
                                        )}

                                        {/* Problem table */}
                                        <div className="an-problem-table">
                                            <div className="an-problem-table-head">
                                                <span>#</span>
                                                <span>Question</span>
                                                <span>Type</span>
                                                <span>Diff</span>
                                                <span>Attempts</span>
                                                <span>Pass (1st try)</span>
                                            </div>
                                            {ps.problems.map(prob => (
                                                <div key={prob.id} className="an-problem-row">
                                                    <span className="an-prob-num">Q{prob.position}</span>
                                                    <span className="an-prob-q" title={prob.question}>{prob.question.slice(0, 60)}{prob.question.length > 60 ? '…' : ''}</span>
                                                    <span>
                                                        <span className={`ps-type-badge ps-type-badge--${prob.type}`} style={{ fontSize: '0.7rem', padding: '2px 6px' }}>
                                                            {prob.type === 'objective' ? 'MCQ' : 'Short'}
                                                        </span>
                                                    </span>
                                                    <span style={{ color: DIFF_COLOUR[prob.difficulty], fontWeight: 600, fontSize: '0.78rem' }}>
                                                        {prob.difficulty}
                                                    </span>
                                                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{prob.totalFirstTryAttempts}</span>
                                                    <span>
                                                        {prob.firstTryPassRate !== null
                                                            ? <strong style={{ color: passRateColour(prob.firstTryPassRate) }}>{prob.firstTryPassRate}%</strong>
                                                            : <span style={{ color: 'var(--text-muted)' }}>—</span>
                                                        }
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
