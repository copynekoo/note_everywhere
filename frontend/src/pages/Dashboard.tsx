import { useState, useEffect } from 'react';
import api from '../api';
import NoteCard from '../components/NoteCard';
import './Dashboard.css';

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

interface DashboardData {
    recommended: Note[];
    popular: Note[];
    recent: Note[];
}

export default function Dashboard() {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/notes/dashboard')
            .then((r) => setData(r.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="page container">
                <div className="loader-wrapper"><div className="spinner" /></div>
            </div>
        );
    }

    const renderSection = (title: string, emoji: string, notes: Note[]) => (
        <section className="dashboard-section animate-fade-in" key={title}>
            <div className="section-header">
                <h2 className="section-title">{emoji} {title}</h2>
            </div>
            {notes.length === 0 ? (
                <div className="empty-state">
                    <p>No notes found in this category yet.</p>
                </div>
            ) : (
                <div className="scroll-row stagger">
                    {notes.map((n) => <NoteCard key={n.id} note={n} />)}
                </div>
            )}
        </section>
    );

    return (
        <div className="page container" id="dashboard-page">
            <div className="dashboard-hero">
                <h1 className="dashboard-title animate-fade-in">Welcome back 👋</h1>
                <p className="dashboard-subtitle animate-fade-in">Discover notes shared by your peers</p>
            </div>
            {data && (
                <>
                    {renderSection('Recommended for You', '⭐', data.recommended)}
                    {renderSection('Trending & Popular', '🔥', data.popular)}
                    {renderSection('Recently Added', '🕐', data.recent)}
                </>
            )}
        </div>
    );
}
