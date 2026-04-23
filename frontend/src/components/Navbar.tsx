import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { Home, Library, Upload, GraduationCap, Edit3, NotebookText, Check, X } from 'lucide-react';
import './Navbar.css';

export default function Navbar() {
    const { user, logout, updateProfile } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const [editingName, setEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(user?.name || '');
    const [saving, setSaving] = useState(false);

    const isActive = (path: string) => location.pathname === path;

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    const handleSaveName = async () => {
        if (!user) return;
        setSaving(true);
        try {
            await updateProfile({
                facultyId: user.faculty_id!,
                majorId: user.major_id!,
                year: user.year!,
                name: nameInput.trim(),
            });
            setEditingName(false);
        } catch (err) {
            console.error(err);
        }
        setSaving(false);
    };

    const displayIdentity = user?.name
        ? `${user.name} (${user.student_id?.slice(0, 4)}...)`
        : `${user?.student_id?.slice(0, 4)}...${user?.student_id?.slice(-3)}`;

    return (
        <nav className="navbar" id="main-navbar">
            <div className="navbar-inner container">
                <Link to="/dashboard" className="navbar-brand">
                    <span className="brand-icon"><NotebookText size={22} color="#0071e3" /></span>
                    <span className="brand-text">NoteEverywhere</span>
                </Link>

                <div className="navbar-links">
                    <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
                        <span className="nav-icon"><Home size={18} /></span>
                        Dashboard
                    </Link>
                    <Link to="/browse" className={`nav-link ${isActive('/browse') ? 'active' : ''}`}>
                        <span className="nav-icon"><Library size={18} /></span>
                        Browse
                    </Link>
                    <Link to="/upload" className={`nav-link ${isActive('/upload') ? 'active' : ''}`}>
                        <span className="nav-icon"><Upload size={18} /></span>
                        Upload
                    </Link>
                </div>

                <div className="navbar-actions">
                    <NotificationBell />
                    <div className="user-menu">
                        {editingName ? (
                            <div className="name-edit-inline">
                                <input
                                    className="input name-edit-input"
                                    type="text"
                                    value={nameInput}
                                    onChange={(e) => setNameInput(e.target.value)}
                                    placeholder="Display name"
                                    maxLength={100}
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSaveName();
                                        if (e.key === 'Escape') setEditingName(false);
                                    }}
                                />
                                <button className="btn btn-primary btn-sm" onClick={handleSaveName} disabled={saving}>
                                    {saving ? '...' : <Check size={16} />}
                                </button>
                                <button className="btn btn-ghost btn-sm" onClick={() => setEditingName(false)}>
                                    <X size={16} />
                                </button>
                            </div>
                        ) : (
                            <>
                                <span className="user-id" title={user?.student_id || ''}>
                                    <GraduationCap size={16} style={{ marginRight: 4, verticalAlign: 'text-bottom' }} />
                                    {displayIdentity}
                                </span>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => { setNameInput(user?.name || ''); setEditingName(true); }}
                                    title="Edit display name"
                                    id="edit-name-btn"
                                >
                                    <Edit3 size={16} />
                                </button>
                            </>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={handleLogout} id="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
