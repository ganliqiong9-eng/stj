import { useState, useRef } from 'react';
import { Search, Send, ExternalLink, ChevronDown, ChevronRight, Settings } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import { ragQuery, getRagStatus } from '../api';

export default function AdminRag() {
  const [query, setQuery] = useState('');
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ answer: string | null; results: any[]; status: string } | null>(null);
  const [ragStatus, setRagStatus] = useState<string>('');
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());
  const [showConfig, setShowConfig] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await ragQuery(query, topK);
      setResult(r);
    } catch {
      setResult({ answer: '查询失败', results: [], status: 'error' });
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSearch();
    }
  };

  const toggleChunk = (idx: number) => {
    setExpandedChunks(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <AdminLayout title="RAG 问答调试">
      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
          <textarea value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="输入问题，从知识库中检索并生成答案..." rows={2}
            style={{ width: '100%', border: '2px solid #e0e0e0', borderRadius: 10, padding: '10px 12px 10px 38px', fontSize: 13, fontFamily: 'var(--font)', outline: 'none', resize: 'none', lineHeight: 1.5, background: '#fff' }} />
        </div>
        <button onClick={handleSearch} disabled={loading || !query.trim()}
          style={{ padding: '10px 20px', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: loading ? 'default' : 'pointer', fontFamily: 'var(--font)', background: loading ? '#e0e0e0' : '#3370ff', color: '#fff', display: 'flex', alignItems: 'center', gap: 6, alignSelf: 'flex-end' }}>
          {loading ? '检索中...' : <><Send size={14} /> 检索</>}
        </button>
      </div>

      {/* Config bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setShowConfig(!showConfig)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'var(--font)', background: '#fff', color: '#555' }}>
          <Settings size={12} /> TopK: {topK}
        </button>
        {showConfig && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: '#999' }}>TopK:</span>
            <input type="range" min={1} max={10} value={topK} onChange={e => setTopK(Number(e.target.value))} style={{ width: 80 }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#555', minWidth: 20 }}>{topK}</span>
          </div>
        )}
        <span style={{ fontSize: 10, color: '#999', marginLeft: 'auto' }}>RAG: {ragStatus || '未检测'}</span>
      </div>

      {/* Results */}
      {loading && <div style={{ textAlign: 'center', padding: 40, color: '#999', fontSize: 13 }}>正在检索知识库...</div>}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* AI Answer */}
          {result.answer && (
            <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e0e0e0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#3370ff', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Send size={14} /> AI 回答
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: '#1f2329', whiteSpace: 'pre-wrap' }}>{result.answer}</div>
            </div>
          )}

          {/* Retrieved chunks */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#555', marginBottom: 8 }}>
              召回片段 ({result.results.length})
              <span style={{ fontWeight: 400, color: '#999', marginLeft: 6 }}>检索模式: {result.status}</span>
            </div>
            {result.results.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#999', fontSize: 12, background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0' }}>
                未找到匹配内容
              </div>
            ) : (
              result.results.map((chunk, i) => {
                const isExpanded = expandedChunks.has(i);
                const scorePct = Math.round((chunk.score || 0) * 100);
                const scoreColor = scorePct > 80 ? '#00b365' : scorePct > 60 ? '#ff7d00' : '#999';

                return (
                  <div key={i} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e0e0e0', marginBottom: 6, overflow: 'hidden' }}>
                    <div onClick={() => toggleChunk(i)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer' }}>
                      <div style={{ width: 32, height: 24, borderRadius: 4, background: scoreColor + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: scoreColor }}>{scorePct}%</div>
                      <div style={{ flex: 1, fontSize: 11, color: '#1f2329', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {chunk.article_title || '未知来源'}
                      </div>
                      <div style={{ fontSize: 10, color: '#999', flexShrink: 0 }}>{chunk.content?.substring(0, 40)}...</div>
                      {isExpanded ? <ChevronDown size={14} color="#999" /> : <ChevronRight size={14} color="#999" />}
                    </div>
                    {isExpanded && (
                      <div style={{ padding: '8px 12px', borderTop: '1px solid #f0f0f0', fontSize: 11, lineHeight: 1.6, color: '#555', whiteSpace: 'pre-wrap', background: '#fafafa' }}>
                        {chunk.content}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          <Search size={48} strokeWidth={1} style={{ marginBottom: 12, opacity: 0.3 }} />
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>输入问题开始测试</div>
          <div style={{ fontSize: 12 }}>系统将从知识库中召回相关内容并生成回答</div>
        </div>
      )}
    </AdminLayout>
  );
}
