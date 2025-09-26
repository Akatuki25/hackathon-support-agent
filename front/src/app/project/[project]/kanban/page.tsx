'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { generatePhaseDetails, generatePlan, usePlan } from '@/libs/modelAPI/plan';
import { AssignmentSummary, PhaseKey, PlannedTask, PlanMember } from '@/types/planTypes';
import { ProjectType } from '@/types/modelTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

const sectionStyle: CSSProperties = {
  border: '1px solid var(--border-color, #d0d7de)',
  borderRadius: '8px',
  padding: '16px',
  background: 'var(--surface-color, #fff)',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)'
};

const headingStyle: CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 600,
  marginBottom: '12px'
};

const PhaseBadge = ({ label }: { label: PhaseKey }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '12px',
      backgroundColor:
        label === 'P0' ? 'rgba(59,130,246,0.1)' : label === 'P1' ? 'rgba(234,179,8,0.15)' : 'rgba(34,197,94,0.15)',
      color: label === 'P0' ? '#1d4ed8' : label === 'P1' ? '#b45309' : '#15803d',
      fontSize: '0.8rem',
      fontWeight: 500
    }}
  >
    {label}
  </span>
);

const MemberCard = ({ member }: { member: PlanMember }) => (
  <div style={{ ...sectionStyle, padding: '12px', boxShadow: 'none' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <strong>{member.member_name}</strong>
      <span style={{ fontSize: '0.85rem', color: '#475569' }}>
        Capacity: {member.capacity_per_day.toFixed(1)} d/day
      </span>
    </div>
    <div style={{ fontSize: '0.85rem', color: '#1e293b', marginTop: '4px' }}>
      Skills: {member.skills.length ? member.skills.join(', ') : '未設定'}
    </div>
  </div>
);

const TaskCard = ({
  task,
  assignee
}: {
  task: PlannedTask;
  assignee?: AssignmentSummary;
}) => (
  <div style={{ ...sectionStyle, padding: '12px', marginBottom: '12px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
      <div>
        <div style={{ fontWeight: 600 }}>{task.title}</div>
        <div style={{ fontSize: '0.85rem', color: '#475569' }}>{task.description}</div>
      </div>
      <PhaseBadge label={task.phase} />
    </div>
    <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '8px' }}>
      担当: {assignee?.member_name ?? '未割当'} / 目安: {task.estimate_d.toFixed(1)} d / 締切: {new Date(task.due_at).toLocaleDateString()}
    </div>
    <div style={{ fontSize: '0.82rem', color: '#1e293b', marginTop: '8px' }}>
      参照: {task.refs.map((ref) => ref.label).join(', ')}
    </div>
    {task.detail_generated && task.detail ? (
      <pre
        style={{
          marginTop: '12px',
          background: 'rgba(15,23,42,0.04)',
          padding: '12px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          whiteSpace: 'pre-wrap'
        }}
      >
        {task.detail}
      </pre>
    ) : (
      <div style={{ marginTop: '12px', fontSize: '0.8rem', color: '#c2410c' }}>
        詳細は未生成です。フェーズ進行で生成してください。
      </div>
    )}
    <div style={{ marginTop: '12px', fontSize: '0.85rem' }}>
      <Link href={`/project/task/${task.task_id}`} style={{ color: '#2563eb' }}>
        タスク詳細ページへ
      </Link>
    </div>
  </div>
);

const ProjectKanbanPage = () => {
  const params = useParams();
  const projectParam = params?.project;
  const projectId = Array.isArray(projectParam) ? projectParam[0] : projectParam;

  const { plan, isLoading, isError } = usePlan(projectId);
  const { data: project } = useSWR<ProjectType>(
    projectId ? `${API_URL}/project/${projectId}` : null,
    fetcher
  );

  const [actionMessage, setActionMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const assignmentByTask = useMemo(() => {
    const map = new Map<string, AssignmentSummary>();
    plan?.assignments.forEach((assignment) => {
      map.set(assignment.task_id, assignment);
    });
    return map;
  }, [plan]);

  const nextPhaseToGenerate = useMemo(() => {
    if (!plan) return undefined;
    return plan.phases.find((phase) => phase.tasks.some((task) => !task.detail_generated))?.phase;
  }, [plan]);

  const handleGeneratePlan = async () => {
    if (!projectId) return;
    setIsProcessing(true);
    setErrorMessage('');
    try {
      await generatePlan(projectId);
      setActionMessage('プランを再生成しました。');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'プラン生成に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGeneratePhaseDetails = async () => {
    if (!projectId || !nextPhaseToGenerate) return;
    setIsProcessing(true);
    setErrorMessage('');
    try {
      await generatePhaseDetails(projectId, nextPhaseToGenerate);
      setActionMessage(`${nextPhaseToGenerate} の詳細を生成しました。`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '詳細生成に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!projectId) {
    return <div>プロジェクトIDが取得できませんでした。</div>;
  }

  if (isLoading) {
    return <div>計画情報を読み込み中です...</div>;
  }

  if (isError) {
    return (
      <div>
        プラン情報の取得に失敗しました。
        <button onClick={handleGeneratePlan} style={{ marginLeft: '12px' }}>
          プラン生成をリトライ
        </button>
      </div>
    );
  }

  if (!plan) {
    return (
      <div style={{ ...sectionStyle, maxWidth: '960px', margin: '0 auto' }}>
        <h2 style={headingStyle}>プラン未生成</h2>
        <p>このプロジェクトの実行計画はまだ生成されていません。要件定義書等を整備した上で以下のボタンから生成してください。</p>
        <button onClick={handleGeneratePlan} disabled={isProcessing} style={{ marginTop: '12px' }}>
          {isProcessing ? '生成中...' : 'プランを生成する'}
        </button>
        {errorMessage && <p style={{ color: '#b91c1c', marginTop: '8px' }}>{errorMessage}</p>}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      <header style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700 }}>{project?.title ?? 'プロジェクト'}</h1>
        <div style={{ fontSize: '0.95rem', color: '#475569' }}>{project?.idea}</div>
        <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
          計画生成: {new Date(plan.generated_at).toLocaleString()} / 締切: {project?.end_date ? new Date(project.end_date).toLocaleDateString() : '未設定'}
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginTop: '8px' }}>
          <button onClick={handleGeneratePlan} disabled={isProcessing}>
            {isProcessing ? '処理中...' : 'プランを再生成'}
          </button>
          {nextPhaseToGenerate ? (
            <button onClick={handleGeneratePhaseDetails} disabled={isProcessing}>
              {isProcessing ? '詳細生成中...' : `${nextPhaseToGenerate} の詳細を生成`}
            </button>
          ) : (
            <span style={{ fontSize: '0.85rem', color: '#047857' }}>全フェーズの詳細が生成済みです。</span>
          )}
          {projectId && (
            <Link href={`/project/${projectId}/flow`} style={{ color: '#2563eb', fontSize: '0.9rem' }}>
              フローチャート表示へ →
            </Link>
          )}
        </div>
        {actionMessage && <div style={{ color: '#166534', fontSize: '0.85rem' }}>{actionMessage}</div>}
        {errorMessage && <div style={{ color: '#b91c1c', fontSize: '0.85rem' }}>{errorMessage}</div>}
      </header>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>ディレクトリ構造案</h2>
        <pre style={{ background: 'rgba(15,23,42,0.04)', padding: '12px', borderRadius: '6px', whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
          {plan.directory_tree.join('\n')}
        </pre>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>メンバー割当状況</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: '12px' }}>
          {plan.members.map((member) => (
            <MemberCard key={member.project_member_id} member={member} />
          ))}
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={headingStyle}>タイムライン</h2>
        <ul style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: 0, margin: 0, listStyle: 'none' }}>
          {plan.phases.map((phase) => (
            <li key={phase.phase} style={{ ...sectionStyle, padding: '12px', minWidth: '180px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{phase.phase}</strong>
                <PhaseBadge label={phase.phase} />
              </div>
              <div style={{ fontSize: '0.85rem', marginTop: '8px', color: '#475569' }}>
                締切: {new Date(phase.deadline).toLocaleDateString()}
              </div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px', color: '#1e293b' }}>
                タスク数: {phase.tasks.length}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {plan.phases.map((phase) => (
        <section key={phase.phase} style={sectionStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={headingStyle}>フェーズ {phase.phase}</h2>
            <div style={{ fontSize: '0.85rem', color: '#475569' }}>
              締切: {new Date(phase.deadline).toLocaleDateString()}
            </div>
          </div>
          {phase.tasks.length === 0 ? (
            <div>該当タスクはありません。</div>
          ) : (
            <div>
              {phase.tasks.map((task) => (
                <TaskCard key={task.task_id} task={task} assignee={assignmentByTask.get(task.task_id)} />
              ))}
            </div>
          )}
          {!phase.tasks.every((task) => task.detail_generated) && nextPhaseToGenerate === phase.phase && (
            <div style={{ marginTop: '12px', color: '#b45309', fontSize: '0.85rem' }}>
              このフェーズの詳細は未生成です。上部のボタンから生成してください。
            </div>
          )}
        </section>
      ))}
    </div>
  );
};

export default ProjectKanbanPage;
