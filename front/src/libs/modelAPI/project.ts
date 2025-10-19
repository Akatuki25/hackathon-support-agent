import axios from 'axios';
import { ProjectType, ProjectResponseType, ProjectPatch } from '@/types/modelTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// --- GET All Projects ---
export const getAllProjects = async (): Promise<ProjectType[]> => {
  const response = await axios.get<ProjectType[]>(`${API_URL}/projectsAll`);
  return response.data;
};

// --- GET Project by ID ---
export const getProject = async (projectId: string): Promise<ProjectType> => {
  const response = await axios.get<ProjectType>(`${API_URL}/project/${projectId}`);
  return response.data;
};

// --- POST Project ---
export const postProject = async (project: ProjectType): Promise<string> => {
  const response = await axios.post<ProjectResponseType>(`${API_URL}/project`, project);
  return response.data.project_id;
};

// --- PUT Project ---
export const putProject = async (projectId: string, project: ProjectType): Promise<string> => {
  const response = await axios.put<ProjectResponseType>(`${API_URL}/project/${projectId}`, project);
  return response.data.message;
};

// --- PATCH Project ---
export const patchProject = async (projectId: string, projectPatch: ProjectPatch): Promise<string> => {
  const response = await axios.patch<ProjectResponseType>(`${API_URL}/project/${projectId}`, projectPatch);
  return response.data.message;
};

// --- DELETE Project ---
export const deleteProject = async (projectId: string): Promise<{ message: string }> => {
  const response = await axios.delete(`${API_URL}/project/${projectId}`);
  return response.data;
};

// --- GET All Projects with Phase Information ---
export const getAllProjectsWithPhase = async (): Promise<ProjectType[]> => {
  const response = await axios.get<ProjectType[]>(`${API_URL}/projectsAll`);
  return response.data;
};

// --- GET Projects by Member ID ---
export const getProjectsByMemberId = async (memberId: string): Promise<ProjectType[]> => {
  const response = await axios.get<ProjectType[]>(`${API_URL}/projects/member/${memberId}`);
  return response.data;
};
