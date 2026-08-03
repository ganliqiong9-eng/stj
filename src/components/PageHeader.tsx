import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}

export default function PageHeader({ title, onBack, right }: Props) {
  const nav = useNavigate();
  return (
    <div className="page-header">
      <button className="back-btn" onClick={onBack || (() => nav(-1))}>‹</button>
      <h2>{title}</h2>
      {right}
    </div>
  );
}
