import { useState } from 'react';
import api from '../api';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import './RatingWidget.css';

interface RatingWidgetProps {
    noteId: number;
    initialScore: number;
    initialLikes: number;
    initialDislikes: number;
    initialUserRating: number; // 1, -1 or 0
}

export default function RatingWidget({ noteId, initialScore, initialLikes, initialDislikes, initialUserRating }: RatingWidgetProps) {
    const [score, setScore] = useState(initialScore);
    const [likes, setLikes] = useState(initialLikes);
    const [dislikes, setDislikes] = useState(initialDislikes);
    const [userRating, setUserRating] = useState(initialUserRating);
    const [loading, setLoading] = useState(false);

    const handleRate = async (value: 1 | -1) => {
        if (loading) return;
        setLoading(true);
        try {
            if (userRating === value) {
                // Remove rating
                const res = await api.delete(`/notes/${noteId}/rate`);
                setScore(Number(res.data.rating_score));
                setLikes(Number(res.data.likes));
                setDislikes(Number(res.data.dislikes));
                setUserRating(0);
            } else {
                const res = await api.post(`/notes/${noteId}/rate`, { value });
                setScore(Number(res.data.rating_score));
                setLikes(Number(res.data.likes));
                setDislikes(Number(res.data.dislikes));
                setUserRating(value);
            }
        } catch (err) {
            console.error('Rating error:', err);
        }
        setLoading(false);
    };

    return (
        <div className="rating-widget" id="rating-widget">
            <button
                className={`rate-btn like ${userRating === 1 ? 'active' : ''}`}
                onClick={() => handleRate(1)}
                disabled={loading}
                id="like-btn"
                title="Like"
            >
                <span className="rate-icon"><ThumbsUp size={16} /></span>
                <span className="rate-count">{likes}</span>
            </button>
            <span className={`rating-score ${score > 0 ? 'positive' : score < 0 ? 'negative' : ''}`}>
                {score > 0 ? '+' : ''}{score}
            </span>
            <button
                className={`rate-btn dislike ${userRating === -1 ? 'active' : ''}`}
                onClick={() => handleRate(-1)}
                disabled={loading}
                id="dislike-btn"
                title="Dislike"
            >
                <span className="rate-icon"><ThumbsDown size={16} /></span>
                <span className="rate-count">{dislikes}</span>
            </button>
        </div>
    );
}
