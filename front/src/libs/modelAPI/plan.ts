import useSWR, { mutate } from 'swr';
import { PlanResult, PhasePlan, PhaseKey } from '@/types/planTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const planKey = (projectId: string) => `${API_URL}/plan/${projectId}`;
export const planCacheKey = (projectId: string) => planKey(projectId);

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

export const usePlan = (projectId?: string) => {
  const { data, error, isValidating, mutate: localMutate } = useSWR<PlanResult>(
    projectId ? planKey(projectId) : null,
    fetcher
  );
  return {
    plan: data,
    isLoading: !error && !data,
    isValidating,
    isError: error,
    mutatePlan: localMutate,
  };
};

export const generatePlan = async (projectId: string): Promise<PlanResult> => {
  const response = await fetch(`${API_URL}/plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_id: projectId }),
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const result: PlanResult = await response.json();
  await mutate(planKey(projectId), result, false);
  return result;
};

export const generatePhaseDetails = async (
  projectId: string,
  phase: PhaseKey
): Promise<PhasePlan> => {
  const response = await fetch(`${API_URL}/plan/${projectId}/phase/${phase}/details`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  const phasePlan: PhasePlan = await response.json();
  await mutate(planKey(projectId));
  return phasePlan;
};
