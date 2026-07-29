import { useState } from 'react';
import AdminLayout from '../components/AdminLayout';
import QuizView from '../components/QuizView';

export default function AdminQuiz() {
  return (
    <AdminLayout title="刷题管理">
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e0e0e0' }}>
        <QuizView />
      </div>
    </AdminLayout>
  );
}
