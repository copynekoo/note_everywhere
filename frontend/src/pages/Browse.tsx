import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { Library, Building2, GraduationCap, ChevronDown, ChevronRight } from 'lucide-react';
import './Browse.css';

interface Faculty { id: number; name: string; }
interface Major { id: number; name: string; faculty_id: number; }
interface Subject { id: number; code: string; name: string; year_level: number; major_id: number; }

export default function Browse() {
    const [faculties, setFaculties] = useState<Faculty[]>([]);
    const [expandedFaculty, setExpandedFaculty] = useState<number | null>(null);
    const [majors, setMajors] = useState<Record<number, Major[]>>({});
    const [expandedMajor, setExpandedMajor] = useState<number | null>(null);
    const [subjects, setSubjects] = useState<Record<number, Subject[]>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/faculties').then((r) => setFaculties(r.data)).finally(() => setLoading(false));
    }, []);

    const toggleFaculty = async (fId: number) => {
        if (expandedFaculty === fId) {
            setExpandedFaculty(null);
            return;
        }
        setExpandedFaculty(fId);
        setExpandedMajor(null);
        if (!majors[fId]) {
            const r = await api.get(`/faculties/${fId}/majors`);
            setMajors((prev) => ({ ...prev, [fId]: r.data }));
        }
    };

    const toggleMajor = async (mId: number) => {
        if (expandedMajor === mId) {
            setExpandedMajor(null);
            return;
        }
        setExpandedMajor(mId);
        if (!subjects[mId]) {
            const r = await api.get(`/subjects?majorId=${mId}`);
            setSubjects((prev) => ({ ...prev, [mId]: r.data }));
        }
    };

    if (loading) {
        return <div className="page container"><div className="loader-wrapper"><div className="spinner" /></div></div>;
    }

    return (
        <div className="page container" id="browse-page">
            <h1 className="browse-title animate-fade-in" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Library size={32} color="#0071e3" /> Browse Subjects
            </h1>
            <p className="browse-subtitle animate-fade-in">Explore faculties, majors, and subjects</p>

            <div className="faculty-list stagger">
                {faculties.map((f) => (
                    <div key={f.id} className="faculty-item glass-card animate-fade-in" id={`faculty-${f.id}`}>
                        <button className="faculty-header" onClick={() => toggleFaculty(f.id)}>
                            <span className="faculty-icon"><Building2 size={20} color="#0071e3" /></span>
                            <span className="faculty-name">{f.name}</span>
                            <span className="expand-icon">{expandedFaculty === f.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                        </button>

                        {expandedFaculty === f.id && majors[f.id] && (
                            <div className="major-list animate-slide-down">
                                {majors[f.id].map((m) => (
                                    <div key={m.id} className="major-item" id={`major-${m.id}`}>
                                        <button className="major-header" onClick={() => toggleMajor(m.id)}>
                                            <span className="major-icon"><GraduationCap size={18} color="#8e8e93" /></span>
                                            <span className="major-name">{m.name}</span>
                                            <span className="expand-icon">{expandedMajor === m.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
                                        </button>

                                        {expandedMajor === m.id && subjects[m.id] && (
                                            <div className="subject-list animate-slide-down">
                                                {subjects[m.id].length === 0 ? (
                                                    <p className="no-subjects">No subjects found</p>
                                                ) : (
                                                    subjects[m.id].map((s) => (
                                                        <Link to={`/subject/${s.id}`} key={s.id} className="subject-item" id={`subject-${s.id}`}>
                                                            <span className="subject-code badge badge-primary">{s.code}</span>
                                                            <span className="subject-name">{s.name}</span>
                                                            <span className="subject-year badge badge-warning">{s.year_level}</span>
                                                        </Link>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
