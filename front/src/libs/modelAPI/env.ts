import axios from "axios";
import { EnvType, EnvResponseType, EnvPatch } from "@/types/modelTypes";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// --- GET All Envs ---
export const listEnvs = async (): Promise<EnvType[]> => {
  const response = await axios.get<EnvType[]>(`${API_URL}/envs`);
  return response.data;
};

// --- GET Env by ID ---
export const getEnv = async (envId: string): Promise<EnvType> => {
  const response = await axios.get<EnvType>(`${API_URL}/env/${envId}`);
  return response.data;
};

// --- GET Envs by Project ID ---
export const getEnvsByProjectId = async (
  projectId: string,
): Promise<EnvType[]> => {
  const response = await axios.get<EnvType[]>(
    `${API_URL}/env/project/${projectId}`,
  );
  return response.data;
};

// --- POST Env ---
export const postEnv = async (env: EnvType): Promise<string> => {
  const response = await axios.post<EnvResponseType>(`${API_URL}/env`, env);
  return response.data.env_id;
};

// --- PUT Env ---
export const putEnv = async (envId: string, env: EnvType): Promise<string> => {
  const response = await axios.put<EnvResponseType>(
    `${API_URL}/env/${envId}`,
    env,
  );
  return response.data.message;
};

// --- PATCH Env ---
export const patchEnv = async (
  envId: string,
  envPatch: EnvPatch,
): Promise<string> => {
  const response = await axios.patch<EnvResponseType>(
    `${API_URL}/env/${envId}`,
    envPatch,
  );
  return response.data.message;
};

// --- DELETE Env ---
export const deleteEnv = async (
  envId: string,
): Promise<{ message: string }> => {
  const response = await axios.delete(`${API_URL}/env/${envId}`);
  return response.data;
};
