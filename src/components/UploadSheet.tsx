import { useRef } from 'react';
import { FileText, Clipboard, Edit3, X } from 'lucide-react';

interface UploadSheetProps {
  onClose: () => void;
  onRoute: (view: 'doc-upload' | 'table-upload' | 'paste-text' | 'form') => void;
}

export default function UploadSheet({ onClose, onRoute }: UploadSheetProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.toLowerCase().split('.').pop();
    if (['docx', 'pdf', 'md', 'txt', 'html', 'htm', 'markdown'].includes(ext || '')) {
      onRoute('doc-upload');
    } else if (['xlsx', 'xls', 'csv'].includes(ext || '')) {
      onRoute('table-upload');
    }
    onClose();
  };

  const opt = (icon: React.ReactNode, label: string, sub: string, onClick: () => void) => (
    <button key={label} onClick={onClick}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', border: 'none', borderBottom: '2px solid var(--border)', background: 'transparent', cursor: 'pointer', fontFamily: 'var(--font)', textAlign: 'left', transition: 'background .15s', color: 'var(--text)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--border-light)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>{sub}</div>
      </div>
    </button>
  );

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 1500, background: 'rgba(0,0,0,.35)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 390, background: 'var(--surface)', borderRadius: '24px 24px 0 0', overflow: 'hidden', transform: 'translateY(0)', transition: 'transform .3s cubic-bezier(.22,1,.36,1)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 16px 10px' }}>
          <span style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>上传知识</span>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'var(--border)', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontFamily: 'var(--font)' }}>
            <X size={16} />
          </button>
        </div>
        {opt(<FileText size={18} color="var(--primary-dark)" />, '选择文件', '支持文档、表格 — 自动识别类型', () => fileRef.current?.click())}
        {opt(<Clipboard size={18} color="var(--primary-dark)" />, '粘贴文本', '快速录入知识点内容', () => { onRoute('paste-text'); onClose(); })}
        {opt(<Edit3 size={18} color="var(--primary-dark)" />, '手动录入', '自行编写知识条目', () => { onRoute('form'); onClose(); })}
        <div style={{ height: 12 }} />
        <input ref={fileRef} type="file" accept=".docx,.pdf,.md,.txt,.html,.htm,.xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
      </div>
    </div>
  );
}
