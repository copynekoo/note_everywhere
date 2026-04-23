import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../api';

interface User {
    id: number;
    student_id: string;
    name?: string | null;
    faculty_id: number | null;
    major_id: number | null;
    year: number | null;
    faculty_name?: string;
    major_name?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    login: (studentId: string) => Promise<void>;
    register: (data: { studentId: string; facultyId: number; majorId: number; year: number; name?: string }) => Promise<void>;
    updateProfile: (data: { facultyId: number; majorId: number; year: number; name?: string }) => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const savedToken = localStorage.getItem('ne_token');
        const savedUser = localStorage.getItem('ne_user');
        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);
    }, []);

    const persistAuth = (u: User, t: string) => {
        setUser(u);
        setToken(t);
        localStorage.setItem('ne_token', t);
        localStorage.setItem('ne_user', JSON.stringify(u));
    };

    const login = async (studentId: string) => {
        const res = await api.post('/auth/login', { studentId });
        persistAuth(res.data.user, res.data.token);
    };

    const register = async (data: { studentId: string; facultyId: number; majorId: number; year: number; name?: string }) => {
        const res = await api.post('/auth/register', data);
        persistAuth(res.data.user, res.data.token);
    };

    const updateProfile = async (data: { facultyId: number; majorId: number; year: number; name?: string }) => {
        const res = await api.put('/auth/profile', data);
        const updated = { ...user, ...res.data } as User;
        setUser(updated);
        localStorage.setItem('ne_user', JSON.stringify(updated));
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('ne_token');
        localStorage.removeItem('ne_user');
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, updateProfile, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
