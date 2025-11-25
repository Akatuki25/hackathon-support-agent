import axios from 'axios';
import { ProjectMemberType, ProjectMemberResponseType, ProjectMemberPatch } from '@/types/modelTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

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

// --- GET Project Members by Member ID (メンバーが参加しているプロジェクト一覧) ---
export const getProjectMembersByMemberId = async (memberId: string): Promise<ProjectMemberType[]> => {
  const response = await axios.get<ProjectMemberType[]>(`${API_URL}/project_member/by_member/${memberId}`);
  return response.data;
};