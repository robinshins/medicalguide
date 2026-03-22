'use client';

import { useState, useEffect, useCallback } from 'react';

interface Comment {
  id: string;
  nickname: string;
  content: string;
  createdAt: string;
}

export default function Comments({ articleId, lang }: { articleId: string; lang: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [nickname, setNickname] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isKo = lang === 'ko';

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/comments?articleId=${encodeURIComponent(articleId)}`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch { /* ignore */ }
    setLoading(false);
  }, [articleId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, nickname: nickname.trim() || undefined, content: content.trim() }),
      });
      if (res.ok) {
        setContent('');
        fetchComments();
      }
    } catch { /* ignore */ }
    setSubmitting(false);
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(lang === 'ko' ? 'ko-KR' : 'en-US', {
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
      });
    } catch { return iso; }
  };

  return (
    <section className="mt-14 border-t border-gray-200 pt-10">
      <h2 className="text-xl font-bold text-gray-900 mb-6">
        {isKo ? '댓글' : 'Comments'}
        {comments.length > 0 && <span className="ml-2 text-base font-normal text-gray-400">{comments.length}</span>}
      </h2>

      {/* Comment form */}
      <form onSubmit={handleSubmit} className="mb-8 bg-gray-50 rounded-2xl p-5 border border-gray-100">
        <div className="flex gap-3 mb-3">
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            placeholder={isKo ? '닉네임 (선택, 비우면 익명)' : 'Nickname (optional, anonymous if empty)'}
            maxLength={30}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white"
          />
        </div>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder={isKo ? '댓글을 남겨주세요...' : 'Leave a comment...'}
          maxLength={1000}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-gray-400 bg-white resize-none mb-3"
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{content.length}/1000</span>
          <button
            type="submit"
            disabled={!content.trim() || submitting}
            className="bg-gray-900 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {submitting
              ? (isKo ? '등록 중...' : 'Posting...')
              : (isKo ? '댓글 등록' : 'Post Comment')}
          </button>
        </div>
      </form>

      {/* Comments list */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          {isKo ? '댓글을 불러오는 중...' : 'Loading comments...'}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          {isKo ? '아직 댓글이 없습니다. 첫 번째 댓글을 남겨주세요!' : 'No comments yet. Be the first to leave a comment!'}
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map(comment => (
            <div key={comment.id} className="bg-white border border-gray-100 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900">
                  {comment.nickname || (isKo ? '익명' : 'Anonymous')}
                </span>
                <span className="text-xs text-gray-400">{formatDate(comment.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
