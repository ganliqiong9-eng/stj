import { useState, useCallback } from 'react';
import { Plus, Search } from 'lucide-react';
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
        <DocUploadView onBack={() => setViewMode('list')} />
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
        <KnowledgeForm onBack={() => setViewMode('list')} />
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px 2px' }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, flex: 1 }}>知识中心</h2>
      </div>

      <div style={{
        display: 'flex', gap: 6, margin: '4px 12px 6px',
        padding: 3, background: 'var(--border)', borderRadius: 10,
      }}>
        {([
          { key: 'doc-upload' as ViewMode, label: '文档导入', icon: FileText },
          { key: 'table-upload' as ViewMode, label: '表格导入', icon: FileSpreadsheet },
          { key: 'list' as ViewMode, label: '浏览全部', icon: BookOpen },
        ]).map(btn => {
          const Icon = btn.icon;
          return (
            <button key={btn.key} onClick={() => setViewMode(btn.key)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '7px 0', border: 'none', borderRadius: 8,
                background: viewMode === btn.key ? 'var(--surface)' : 'transparent',
                color: viewMode === btn.key ? 'var(--text)' : 'var(--text-tertiary)',
                fontSize: 11, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font)', transition: 'all .2s',
                boxShadow: viewMode === btn.key ? 'var(--shadow-sm)' : 'none',
              }}>
              <Icon size={14} strokeWidth={2.5} />
              {btn.label}
            </button>
          );
        })}
      </div>

      <KnowledgeList onView={openDetail} onAdd={() => setViewMode('form')} />
    </div>
  );
}
