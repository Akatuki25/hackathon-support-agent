'use client';

import 'reactflow/dist/style.css';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  Connection,
  Edge,
  Node,
  OnConnect,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import { mutate as mutateCache } from 'swr';
import { usePlan, planCacheKey } from '@/libs/modelAPI/plan';
import { useTasksByProjectId, postTask, patchTask, deleteTask } from '@/libs/modelAPI/task';
import { postTaskAssignment } from '@/libs/modelAPI/task_assignment';
import { AssignmentSummary, PhaseKey } from '@/types/planTypes';
import { TaskType, TaskStatusEnum } from '@/types/modelTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const phases: PhaseKey[] = ['P0', 'P1', 'P2'];
const phaseColors: Record<PhaseKey, string> = {
  P0: '#2563eb',
  P1: '#f59e0b',
  P2: '#16a34a',
};

const phaseIndex = (phase?: string) => {
  const idx = phases.indexOf((phase as PhaseKey) ?? 'P0');
  return idx === -1 ? 0 : idx;
};

const buildNodes = (
  tasks: TaskType[] | undefined,
  assignments: Map<string, AssignmentSummary>
): Node[] => {
  if (!tasks) return [];
  const phaseOffsets: Record<PhaseKey, number> = { P0: 0, P1: 0, P2: 0 };
  return tasks.map((task) => {
    const currentPhase = (task.phase as PhaseKey) ?? 'P0';
    const column = phaseIndex(currentPhase);
    const row = phaseOffsets[currentPhase]++;
    const assignee = assignments.get(task.task_id ?? '')?.member_name ?? '未割当';
    const detailState = task.detail_generated ? 'Detail Ready' : 'No Detail';

    return {
      id: task.task_id ?? crypto.randomUUID(),
      data: {
        label: (
          <div style={{ fontSize: '0.8rem' }}>
            <div style={{ fontWeight: 600 }}>{task.title}</div>
            <div>{currentPhase}</div>
            <div style={{ color: '#475569' }}>担当: {assignee}</div>
            <div style={{ color: '#475569' }}>状態: {task.status ?? 'TODO'}</div>
            <div style={{ color: '#0f172a' }}>{detailState}</div>
          </div>
        ),
      },
      position: {
        x: column * 320,
        y: row * 140,
      },
      style: {
        border: `2px solid ${phaseColors[currentPhase]}`,
        borderRadius: 8,
        padding: 12,
        background: '#fff',
        width: 240,
      },
      draggable: false,
    } satisfies Node;
  });
};

const buildEdges = (tasks: TaskType[] | undefined): Edge[] => {
  if (!tasks) return [];
  const edgeMap = new Map<string, Edge>();
  tasks.forEach((task) => {
    const dependencies = (task.dependencies as string[]) ?? [];
    const taskId = task.task_id ?? '';
    dependencies.forEach((dep) => {
      const edgeId = `${dep}-${taskId}`;
      if (!edgeMap.has(edgeId)) {
        edgeMap.set(edgeId, {
          id: edgeId,
          source: dep,
          target: taskId,
          animated: false,
          type: 'smoothstep',
          style: { stroke: '#94a3b8', strokeWidth: 2 },
        });
      }
    });
  });
  return Array.from(edgeMap.values());
};

const defaultNewTask: Pick<TaskType, 'title' | 'description' | 'phase' | 'estimate_d' | 'category'> & {
  member?: string;
} = {
  title: '',
  description: '',
  phase: 'P1',
  estimate_d: 1.0,
  category: 'implementation',
};

