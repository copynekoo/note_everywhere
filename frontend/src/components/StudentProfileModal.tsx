import { useState, useEffect } from 'react';
import api from '../api';
import { X, UserCircle2, Building2, GraduationCap, Calendar } from 'lucide-react';
import './StudentProfileModal.css';

interface StudentProfile {
    student_id: string;
    name: string | null;
    faculty_name: string | null;
    major_name: string | null;
    year: number | null;
}

interface StudentProfileModalProps {
    studentId: string;
    onClose: () => void;
}

export default function StudentProfileModal({ studentId, onClose }: StudentProfileModalProps) {
    const [profile, setProfile] = useState<StudentProfile | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/auth/user/${studentId}`)
            .then((r) => setProfile(r.data))
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [studentId]);

    return (
        <div className="profile-modal-overlay" onClick={onClose}>
            <div className="profile-modal glass-card" onClick={(e) => e.stopPropagation()}>
                <button className="profile-modal-close" onClick={onClose}><X size={20} /></button>

                {loading ? (
                    <div className="profile-loading">
                        <div className="spinner" />
                    </div>
                ) : !profile ? (
                    <div className="profile-loading">User not found</div>
                ) : (
                    <>
                        <div className="profile-modal-header">
                            <div className="profile-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><UserCircle2 size={64} color="#8e8e93" strokeWidth={1} /></div>
                            {profile.name && <h2 className="profile-name">{profile.name}</h2>}
                            <p className="profile-student-id">{profile.student_id}</p>
                        </div>

                        <div className="profile-details">
                            <div className="profile-detail-row">
                                <span className="profile-detail-icon"><Building2 size={16} color="#8e8e93" /></span>
                                <div>
                                    <div className="profile-detail-label">Faculty</div>
                                    <div className="profile-detail-value">{profile.faculty_name || 'Not set'}</div>
                                </div>
                            </div>
                            <div className="profile-detail-row">
                                <span className="profile-detail-icon"><GraduationCap size={16} color="#8e8e93" /></span>
                                <div>
                                    <div className="profile-detail-label">Major</div>
                                    <div className="profile-detail-value">{profile.major_name || 'Not set'}</div>
                                </div>
                            </div>
                            <div className="profile-detail-row">
                                <span className="profile-detail-icon"><Calendar size={16} color="#8e8e93" /></span>
                                <div>
                                    <div className="profile-detail-label">Year</div>
                                    <div className="profile-detail-value">{profile.year ? `Year ${profile.year}` : 'Not set'}</div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
