import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { BookOpen } from 'lucide-react';
import './Login.css';

interface Faculty { id: number; name: string; }
interface Major { id: number; name: string; }

export default function Login() {
    const { user, login, register } = useAuth();
    const navigate = useNavigate();
    const [tab, setTab] = useState<'login' | 'register'>('login');
    const [studentId, setStudentId] = useState('');
    const [faculties, setFaculties] = useState<Faculty[]>([]);
    const [majors, setMajors] = useState<Major[]>([]);
    const [facultyId, setFacultyId] = useState<number>(0);
    const [majorId, setMajorId] = useState<number>(0);
    const [year, setYear] = useState<number>(1);
    const [displayName, setDisplayName] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user) navigate('/dashboard');
    }, [user, navigate]);

    useEffect(() => {
        api.get('/faculties').then((r) => setFaculties(r.data)).catch(() => { });
    }, []);

    useEffect(() => {
        if (facultyId) {
            api.get(`/faculties/${facultyId}/majors`).then((r) => {
                setMajors(r.data);
                setMajorId(0);
            }).catch(() => { });
        } else {
            setMajors([]);
        }
    }, [facultyId]);

    const handleLogin = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await login(studentId);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Login failed');
        }
        setLoading(false);
    };

    const handleRegister = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        if (!facultyId || !majorId) {
            setError('Please select faculty and major');
            return;
        }
        setLoading(true);
        try {
            await register({ studentId, facultyId, majorId, year, name: displayName.trim() || undefined });
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Registration failed');
        }
        setLoading(false);
    };

    const currentYear = new Date().getFullYear();

    return (
        <div className="login-page" id="login-page">
            <div className="login-backdrop" />
            <div className="login-container animate-scale-in">
                <div className="login-brand">
                    <span className="login-logo"><BookOpen size={48} color="#0071e3" /></span>
                    <h1 className="login-title">NoteEverywhere</h1>
                    <p className="login-subtitle">Share & discover academic notes at Kasetsart University</p>
                </div>

                <div className="login-card glass-card">
                    <div className="tabs">
                        <button className={`tab ${tab === 'login' ? 'active' : ''}`} onClick={() => { setTab('login'); setError(''); }} id="login-tab">
                            Sign In
                        </button>
                        <button className={`tab ${tab === 'register' ? 'active' : ''}`} onClick={() => { setTab('register'); setError(''); }} id="register-tab">
                            Register
                        </button>
                    </div>

                    {error && <div className="login-error">{error}</div>}

                    {tab === 'login' ? (
                        <form onSubmit={handleLogin}>
                            <div className="input-group">
                                <label htmlFor="login-sid">Student ID</label>
                                <input
                                    id="login-sid"
                                    className="input"
                                    type="text"
                                    placeholder="e.g. 6510500001"
                                    value={studentId}
                                    onChange={(e) => setStudentId(e.target.value)}
                                    maxLength={10}
                                    pattern="\d{10}"
                                    required
                                />
                            </div>
                            <button type="submit" className="btn btn-primary btn-lg login-submit" disabled={loading} id="login-submit">
                                {loading ? 'Signing in...' : 'Sign In'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleRegister}>
                            <div className="register-fields">
                                <div className="input-group">
                                    <label htmlFor="reg-sid">Student ID</label>
                                    <input
                                        id="reg-sid"
                                        className="input"
                                        type="text"
                                        placeholder="10-digit Student ID"
                                        value={studentId}
                                        onChange={(e) => setStudentId(e.target.value)}
                                        maxLength={10}
                                        pattern="\d{10}"
                                        required
                                    />
                                </div>
                                <div className="input-group">
                                    <label htmlFor="reg-faculty">Faculty</label>
                                    <select id="reg-faculty" className="select" value={facultyId} onChange={(e) => setFacultyId(Number(e.target.value))} required>
                                        <option value={0}>Select Faculty</option>
                                        {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label htmlFor="reg-major">Major</label>
                                    <select id="reg-major" className="select" value={majorId} onChange={(e) => setMajorId(Number(e.target.value))} required disabled={!facultyId}>
                                        <option value={0}>Select Major</option>
                                        {majors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label htmlFor="reg-year">Year</label>
                                    <select id="reg-year" className="select" value={year} onChange={(e) => setYear(Number(e.target.value))} required>
                                        {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y} ({currentYear + y - 1})</option>)}
                                    </select>
                                </div>
                                <div className="input-group">
                                    <label htmlFor="reg-name">Display Name (optional)</label>
                                    <input
                                        id="reg-name"
                                        className="input"
                                        type="text"
                                        placeholder="e.g. Somchai"
                                        value={displayName}
                                        onChange={(e) => setDisplayName(e.target.value)}
                                        maxLength={100}
                                    />
                                </div>
                            </div>
                            <button type="submit" className="btn btn-primary btn-lg login-submit" disabled={loading} id="register-submit">
                                {loading ? 'Creating Account...' : 'Create Account'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