const ProjectFlowPage = () => {
  const params = useParams();
  const projectParam = params?.project;
  const projectId = Array.isArray(projectParam) ? projectParam[0] : projectParam;

  const { plan, isLoading: planLoading } = usePlan(projectId);
  const { tasks, isLoading: tasksLoading, isError: tasksError } = useTasksByProjectId(projectId);

  const assignments = useMemo(() => {
    const map = new Map<string, AssignmentSummary>();
    plan?.assignments.forEach((assignment) => map.set(assignment.task_id, assignment));
    return map;
  }, [plan]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(buildNodes(tasks, assignments));
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(buildEdges(tasks));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<TaskType | null>(null);
  const [newTask, setNewTask] = useState(defaultNewTask);
  const [taskDraft, setTaskDraft] = useState<TaskType | null>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    setNodes(buildNodes(tasks, assignments));
    setEdges(buildEdges(tasks));
  }, [tasks, assignments, setNodes, setEdges]);

  useEffect(() => {
    if (!selectedTaskId) {
      setSelectedTask(null);
      setTaskDraft(null);
      return;
    }
    const current = tasks?.find((task) => task.task_id === selectedTaskId) ?? null;
    setSelectedTask(current);
    setTaskDraft(current ? { ...current } : null);
  }, [selectedTaskId, tasks]);

  const refreshData = useCallback(async () => {
    if (!projectId) return;
    await Promise.all([
      mutateCache(`${API_URL}/task/project/${projectId}`),
      mutateCache(planCacheKey(projectId)),
    ]);
  }, [projectId]);

  const onConnect = useCallback<OnConnect>(
    async (connection: Connection) => {
      if (!projectId || !tasks) return;
      if (!connection.source || !connection.target) return;
      const targetTask = tasks.find((task) => task.task_id === connection.target);
      if (!targetTask) return;

      try {
        const existingDeps = new Set((targetTask.dependencies as string[]) ?? []);
        if (!existingDeps.has(connection.source)) {
          const updatedDeps = Array.from(existingDeps.add(connection.source));
          await patchTask(connection.target, {
            dependencies: updatedDeps,
            depends_on_task_id: updatedDeps[0],
          });
          setActionMessage('依存関係を追加しました。');
          await refreshData();
        }
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '依存関係の追加に失敗しました');
      }
      setEdges((eds) => addEdge({ ...connection, type: 'smoothstep' }, eds));
    },
    [projectId, tasks, refreshData, setEdges]
  );

  const onEdgesDelete = useCallback(
    async (deleted: Edge[]) => {
      if (!projectId || !tasks) return;
      try {
        for (const edge of deleted) {
          const targetTask = tasks.find((task) => task.task_id === edge.target);
          if (!targetTask) continue;
          const currentDeps = new Set((targetTask.dependencies as string[]) ?? []);
          if (currentDeps.delete(edge.source)) {
            const updatedDeps = Array.from(currentDeps);
            await patchTask(edge.target, {
              dependencies: updatedDeps,
              depends_on_task_id: updatedDeps[0] ?? null,
            });
          }
        }
        await refreshData();
        setActionMessage('依存関係を更新しました。');
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '依存関係の更新に失敗しました');
      }
    },
    [projectId, tasks, refreshData]
  );

  const handleCreateTask = async () => {
    if (!projectId || !newTask.title.trim()) return;
    setIsProcessing(true);
    setErrorMessage('');
    try {
      const payload: TaskType = {
        project_id: projectId,
        title: newTask.title,
        description: newTask.description,
        phase: newTask.phase,
        estimate_d: newTask.estimate_d,
        category: newTask.category ?? 'implementation',
        status: 'TODO',
        priority: 'MEDIUM',
        due_at:
          plan?.phases.find((phase) => phase.phase === newTask.phase)?.deadline ??
          new Date().toISOString(),
        detail_generated: false,
      };
      const taskId = await postTask(payload);
      if (newTask.member) {
        await postTaskAssignment({
          task_id: taskId,
          project_member_id: newTask.member,
        });
      }
      setActionMessage('タスクを追加しました。');
      setNewTask(defaultNewTask);
      await refreshData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'タスク追加に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateTask = async () => {
    if (!projectId || !taskDraft) return;
    setIsProcessing(true);
    setErrorMessage('');
    try {
      await patchTask(taskDraft.task_id!, {
        status: taskDraft.status,
        due_at: taskDraft.due_at,
        phase: taskDraft.phase,
        detail_generated: taskDraft.detail_generated,
      });
      setActionMessage('タスクを更新しました。');
      await refreshData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'タスク更新に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!projectId || !selectedTask) return;
    setIsProcessing(true);
    setErrorMessage('');
    try {
      await deleteTask(selectedTask.task_id!);
      setSelectedTaskId(null);
      setActionMessage('タスクを削除しました。');
      await refreshData();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'タスク削除に失敗しました');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!projectId) {
    return <div>プロジェクトIDが取得できませんでした。</div>;
  }

  if (planLoading || tasksLoading) {
    return <div>データを読み込み中です...</div>;
  }

  if (tasksError) {
    return <div>タスク情報の取得に失敗しました。プランを生成済みか確認してください。</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', padding: '16px', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gridColumn: '1 / span 2' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700 }}>プロジェクトフロー</h1>
        {projectId && (
          <Link href={`/project/${projectId}/kanban`} style={{ color: '#2563eb', fontSize: '0.9rem' }}>
            ← カンバンに戻る
          </Link>
        )}
      </div>
      <div style={{ height: '80vh', border: '1px solid #d0d7de', borderRadius: '8px', overflow: 'hidden' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgesDelete={onEdgesDelete}
          onNodeClick={(_, node) => setSelectedTaskId(node.id)}
          fitView
        >
          <MiniMap pannable zoomable nodeStrokeColor="#0f172a" nodeColor="#e2e8f0" />
          <Controls />
          <Background gap={24} color="#e2e8f0" />
        </ReactFlow>
      </div>

      <aside style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '80vh', overflowY: 'auto' }}>
        <section style={{ border: '1px solid #d0d7de', borderRadius: '8px', padding: '16px' }}>
          <h2 style={{ fontWeight: 600, marginBottom: '12px' }}>新規タスク作成</h2>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>タイトル</label>
          <input
            value={newTask.title}
            onChange={(event) => setNewTask((prev) => ({ ...prev, title: event.target.value }))}
            style={{ width: '100%', marginBottom: '8px' }}
          />
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>概要</label>
          <textarea
            value={newTask.description}
            onChange={(event) => setNewTask((prev) => ({ ...prev, description: event.target.value }))}
            rows={3}
            style={{ width: '100%', marginBottom: '8px' }}
          />
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>フェーズ</label>
          <select
            value={newTask.phase}
            onChange={(event) => setNewTask((prev) => ({ ...prev, phase: event.target.value as PhaseKey }))}
            style={{ width: '100%', marginBottom: '8px' }}
          >
            {phases.map((phase) => (
              <option key={phase} value={phase}>
                {phase}
              </option>
            ))}
          </select>
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>見積り (d)</label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            max="1.5"
            value={newTask.estimate_d}
            onChange={(event) => setNewTask((prev) => ({ ...prev, estimate_d: Number(event.target.value) }))}
            style={{ width: '100%', marginBottom: '8px' }}
          />
          <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>担当メンバー</label>
          <select
            value={newTask.member ?? ''}
            onChange={(event) => setNewTask((prev) => ({ ...prev, member: event.target.value || undefined }))}
            style={{ width: '100%', marginBottom: '12px' }}
          >
            <option value="">未割当</option>
            {plan?.members.map((member) => (
              <option key={member.project_member_id} value={member.project_member_id}>
                {member.member_name}
              </option>
            ))}
          </select>
          <button onClick={handleCreateTask} disabled={isProcessing || !newTask.title.trim()} style={{ width: '100%' }}>
            {isProcessing ? '作成中...' : 'タスクを作成'}
          </button>
        </section>

        <section style={{ border: '1px solid #d0d7de', borderRadius: '8px', padding: '16px' }}>
          <h2 style={{ fontWeight: 600, marginBottom: '12px' }}>タスク詳細</h2>
          {taskDraft ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div style={{ fontWeight: 600 }}>{taskDraft.title}</div>
                <div style={{ fontSize: '0.85rem', color: '#475569' }}>{taskDraft.description}</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>ステータス</label>
                <select
                  value={taskDraft.status ?? 'TODO'}
                  onChange={(event) =>
                    setTaskDraft((prev) =>
                      prev ? { ...prev, status: event.target.value as TaskStatusEnum } : prev
                    )
                  }
                  style={{ width: '100%' }}
                >
                  <option value="TODO">TODO</option>
                  <option value="DOING">DOING</option>
                  <option value="DONE">DONE</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>締切</label>
                <input
                  type="date"
                  value={taskDraft.due_at ? taskDraft.due_at.substring(0, 10) : ''}
                  onChange={(event) =>
                    setTaskDraft((prev) =>
                      prev ? { ...prev, due_at: new Date(event.target.value).toISOString() } : prev
                    )
                  }
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', marginBottom: '4px' }}>フェーズ</label>
                <select
                  value={taskDraft.phase ?? 'P0'}
                  onChange={(event) =>
                    setTaskDraft((prev) =>
                      prev ? { ...prev, phase: event.target.value as PhaseKey } : prev
                    )
                  }
                  style={{ width: '100%' }}
                >
                  {phases.map((phase) => (
                    <option key={phase} value={phase}>
                      {phase}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={handleUpdateTask} disabled={isProcessing}>
                {isProcessing ? '更新中...' : '変更を保存'}
              </button>
              <button onClick={handleDeleteTask} disabled={isProcessing} style={{ color: '#b91c1c' }}>
                {isProcessing ? '削除中...' : 'タスクを削除'}
              </button>
              <div>
                <div style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                  参照: {(taskDraft.refs as { label: string }[] | undefined)?.map((ref) => ref.label).join(', ') ?? 'N/A'}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                  依存: {((taskDraft.dependencies as string[]) ?? []).length}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#1e293b' }}>
                  詳細生成: {taskDraft.detail_generated ? '済' : '未'}
                </div>
              </div>
            </div>
          ) : (
            <div>グラフ上のタスクを選択してください。</div>
          )}
        </section>

        {actionMessage && <div style={{ color: '#166534' }}>{actionMessage}</div>}
        {errorMessage && <div style={{ color: '#b91c1c' }}>{errorMessage}</div>}
      </aside>
    </div>
  );
};

export default ProjectFlowPage;
