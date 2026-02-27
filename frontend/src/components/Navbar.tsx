import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import './Navbar.css';

export default function Navbar() {
    const { user, logout } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();

    const isActive = (path: string) => location.pathname === path;

    const handleLogout = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="navbar" id="main-navbar">
            <div className="navbar-inner container">
                <Link to="/dashboard" className="navbar-brand">
                    <span className="brand-icon">📝</span>
                    <span className="brand-text">NoteEverywhere</span>
                </Link>

                <div className="navbar-links">
                    <Link to="/dashboard" className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}>
                        <span className="nav-icon">🏠</span>
                        Dashboard
                    </Link>
                    <Link to="/browse" className={`nav-link ${isActive('/browse') ? 'active' : ''}`}>
                        <span className="nav-icon">📚</span>
                        Browse
                    </Link>
                    <Link to="/upload" className={`nav-link ${isActive('/upload') ? 'active' : ''}`}>
                        <span className="nav-icon">📤</span>
                        Upload
                    </Link>
                </div>

                <div className="navbar-actions">
                    <NotificationBell />
                    <div className="user-menu">
                        <span className="user-id" title={user?.student_id || ''}>
                            🎓 {user?.student_id?.slice(0, 4)}...{user?.student_id?.slice(-3)}
                        </span>
                        <button className="btn btn-ghost btn-sm" onClick={handleLogout} id="logout-btn">
                            Logout
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
}
