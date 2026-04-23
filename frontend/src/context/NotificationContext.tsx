import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../api';
import { useAuth } from './AuthContext';

interface Notification {
    id: number;
    type: string;
    message: string;
    reference_id: number | null;
    is_read: boolean;
    created_at: string;
}

interface Toast {
    id: number;
    message: string;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    toasts: Toast[];
    fetchNotifications: () => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
    markAllRead: () => Promise<void>;
    dismissToast: (id: number) => void;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

let toastId = 0;

export function NotificationProvider({ children }: { children: ReactNode }) {
    const { token, user } = useAuth();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [toasts, setToasts] = useState<Toast[]>([]);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await api.get('/notifications');
            setNotifications(res.data);
            const countRes = await api.get('/notifications/unread-count');
            setUnreadCount(countRes.data.count);
        } catch {
            // silently fail
        }
    }, []);

    // Connect socket on login
    useEffect(() => {
        if (!token || !user) return;

        const s = io(window.location.origin, { transports: ['websocket', 'polling'] });
        s.on('connect', () => {
            s.emit('authenticate', token);
        });

        s.on('new_notification', (data: { type: string; message: string }) => {
            const id = ++toastId;
            setToasts((prev) => [...prev, { id, message: data.message }]);
            setUnreadCount((prev) => prev + 1);
            fetchNotifications();
            // Auto-dismiss toast
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, 5000);
        });

        setSocket(s);
        fetchNotifications();

        return () => {
            s.disconnect();
            setSocket(null);
        };
    }, [token, user, fetchNotifications]);

    const markAsRead = async (id: number) => {
        await api.put(`/notifications/${id}/read`);
        setNotifications((prev) =>
            prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
    };

    const markAllRead = async () => {
        await api.put('/notifications/read-all');
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
    };

    const dismissToast = (id: number) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    // Suppress unused socket warning
    void socket;

    return (
        <NotificationContext.Provider
            value={{ notifications, unreadCount, toasts, fetchNotifications, markAsRead, markAllRead, dismissToast }}
        >
            {children}
        </NotificationContext.Provider>
    );
}

export function useNotifications() {
    const ctx = useContext(NotificationContext);
    if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
    return ctx;
}
