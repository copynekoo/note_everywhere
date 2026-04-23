import { useState, useEffect } from 'react';
import api from '../api';
import NoteCard from '../components/NoteCard';
import { Star, TrendingUp, Clock, Hand } from 'lucide-react';
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

    const renderSection = (title: string, icon: React.ReactNode, notes: Note[]) => (
        <section className="dashboard-section animate-fade-in" key={title}>
            <div className="section-header">
                <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {icon} {title}
                </h2>
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
                <h1 className="dashboard-title animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    Welcome back <Hand size={32} color="#0071e3" strokeWidth={1.5} />
                </h1>
                <p className="dashboard-subtitle animate-fade-in">Discover notes shared by your peers</p>
            </div>
            {data && (
                <>
                    {renderSection('Recommended for You', <Star size={24} color="#f5a623" />, data.recommended)}
                    {renderSection('Trending & Popular', <TrendingUp size={24} color="#0071e3" />, data.popular)}
                    {renderSection('Recently Added', <Clock size={24} color="#8e8e93" />, data.recent)}
                </>
            )}
        </div>
    );
}
