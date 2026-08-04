import { useState, useRef } from 'react';
import { FileText, Loader, Upload, Check } from 'lucide-react';
import { upgradeUploadDocForRag, generateQACards, addKnowledge, MAX_UPLOAD_SIZE } from '../api';
import type { Section, QA } from '../data/content';
import { SUBJECT_OPTIONS } from './KnowledgeUtils';
import KnowledgeCard from './KnowledgeCard';
import CardEditModal from './CardEditModal';
import db from '../store/db';

export default function DocUploadView({ onBack, onDone }: { onBack: () => void; onDone?: () => void }) {
  type Phase = 'select' | 'parsing' | 'review';
  const [phase, setPhase] = useState<Phase>('select');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState({ step: '', percent: 0 });
  const [sections, setSections] = useState<Section[]>([]);
  const [cards, setCards] = useState<QA[]>([]);
  const [docTitle, setDocTitle] = useState('');
  const [subject, setSubject] = useState('custom');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [editIdx, setEditIdx] = useState(-1);
  const [editCard, setEditCard] = useState<QA | null>(null);
  const [errMsg, setErrMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelected = async (f: File) => {
    setFile(f);
    setErrMsg('');
    setDocTitle(f.name.replace(/\.\w+$/, ''));
    setPhase('parsing');
    setProgress({ step: '上传文件中...', percent: 20 });
    const r = await upgradeUploadDocForRag(f);
    if (!r.ok) { setErrMsg(r.msg); setPhase('select'); return; }
    const parsed = r.sections || [];
    setProgress({ step: '生成知识点卡片...', percent: 70 });
    const cardR = await generateQACards(parsed);
    setProgress({ step: '完成', percent: 100 });
    const merged = parsed.map((s, i) => ({ ...s, qa: cardR.cards?.[i] || undefined }));
    setSections(merged);
    setCards(merged.map(s => s.qa).filter(Boolean) as QA[]);
    setPhase('review');
  };

  const regenerateCard = async (idx: number) => {
    const sec = sections[idx];
    if (!sec) return;
    const result = await generateQACards([{ title: sec.title, body: sec.body, code: sec.code || '' }]);
    if (result.ok && result.cards?.[0]) {
      const newCards = [...cards];
      newCards[idx] = result.cards[0] as QA;
      setCards(newCards);
      const newSections = [...sections];
      newSections[idx] = { ...newSections[idx], qa: result.cards[0] as QA };
      setSections(newSections);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const merged = sections.map((s, i) => {
        const card = cards[i];
        return card ? { ...s, qa: card } : s;
      });
      const entry = {
        _id: crypto.randomUUID(),
        title: docTitle || file?.name?.replace(/\.\w+$/, '') || '未命名',
        subj: subject,
        tags: tags.trim() || '文档',
        source: '文件上传: ' + (file?.name || ''),
        sections: merged,
        createdAt: now,
        updatedAt: now,
      };
      await db.addKnowledge(entry);
      await addKnowledge(entry).catch(() => {});
      try { await db.pushSync(); } catch {}
      onDone?.();
      onBack();
    } catch {
      setErrMsg('保存失败，请重试');
      setPhase('review');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <button onClick={onBack} style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--surface)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)', fontSize: 18, flexShrink: 0 }}>‹</button>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>
          {phase === 'parsing' ? '解析中...' : phase === 'review' ? '知识点卡片' : '文档导入'}
        </h2>
      </div>

      <div style={{ flex: 1, padding: '6px 12px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        {/* Phase 1: File select */}
        {phase === 'select' && (
          <>
            <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: '28px 16px', textAlign: 'center', cursor: 'pointer', background: 'var(--surface)', marginBottom: 12 }}>
              <input ref={fileRef} type="file" accept=".docx,.pdf,.md,.markdown,.html,.htm,.txt" onChange={e => { const f = e.target.files?.[0]; if (f) { if (f.size > MAX_UPLOAD_SIZE) { alert('文件过大'); return; } handleFileSelected(f); } }} style={{ display: 'none' }} />
              <FileText size={36} strokeWidth={1.5} style={{ marginBottom: 6, color: 'var(--primary)', opacity: 0.6 }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>点击选择文档文件</div>
              <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 4 }}>支持 Word, PDF, Markdown, HTML, 纯文本</div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 4 }}>
              {['Word', 'PDF', 'Markdown', 'HTML', '纯文本'].map(fmt => (
                <span key={fmt} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: 'var(--primary-light)', color: 'var(--primary-dark)' }}><Check size={10} />{fmt}</span>
              ))}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>选中后自动解析并生成知识点卡片</div>
            {errMsg && <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, background: 'var(--rose-light)', color: 'var(--rose)' }}>✗ {errMsg}</div>}
          </>
        )}

        {/* Phase 2: Parsing */}
        {phase === 'parsing' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Loader size={36} className="spin" style={{ color: 'var(--primary)', marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>{progress.step}</div>
            <div style={{ width: '60%', height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
              <div style={{ height: '100%', borderRadius: 3, background: 'var(--primary)', width: `${progress.percent}%`, transition: 'width .4s ease' }} />
            </div>
          </div>
        )}

        {/* Phase 3: Card review */}
        {phase === 'review' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '4px 2px 6px' }}>
              <input value={docTitle} onChange={e => setDocTitle(e.target.value)} style={{ width: '100%', border: '2px solid var(--border)', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontWeight: 700, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', marginBottom: 6 }} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                <select value={subject} onChange={e => setSubject(e.target.value)} style={{ flex: 1, border: '2px solid var(--border)', borderRadius: 10, padding: '7px 10px', fontSize: 12, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}>
                  {SUBJECT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input value={tags} onChange={e => setTags(e.target.value)} placeholder="标签，逗号分隔" style={{ flex: 2, border: '2px solid var(--border)', borderRadius: 10, padding: '7px 10px', fontSize: 12, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }} />
              </div>
            </div>

            {cards.length > 0 ? (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>知识点卡片 ({cards.length})</div>
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: 8 }}>
                  {cards.map((qa, i) => (
                    <KnowledgeCard key={i} index={i} qa={qa}
                      onRegenerate={() => regenerateCard(i)}
                      onEdit={() => { setEditIdx(i); setEditCard({ ...qa }); }} />
                  ))}
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
                <div style={{ fontWeight: 600, marginBottom: 2 }}>AI 生成失败</div>
                <div>可手动编辑章节内容后重试</div>
                <button onClick={() => regenerateCard(0)} style={{ marginTop: 10, padding: '6px 16px', border: '2px solid var(--border)', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)' }}>🔄 重试</button>
              </div>
            )}

            <button onClick={handleSaveAll} disabled={saving}
              style={{ width: '100%', padding: '12px 0', border: 'none', borderRadius: 'var(--radius-sm)', fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: 'var(--font)', background: saving ? 'var(--border)' : 'var(--primary)', color: saving ? 'var(--text-tertiary)' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Upload size={16} /> {saving ? '保存中...' : '全部保存到知识库'}
            </button>
          </div>
        )}
      </div>

      {editIdx >= 0 && editCard && (
        <CardEditModal qa={editCard}
          onSave={(updated) => { const nc = [...cards]; nc[editIdx] = updated; setCards(nc); setSections(prev => { const ns = [...prev]; ns[editIdx] = { ...ns[editIdx], qa: updated }; return ns; }); setEditIdx(-1); setEditCard(null); }}
          onClose={() => { setEditIdx(-1); setEditCard(null); }} />
      )}
    </div>
  );
}
