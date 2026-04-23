import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import { Bell, FileText, MessageSquare } from 'lucide-react';
import './NotificationBell.css';

export default function NotificationBell() {
    const { notifications, unreadCount, markAsRead, markAllRead } = useNotifications();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleClick = async (n: { id: number; reference_id: number | null; is_read: boolean; type: string }) => {
        if (!n.is_read) await markAsRead(n.id);
        if (n.reference_id && (n.type === 'new_note' || n.type === 'new_comment')) {
            navigate(`/note/${n.reference_id}`);
        }
        setOpen(false);
    };

    return (
        <div className="notification-bell dropdown" ref={ref} id="notification-bell">
            <button className="bell-btn btn btn-ghost btn-icon" onClick={() => setOpen(!open)} id="bell-toggle">
                <Bell size={20} color="var(--text-primary)" />
                {unreadCount > 0 && <span className="bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
            </button>

            {open && (
                <div className="dropdown-menu notification-dropdown animate-slide-down">
                    <div className="notif-header">
                        <span className="notif-title">Notifications</span>
                        {unreadCount > 0 && (
                            <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>
                        )}
                    </div>
                    <div className="notif-list">
                        {notifications.length === 0 ? (
                            <div className="notif-empty">No notifications yet</div>
                        ) : (
                            notifications.slice(0, 20).map((n) => (
                                <div
                                    key={n.id}
                                    className={`notif-item ${n.is_read ? '' : 'unread'}`}
                                    onClick={() => handleClick(n)}
                                    id={`notif-${n.id}`}
                                >
                                    <span className="notif-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {n.type === 'new_note' ? <FileText size={16} color="#0071e3" /> : n.type === 'new_comment' ? <MessageSquare size={16} color="#10b981" /> : <Bell size={16} color="#f5a623" />}
                                    </span>
                                    <div className="notif-content">
                                        <p className="notif-message">{n.message}</p>
                                        <span className="notif-time">{new Date(n.created_at).toLocaleString()}</span>
                                    </div>
                                    {!n.is_read && <span className="notif-dot" />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
