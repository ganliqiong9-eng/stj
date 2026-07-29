import { useState, useCallback } from 'react';
import { Plus, Search, FileText, FileSpreadsheet, BookOpen } from 'lucide-react';
import db, { type KnowledgeEntry } from '../store/db';
import StatusBar from '../components/StatusBar';
import KnowledgeList from '../components/KnowledgeList';
import KnowledgeForm from '../components/KnowledgeForm';
import KnowledgeDetail from '../components/KnowledgeDetail';
import DocUploadView from '../components/DocUploadView';
import TableUploadView from '../components/TableUploadView';
import UploadSheet from '../components/UploadSheet';
import PasteTextView from '../components/PasteTextView';

type ViewMode = 'list' | 'form' | 'detail' | 'doc-upload' | 'table-upload' | 'paste-text';

export default function Knowledge() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [detailEntry, setDetailEntry] = useState<KnowledgeEntry | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [search, setSearch] = useState('');
  const [filterSubj, setFilterSubj] = useState('all');
  const [showSearch, setShowSearch] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const openDetail = async (id: number) => {
    const entry = await db.getKnowledge(id);
    if (entry) { setDetailEntry(entry); setViewMode('detail'); }
  };

  if (viewMode === 'paste-text') {
    return (
      <div className="page">
        <StatusBar />
        <PasteTextView onBack={() => setViewMode('list')} onSave={() => setViewMode('list')} />
      </div>
    );
  }

  if (viewMode === 'doc-upload') {
    return (
      <div className="page">
        <StatusBar />
        <DocUploadView onBack={() => setViewMode('list')} onDone={() => setRefreshKey(k => k+1)} />
      </div>
    );
  }

  if (viewMode === 'table-upload') {
    return (
      <div className="page">
        <StatusBar />
        <TableUploadView onBack={() => setViewMode('list')} />
      </div>
    );
  }

  if (viewMode === 'form') {
    return (
      <div className="page">
        <StatusBar />
        <KnowledgeForm onBack={() => { setRefreshKey(k => k+1); setViewMode('list'); }} />
      </div>
    );
  }

  if (viewMode === 'detail' && detailEntry) {
    return (
      <div className="page">
        <StatusBar />
        <KnowledgeDetail entry={detailEntry} onBack={() => setViewMode('list')} />
      </div>
    );
  }

  return (
    <div className="page">
      <StatusBar />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px 4px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>知识中心 <span style={{fontSize:9,color:'var(--text-tertiary)',fontWeight:400}}>v2</span></h2>
        <button onClick={() => setShowSearch(!showSearch)}
          style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: 'var(--surface)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: 'var(--shadow-sm)' }}>
          <Search size={16} />
        </button>
      </div>

      {showSearch && (
        <div style={{ padding: '4px 12px 2px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="搜索知识..." autoFocus
            style={{ width: '100%', border: '2px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font)', background: 'var(--surface)', color: 'var(--text)', outline: 'none' }} />
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, padding: '4px 12px 6px', overflowX: 'auto' }}>
        {[
          { key: 'all', label: '全部' },
          { key: 'doc-upload', label: '文档' },
          { key: 'table-upload', label: '数据' },
          { key: 'form', label: '笔记' },
        ].map(f => (
          <button key={f.key} onClick={() => setFilterSubj(f.key)}
            style={{
              padding: '5px 14px', borderRadius: 20, border: '2px solid', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font)',
              borderColor: filterSubj === f.key ? 'var(--primary)' : 'var(--border)',
              background: filterSubj === f.key ? 'var(--primary)' : 'var(--surface)',
              color: filterSubj === f.key ? '#fff' : 'var(--text-secondary)',
            }}>
            {f.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 0', position: 'relative' }}>
        <KnowledgeList key={refreshKey} onView={openDetail} onAdd={() => setViewMode('form')} search={search} filterSubj={filterSubj} />
        
        <button onClick={() => setShowUpload(true)}
          style={{ position: 'absolute', right: 8, bottom: 16, width: 50, height: 50, borderRadius: '50%', border: 'none', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 16px rgba(28,176,246,.4)', zIndex: 100 }}>
          <Plus size={24} strokeWidth={3} />
        </button>
      </div>

      {showUpload && (
        <UploadSheet onClose={() => setShowUpload(false)} onRoute={(mode) => { setViewMode(mode); setShowUpload(false); }} />
      )}
    </div>
  );
}
