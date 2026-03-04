import { Link } from 'react-router-dom';
import './NoteCard.css';

interface NoteCardProps {
    note: {
        id: number;
        title: string;
        description?: string;
        subject_name: string;
        subject_code: string;
        uploader_student_id: string;
        uploader_name?: string;
        rating_score: number;
        comment_count?: number;
        file_type?: string;
        created_at: string;
    };
}

function getFileIcon(fileType?: string): string {
    if (!fileType) return '📄';
    if (fileType.includes('pdf')) return '📕';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('audio')) return '🎵';
    if (fileType.includes('video')) return '🎬';
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return '📊';
    if (fileType.includes('word') || fileType.includes('document')) return '📝';
    return '📄';
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString();
}

export default function NoteCard({ note }: NoteCardProps) {
    const scoreClass = note.rating_score > 0 ? 'positive' : note.rating_score < 0 ? 'negative' : '';

    return (
        <Link to={`/note/${note.id}`} className="note-card glass-card animate-fade-in" id={`note-card-${note.id}`}>
            <div className="note-card-header">
                <span className="file-icon">{getFileIcon(note.file_type)}</span>
                <span className="subject-badge badge badge-primary">{note.subject_code}</span>
            </div>
            <h3 className="note-card-title">{note.title}</h3>
            {note.description && (
                <p className="note-card-desc">{note.description.slice(0, 100)}{note.description.length > 100 ? '…' : ''}</p>
            )}
            <div className="note-card-meta">
                <span className="meta-item">
                    🎓 {note.uploader_name
                        ? `${note.uploader_name} (${note.uploader_student_id.slice(0, 4)}...)`
                        : `${note.uploader_student_id.slice(0, 4)}...`}
                </span>
                <span className={`meta-item score ${scoreClass}`}>
                    {note.rating_score > 0 ? '▲' : note.rating_score < 0 ? '▼' : '•'} {note.rating_score}
                </span>
                {note.comment_count !== undefined && (
                    <span className="meta-item">💬 {note.comment_count}</span>
                )}
                <span className="meta-item time">{timeAgo(note.created_at)}</span>
            </div>
        </Link>
    );
}
