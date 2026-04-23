import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api';
import {
    BrainCircuit, BookOpen, Sparkles, Globe,
    List, FileText, Target, Plus, Trash2, Settings, AlertTriangle, ArrowLeft
} from 'lucide-react';
import './GenerateProblems.css';

interface DifficultyCount { easy: number; normal: number; hard: number; }

interface CustomBlock {
    topic: string;
    count: number;
    difficulty: 'easy' | 'normal' | 'hard';
    type: 'objective' | 'subjective';
}

function newBlock(): CustomBlock {
    return { topic: '', count: 3, difficulty: 'normal', type: 'objective' };
}

export default function GenerateProblems() {
    const { id: noteId } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const [note, setNote] = useState<{ title: string; ai_summary?: string; docling_status?: string } | null>(null);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [source, setSource] = useState<'ai_summary' | 'free'>('free');
    const [mcq, setMcq] = useState<DifficultyCount>({ easy: 5, normal: 5, hard: 5 });
    const [sub, setSub] = useState<DifficultyCount>({ easy: 1, normal: 1, hard: 1 });
    const [customBlocks, setCustomBlocks] = useState<CustomBlock[]>([]);

    useEffect(() => {
        if (!noteId) return;
        api.get(`/notes/${noteId}`).then(res => {
            setNote(res.data);
            if (res.data.ai_summary) setSource('ai_summary');
        }).catch(console.error).finally(() => setLoading(false));
    }, [noteId]);

    const totalMcq = mcq.easy + mcq.normal + mcq.hard;
    const totalSub = sub.easy + sub.normal + sub.hard;
    const totalCustom = customBlocks.reduce((s, b) => s + (b.count || 0), 0);

    const handleGenerate = async () => {
        if (totalMcq + totalSub + totalCustom === 0) { setError('Please set at least 1 question.'); return; }
        // Validate custom blocks
        const invalidBlock = customBlocks.find(b => !b.topic.trim());
        if (invalidBlock) { setError('All custom blocks must have a topic.'); return; }
        setGenerating(true);
        setError(null);
        try {
            const res = await api.post('/problem-sets/generate', {
                noteId: Number(noteId),
                source,
                mcqCounts: mcq,
                subjectiveCounts: sub,
                customBlocks,
            });
            navigate(`/problem-set/${res.data.id}/take`);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to generate');
        } finally {
            setGenerating(false);
        }
    };

    const setMcqField = (field: keyof DifficultyCount, val: number) =>
        setMcq(prev => ({ ...prev, [field]: Math.max(0, val) }));
    const setSubField = (field: keyof DifficultyCount, val: number) =>
        setSub(prev => ({ ...prev, [field]: Math.max(0, val) }));

    const addBlock = () => setCustomBlocks(prev => [...prev, newBlock()]);
    const removeBlock = (i: number) => setCustomBlocks(prev => prev.filter((_, idx) => idx !== i));
    const updateBlock = <K extends keyof CustomBlock>(i: number, key: K, value: CustomBlock[K]) =>
        setCustomBlocks(prev => prev.map((b, idx) => idx === i ? { ...b, [key]: value } : b));

    const hasSummary = !!note?.ai_summary;

    if (loading) return <div className="page container"><div className="loader-wrapper"><div className="spinner" /></div></div>;

    return (
        <div className="page container">
            <div className="generate-problems-page">
                <Link to={`/note/${noteId}`} className="btn btn-secondary btn-sm" style={{ marginBottom: 'var(--space-4)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <ArrowLeft size={16} /> Back to Note
                </Link>
                <h1><BrainCircuit size={28} style={{ marginRight: '0.5rem', color: 'var(--accent-primary)', verticalAlign: 'middle' }} /> Generate Problem Set</h1>
                <p className="page-subtitle">for "{note?.title}"</p>

                {/* Source selection */}
                <div className="gen-card">
                    <h2><BookOpen size={20} style={{ marginRight: '0.5rem', color: 'var(--accent-primary)', verticalAlign: 'text-bottom' }} /> Knowledge Source</h2>
                    <div className="source-options">
                        <label
                            className={`source-option ${source === 'ai_summary' ? 'source-option--selected' : ''} ${!hasSummary ? 'source-option--disabled' : ''}`}
                        >
                            <input
                                type="radio"
                                name="source"
                                value="ai_summary"
                                checked={source === 'ai_summary'}
                                disabled={!hasSummary}
                                onChange={() => setSource('ai_summary')}
                            />
                            <div>
                                <span className="source-option-label"><Sparkles size={16} style={{ marginRight: '0.4rem', verticalAlign: 'text-bottom' }} /> Generate from AI Summary</span>
                                <span className="source-option-hint">
                                    {hasSummary
                                        ? 'Questions will be based exclusively on this note\'s AI-generated summary.'
                                        : 'Disabled — this note has not been AI summarized yet.'}
                                </span>
                            </div>
                        </label>

                        <label className={`source-option ${source === 'free' ? 'source-option--selected' : ''}`}>
                            <input
                                type="radio"
                                name="source"
                                value="free"
                                checked={source === 'free'}
                                onChange={() => setSource('free')}
                            />
                            <div>
                                <span className="source-option-label"><Globe size={16} style={{ marginRight: '0.4rem', verticalAlign: 'text-bottom' }} /> Generate from Related Topic</span>
                                <span className="source-option-hint">
                                    Questions will be generated from general knowledge related to the note's topic.
                                </span>
                            </div>
                        </label>
                    </div>
                </div>

                {/* MCQ settings */}
                <div className="gen-card">
                    <h2><List size={20} style={{ marginRight: '0.5rem', color: 'var(--accent-primary)', verticalAlign: 'text-bottom' }} /> Multiple Choice (Objective) — {totalMcq} questions</h2>
                    <p className="difficulty-section-title">Number of questions per difficulty:</p>
                    <div className="difficulty-grid">
                        {(['easy', 'normal', 'hard'] as const).map(d => (
                            <div className="difficulty-item" key={d}>
                                <label className={d} htmlFor={`mcq-${d}`}>{d.charAt(0).toUpperCase() + d.slice(1)}</label>
                                <input
                                    id={`mcq-${d}`}
                                    type="number"
                                    min={0}
                                    max={30}
                                    value={mcq[d]}
                                    onChange={e => setMcqField(d, parseInt(e.target.value) || 0)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Subjective settings */}
                <div className="gen-card">
                    <h2><FileText size={20} style={{ marginRight: '0.5rem', color: 'var(--accent-primary)', verticalAlign: 'text-bottom' }} /> Short Answer (Subjective) — {totalSub} questions</h2>
                    <p className="difficulty-section-title">Number of questions per difficulty:</p>
                    <div className="difficulty-grid">
                        {(['easy', 'normal', 'hard'] as const).map(d => (
                            <div className="difficulty-item" key={d}>
                                <label className={d} htmlFor={`sub-${d}`}>{d.charAt(0).toUpperCase() + d.slice(1)}</label>
                                <input
                                    id={`sub-${d}`}
                                    type="number"
                                    min={0}
                                    max={20}
                                    value={sub[d]}
                                    onChange={e => setSubField(d, parseInt(e.target.value) || 0)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Custom Blocks */}
                <div className="gen-card gen-card--custom">
                    <div className="gen-custom-header">
                        <div>
                            <h2><Target size={20} style={{ marginRight: '0.5rem', color: 'var(--accent-primary)', verticalAlign: 'text-bottom' }} /> Custom Topic Blocks — {totalCustom} questions</h2>
                            <p className="difficulty-section-title">Add questions on specific topics regardless of the main source.</p>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={addBlock} id="add-custom-block-btn" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Plus size={16} /> Add Block
                        </button>
                    </div>

                    {customBlocks.length === 0 && (
                        <p className="gen-custom-empty">No custom blocks added. Click "Add Block" to specify a custom topic.</p>
                    )}

                    <div className="gen-custom-blocks">
                        {customBlocks.map((block, i) => (
                            <div key={i} className="gen-custom-block">
                                <div className="gen-custom-block-num">Block {i + 1}</div>
                                <div className="gen-custom-block-fields">
                                    {/* Topic */}
                                    <div className="gen-custom-field gen-custom-field--topic">
                                        <label>Topic</label>
                                        <input
                                            type="text"
                                            className="input"
                                            placeholder="e.g. Sorting Algorithms, Osmosis, World War II…"
                                            value={block.topic}
                                            onChange={e => updateBlock(i, 'topic', e.target.value)}
                                        />
                                    </div>
                                    {/* Count */}
                                    <div className="gen-custom-field">
                                        <label>Questions</label>
                                        <input
                                            type="number"
                                            className="input"
                                            min={1}
                                            max={20}
                                            value={block.count}
                                            onChange={e => updateBlock(i, 'count', Math.max(1, parseInt(e.target.value) || 1))}
                                        />
                                    </div>
                                    {/* Difficulty */}
                                    <div className="gen-custom-field">
                                        <label>Difficulty</label>
                                        <select
                                            className="select"
                                            value={block.difficulty}
                                            onChange={e => updateBlock(i, 'difficulty', e.target.value as CustomBlock['difficulty'])}
                                        >
                                            <option value="easy">Easy</option>
                                            <option value="normal">Normal</option>
                                            <option value="hard">Hard</option>
                                        </select>
                                    </div>
                                    {/* Type */}
                                    <div className="gen-custom-field">
                                        <label>Type</label>
                                        <select
                                            className="select"
                                            value={block.type}
                                            onChange={e => updateBlock(i, 'type', e.target.value as CustomBlock['type'])}
                                        >
                                            <option value="objective">Objective (MCQ)</option>
                                            <option value="subjective">Subjective (Short Answer)</option>
                                        </select>
                                    </div>
                                </div>
                                <button
                                    className="btn btn-danger btn-sm gen-custom-remove"
                                    onClick={() => removeBlock(i)}
                                    title="Remove block"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="gen-actions">
                    <button
                        className={`btn btn-primary ${generating ? 'btn-process-doc--loading' : ''}`}
                        onClick={handleGenerate}
                        disabled={generating || (totalMcq + totalSub + totalCustom === 0)}
                        id="generate-problem-set-btn"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        {generating ? <Settings size={18} className="animate-spin" /> : <BrainCircuit size={18} />}
                        {generating ? ' Generating…' : ' Generate Problem Set'}
                    </button>
                    <span className="gen-total-badge">
                        {totalMcq + totalSub + totalCustom} total questions
                        {generating && ' — This may take up to a minute…'}
                    </span>
                </div>

                {error && <div className="gen-error" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><AlertTriangle size={18} /> {error}</div>}
            </div>
        </div>
    );
}
