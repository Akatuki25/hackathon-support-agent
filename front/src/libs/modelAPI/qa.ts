import axios from "axios";
import { QAType, QAPatch, QAResponseType } from "@/types/modelTypes";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// --- GET All QAs ---
export const listQAs = async (): Promise<QAType[]> => {
  const response = await axios.get<QAType[]>(`${API_URL}/qas`);
  return response.data;
};

// --- GET QA by ID ---
export const getQA = async (qaId: string): Promise<QAType> => {
  const response = await axios.get<QAType>(`${API_URL}/qa/${qaId}`);
  return response.data;
};

// --- POST QA ---
export const postQA = async (
  qa: Omit<QAType, "qa_id" | "created_at">,
): Promise<string> => {
  const response = await axios.post<QAResponseType>(`${API_URL}/qa`, qa);
  return response.data.qa_id;
};

// --- PUT QA ---
export const putQA = async (
  qaId: string,
  qa: Omit<QAType, "qa_id" | "created_at">,
): Promise<string> => {
  const response = await axios.put<QAResponseType>(`${API_URL}/qa/${qaId}`, qa);
  return response.data.message;
};

// --- PATCH QA ---
export const patchQA = async (
  qaId: string,
  qaPatch: QAPatch,
): Promise<string> => {
  const response = await axios.patch<{ message: string }>(
    `${API_URL}/qa/${qaId}`,
    qaPatch,
  );
  return response.data.message;
};

// --- DELETE QA ---
export const deleteQA = async (qaId: string): Promise<{ message: string }> => {
  const response = await axios.delete(`${API_URL}/qa/${qaId}`);
  return response.data;
};

// --- GET QAs by Project ID ---
export const getQAsByProjectId = async (
  projectId: string,
): Promise<QAType[]> => {
  const response = await axios.get<QAType[]>(`${API_URL}/qas`, {
    params: { project_id: projectId },
  });
  return response.data;
};
// QAのデータをすべて受けとってpatchして解答を保存する
export const saveAnswer = async (qaData: QAType[]) => {
  qaData.forEach(async (qa) => {
    if (!qa.qa_id || !qa.answer) return;
    await patchQA(qa.qa_id, { answer: qa.answer });
  });
};
