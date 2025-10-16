import axios from 'axios';
import useSWR from 'swr';
import { ProjectMemberType, ProjectMemberResponseType, ProjectMemberPatch } from '@/types/modelTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const fetcher = async (url: string) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return response.json();
};

// --- GET Project Member by ID ---
export const getProjectMember = async (projectMemberId: string): Promise<ProjectMemberType> => {
  const response = await axios.get<ProjectMemberType>(`${API_URL}/project_member/member/${projectMemberId}`);
  return response.data;
};

// --- GET Project Members by Project ID ---
export const getProjectMembersByProjectId = async (projectId: string): Promise<ProjectMemberType[]> => {
  const response = await axios.get<ProjectMemberType[]>(`${API_URL}/project_member/project/${projectId}`);
  return response.data;
};

// --- POST Project Member ---
export const postProjectMember = async (projectMember: ProjectMemberType): Promise<string> => {
  const response = await axios.post<ProjectMemberResponseType>(`${API_URL}/project_member/member/`, projectMember);
  return response.data.project_member_id;
};

// --- PUT Project Member ---
export const putProjectMember = async (projectMemberId: string, projectMember: ProjectMemberType): Promise<string> => {
  const response = await axios.put<ProjectMemberResponseType>(`${API_URL}/project_member/member/${projectMemberId}`, projectMember);
  return response.data.message;
};

// --- PATCH Project Member ---
export const patchProjectMember = async (projectMemberId: string, projectMemberPatch: ProjectMemberPatch): Promise<string> => {
  const response = await axios.patch<ProjectMemberResponseType>(`${API_URL}/project_member/member/${projectMemberId}`, projectMemberPatch);
  return response.data.message;
};

// --- DELETE Project Member ---
export const deleteProjectMember = async (projectMemberId: string): Promise<{ message: string }> => {
  const response = await axios.delete(`${API_URL}/project_member/member/${projectMemberId}`);
  return response.data;
};

// --- SWR Hooks ---

/**
 * Get project members by project ID using SWR
 * @param projectId - The project ID
 * @returns Object containing members array, loading state, and error state
 */
export const useProjectMembers = (projectId?: string) => {
  const key = projectId ? `${API_URL}/project_member/project/${projectId}` : null;
  const { data, error } = useSWR<ProjectMemberType[]>(key, fetcher);
  return {
    members: data,
    isLoading: !!key && !error && !data,
    isError: error,
  };
};