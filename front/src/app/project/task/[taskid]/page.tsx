'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useTask, patchTask } from '@/libs/modelAPI/task';
import { TaskStatusEnum } from '@/types/modelTypes';

const containerStyle: CSSProperties = {
  maxWidth: '820px',
  margin: '0 auto',
  padding: '24px',
  display: 'flex',
  flexDirection: 'column',
  gap: '16px',
};

const TaskDetailPage = () => {
  const params = useParams();
  const taskParam = params?.taskid;
  const taskId = Array.isArray(taskParam) ? taskParam[0] : taskParam;
  const { task, isLoading, isError } = useTask(taskId);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState<TaskStatusEnum>('TODO');

  useEffect(() => {
    if (task?.status) {
      setStatus(task.status);
    }
  }, [task?.status]);

  if (!taskId) {
    return <div style={containerStyle}>タスクIDが取得できませんでした。</div>;
  }

  if (isLoading) {
    return <div style={containerStyle}>タスク詳細を読み込み中です...</div>;
  }

  if (isError || !task) {
    return (
      <div style={containerStyle}>
        タスクの取得に失敗しました。
        <Link href="/project" style={{ color: '#2563eb', marginTop: '12px' }}>
          プロジェクト一覧へ戻る
        </Link>
      </div>
    );
  }

  const references = (task.refs as { label: string; pointer: string; note?: string | null }[] | undefined) ?? [];
  const dependencies = (task.dependencies as string[] | undefined) ?? [];

  const handleStatusUpdate = async () => {
    try {
      await patchTask(taskId, { status });
      setMessage('ステータスを更新しました。');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ステータス更新に失敗しました');
      setMessage('');
    }
  };

  return (
    <div style={containerStyle}>
      <Link href={`/project/${task.project_id}/kanban`} style={{ color: '#2563eb' }}>
        ← プロジェクト詳細へ戻る
      </Link>
      <header>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>{task.title}</h1>
        <div style={{ fontSize: '0.9rem', color: '#475569' }}>{task.description}</div>
        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
          〆切: {task.due_at ? new Date(task.due_at).toLocaleString() : '未設定'} / フェーズ: {task.phase ?? 'P0'}
        </div>
      </header>

      <section style={{ border: '1px solid #d0d7de', borderRadius: '8px', padding: '16px' }}>
        <h2 style={{ fontWeight: 600, marginBottom: '8px' }}>詳細</h2>
        {task.detail ? (
          <pre style={{ background: 'rgba(15,23,42,0.04)', padding: '12px', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
            {task.detail}
          </pre>
        ) : (
          <div style={{ color: '#b45309' }}>詳細はまだ生成されていません。フェーズ進行後に生成してください。</div>
        )}
      </section>

      <section style={{ border: '1px solid #d0d7de', borderRadius: '8px', padding: '16px' }}>
        <h2 style={{ fontWeight: 600, marginBottom: '8px' }}>参照</h2>
        {references.length ? (
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.9rem' }}>
            {references.map((ref, index) => (
              <li key={`${ref.pointer}-${index}`}>
                <strong>{ref.label}</strong>: {ref.pointer} {ref.note ? `(${ref.note})` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <div>関連する参照情報はありません。</div>
        )}
      </section>

      <section style={{ border: '1px solid #d0d7de', borderRadius: '8px', padding: '16px' }}>
        <h2 style={{ fontWeight: 600, marginBottom: '8px' }}>依存関係</h2>
        {dependencies.length ? (
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.9rem' }}>
            {dependencies.map((dep) => (
              <li key={dep}>{dep}</li>
            ))}
          </ul>
        ) : (
          <div>依存するタスクはありません。</div>
        )}
      </section>

      <section style={{ border: '1px solid #d0d7de', borderRadius: '8px', padding: '16px' }}>
        <h2 style={{ fontWeight: 600, marginBottom: '8px' }}>ステータス更新</h2>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select value={status} onChange={(event) => setStatus(event.target.value as TaskStatusEnum)}>
            <option value="TODO">TODO</option>
            <option value="DOING">DOING</option>
            <option value="DONE">DONE</option>
          </select>
          <button onClick={handleStatusUpdate}>更新</button>
        </div>
        {message && <div style={{ color: '#166534', marginTop: '8px' }}>{message}</div>}
        {error && <div style={{ color: '#b91c1c', marginTop: '8px' }}>{error}</div>}
      </section>
    </div>
  );
};

export default TaskDetailPage;
