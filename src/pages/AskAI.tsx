import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Send, ChevronDown, ChevronRight, BookOpen, MessageSquare, Lightbulb } from 'lucide-react';
import { ragQuery } from '../api';
import StatusBar from '../components/StatusBar';

export default function AskAI() {
  const nav = useNavigate();
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ answer: string | null; results: any[]; status: string } | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    const r = await ragQuery(query, 5);
    setResult(r);
    setLoading(false);
  };

  const toggle = (i: number) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i); else n.add(i);
      return n;
    });
  };

  return (
    <div className="page">
      <StatusBar />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={() => nav('/')} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--surface)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0 }}>&#x2039;</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>Ask AI</h2>
      </div>

      {/* Search bar */}
      <div style={{ padding: '6px 12px 8px', display: 'flex', gap: 6 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="向知识库提问..." style={{ width: '100%', border: '2px solid var(--border)', borderRadius: 10, padding: '10px 12px 10px 34px', fontSize: 14, fontFamily: 'var(--font)', outline: 'none', background: 'var(--surface)', color: 'var(--text)' }} />
        </div>
        <button onClick={handleSearch} disabled={loading || !query.trim()}
          style={{ padding: '10px 16px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: loading || !query.trim() ? 'default' : 'pointer', fontFamily: 'var(--font)', background: loading || !query.trim() ? 'var(--border)' : 'var(--primary)', color: '#fff' }}>
          {loading ? '...' : <Send size={16} />}
        </button>
      </div>

      <div className="scroll" style={{ paddingTop: 0 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)', fontSize: 13 }}>
            <MessageSquare size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
            <div>正在检索知识库...</div>
          </div>
        )}

        {result && (
          <>
            {/* AI Answer */}
            {result.answer && (
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: 14, marginBottom: 10, border: '2px solid var(--primary-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                  <Lightbulb size={16} color="var(--primary)" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)' }}>AI 回答</span>
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{result.answer}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 6 }}>基于 {result.results.length} 个知识片段</div>
              </div>
            )}

            {/* No answer case */}
            {!result.answer && result.status !== 'empty' && (
              <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
                <div style={{ marginBottom: 4 }}>已找到 {result.results.length} 个相关片段</div>
                <div style={{ fontSize: 10 }}>在 AI 助手设置中配置 API Key 后可获取 AI 回答</div>
              </div>
            )}

            {/* Source chunks */}
            {result.results.length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  知识片段 ({result.results.length})
                  <span style={{ fontWeight: 400, color: 'var(--text-tertiary)', marginLeft: 6, fontSize: 10 }}>{result.status === 'vector' ? '向量检索' : '关键词检索'}</span>
                </div>
                {result.results.map((chunk, i) => {
                  const isExpanded = expanded.has(i);
                  const scorePct = Math.round((chunk.score || 0) * 100);
                  return (
                    <div key={i} onClick={() => toggle(i)} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 6, border: '2px solid var(--border-light)', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 8px', borderRadius: 10, background: scorePct > 80 ? '#e6f7ef' : scorePct > 60 ? '#fff3e0' : '#f5f5f5', color: scorePct > 80 ? '#00b365' : scorePct > 60 ? '#ff7d00' : '#999' }}>{scorePct}%</span>
                        <span style={{ flex: 1, fontSize: 11, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{chunk.article_title || '知识片段'}</span>
                        {isExpanded ? <ChevronDown size={14} color="var(--text-tertiary)" /> : <ChevronRight size={14} color="var(--text-tertiary)" />}
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border-light)', fontSize: 11, lineHeight: 1.6, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{chunk.content}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty */}
            {result.results.length === 0 && result.status !== 'empty' && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>没有找到相关内容</div>
            )}
          </>
        )}

        {/* Empty state */}
        {!result && !loading && (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-tertiary)' }}>
            <BookOpen size={40} strokeWidth={1} style={{ marginBottom: 10, opacity: 0.4 }} />
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>向知识库提问</div>
            <div style={{ fontSize: 12, lineHeight: 1.5 }}>输入问题，AI 会从你上传的文档中<br />检索相关内容并生成回答</div>
          </div>
        )}
      </div>
    </div>
  );
}
