import { useState, useRef } from 'react';
import AdminLayout from '../components/AdminLayout';
import { upgradeUploadDocForRag, MAX_UPLOAD_SIZE } from '../api';
import { useNavigate } from 'react-router-dom';
import db from '../store/db';

export default function AdminUpload() {
  const nav = useNavigate();
  const [files, setFiles] = useState<{ file: File; status: 'waiting' | 'uploading' | 'done' | 'error'; msg?: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const addFiles = (fs: FileList | null) => {
    if (!fs) return;
    const newFiles = Array.from(fs).filter(f => /\.(docx|pdf|md|txt|html|xlsx|xls|csv)$/i.test(f.name)).map(f => ({ file: f, status: 'waiting' as const }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const uploadAll = async () => {
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (f.status !== 'waiting') continue;
      setFiles(prev => prev.map((p, j) => j === i ? { ...p, status: 'uploading' as const } : p));
      try {
        const r = await upgradeUploadDocForRag(f.file);
        if (r.ok && r.sections) {
          await db.addKnowledge({
            _id: r.articleId || crypto.randomUUID(),
            title: r.title || f.file.name,
            subj: 'custom',
            tags: '文档',
            source: '文件上传: ' + f.file.name,
            sections: r.sections,
            type: 'doc' as const,
            status: 'indexed' as const,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        setFiles(prev => prev.map((p, j) => j === i ? { ...p, status: r.ok ? 'done' as const : 'error' as const, msg: r.msg } : p));
      } catch {
        setFiles(prev => prev.map((p, j) => j === i ? { ...p, status: 'error' as const, msg: '上传失败' } : p));
      }
    }
  };

  const statusIcon = (s: string) => {
    if (s === 'waiting') return '⏳';
    if (s === 'uploading') return '🔄';
    if (s === 'done') return '✅';
    return '❌';
  };

  return (
    <AdminLayout title="批量上传">
      <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed #ccc', borderRadius: 12, padding: '40px 20px', textAlign: 'center', cursor: 'pointer', background: '#fafafa', marginBottom: 16 }}>
        <input ref={fileRef} type="file" multiple accept=".docx,.pdf,.md,.txt,.html,.xlsx,.xls,.csv" onChange={e => addFiles(e.target.files)} style={{ display: 'none' }} />
        <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#555', marginBottom: 4 }}>拖拽文件到此处 或 点击选择</div>
        <div style={{ fontSize: 11, color: '#999' }}>支持 .md .docx .pdf .txt .html .xlsx .csv</div>
      </div>

      {files.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e0e0e0', padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 8 }}>上传队列 ({files.length})</div>
          {files.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < files.length - 1 ? '1px solid #eee' : 'none', fontSize: 12 }}>
              <span>{statusIcon(f.status)}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{f.file.name}</span>
              <span style={{ color: f.status === 'done' ? '#58cc02' : f.status === 'error' ? '#e63946' : '#999', fontSize: 11 }}>
                {f.status === 'waiting' ? `等待中 (${(f.file.size / 1024).toFixed(0)} KB)` : f.status === 'uploading' ? '解析中...' : f.status === 'done' ? '完成' : f.msg || '失败'}
              </span>
            </div>
          ))}
          {files.some(f => f.status === 'done') && (
            <button onClick={() => nav('/admin/knowledge')} style={{ width: '100%', padding: '10px 0', marginTop: 4, border: '2px solid var(--primary)', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font)', background: '#fff', color: 'var(--primary)', marginBottom: 8 }}>
              查看知识库 →
            </button>
          )}
          <button onClick={uploadAll} disabled={files.every(f => f.status !== 'waiting')}
            style={{ width: '100%', padding: '10px 0', marginTop: 8, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: files.every(f => f.status !== 'waiting') ? 'default' : 'pointer', fontFamily: 'var(--font)', background: files.every(f => f.status !== 'waiting') ? '#e0e0e0' : '#1cb0f6', color: '#fff' }}>
            {files.every(f => f.status !== 'waiting') ? '全部完成' : '开始上传全部'}
          </button>
        </div>
      )}
    </AdminLayout>
  );
}
