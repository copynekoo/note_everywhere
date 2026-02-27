import { useState, useEffect, useRef, FormEvent, DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import './UploadNote.css';

interface Subject { id: number; code: string; name: string; year_level: number; }

export default function UploadNote() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [subjectId, setSubjectId] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [externalLink, setExternalLink] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [isPublic, setIsPublic] = useState(true);
    const [dragOver, setDragOver] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (user?.major_id) {
            api.get(`/subjects?majorId=${user.major_id}`).then((r) => setSubjects(r.data)).catch(() => { });
        }
    }, [user]);

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        if (!subjectId || !title.trim()) {
            setError('Subject and title are required');
            return;
        }
        if (!file && !externalLink.trim()) {
            setError('Please upload a file or provide an external link');
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('subjectId', subjectId);
            formData.append('title', title.trim());
            if (description.trim()) formData.append('description', description.trim());
            if (externalLink.trim()) formData.append('externalLink', externalLink.trim());
            formData.append('isPublic', String(isPublic));
            if (file) formData.append('file', file);

            const res = await api.post('/notes', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            navigate(`/note/${res.data.id}`);
        } catch (err: any) {
            setError(err.response?.data?.error || 'Upload failed');
        }
        setSubmitting(false);
    };

    return (
        <div className="page container" id="upload-page">
            <div className="upload-wrapper animate-fade-in">
                <h1 className="upload-title">📤 Upload Note</h1>
                <p className="upload-subtitle">Share your notes with fellow students</p>

                <form className="upload-form glass-card" onSubmit={handleSubmit}>
                    {error && <div className="login-error">{error}</div>}

                    <div className="input-group">
                        <label htmlFor="upload-subject">Subject</label>
                        <select id="upload-subject" className="select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} required>
                            <option value="">Select a subject</option>
                            {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} – {s.name} ({s.year_level})</option>)}
                        </select>
                    </div>

                    <div className="input-group">
                        <label htmlFor="upload-title">Title</label>
                        <input id="upload-title" className="input" type="text" placeholder="e.g. Chapter 5 Summary – Trees & Graphs" value={title} onChange={(e) => setTitle(e.target.value)} required />
                    </div>

                    <div className="input-group">
                        <label htmlFor="upload-desc">Description (optional)</label>
                        <textarea id="upload-desc" className="textarea" placeholder="Brief description of your note..." value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                    </div>

                    {/* File drop zone */}
                    <div className="input-group">
                        <label>File</label>
                        <div
                            className={`drop-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            id="file-drop-zone"
                        >
                            {file ? (
                                <div className="file-preview">
                                    <span className="file-preview-name">📎 {file.name}</span>
                                    <span className="file-preview-size">({(file.size / 1024 / 1024).toFixed(1)} MB)</span>
                                    <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setFile(null); }}>✕</button>
                                </div>
                            ) : (
                                <>
                                    <div className="drop-icon">📁</div>
                                    <p>Drag & drop your file here, or click to browse</p>
                                    <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>PDF, Images, Docs, Audio, Video • Max 50MB</p>
                                </>
                            )}
                            <input
                                ref={fileInputRef}
                                type="file"
                                style={{ display: 'none' }}
                                onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }}
                                id="file-input"
                            />
                        </div>
                    </div>

                    <div className="input-group">
                        <label htmlFor="upload-link">External Link (optional)</label>
                        <input id="upload-link" className="input" type="url" placeholder="https://docs.google.com/..." value={externalLink} onChange={(e) => setExternalLink(e.target.value)} />
                    </div>

                    <div className="upload-visibility">
                        <label className="visibility-toggle">
                            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} id="public-toggle" />
                            <span className="visibility-label">{isPublic ? '🌐 Public' : '🔒 Private'}</span>
                        </label>
                    </div>

                    <button type="submit" className="btn btn-primary btn-lg" disabled={submitting} id="upload-submit">
                        {submitting ? 'Uploading...' : '📤 Upload Note'}
                    </button>
                </form>
            </div>
        </div>
    );
}
