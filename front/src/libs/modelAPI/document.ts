import axios from "axios";
import {
  ProjectDocumentType,
  ProjectDocumentResponseType,
  ProjectDocumentPatch,
} from "@/types/modelTypes";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// --- GET Project Document by Project ID ---
export const getProjectDocument = async (
  projectId: string,
): Promise<ProjectDocumentType> => {
  const response = await axios.get<ProjectDocumentType>(
    `${API_URL}/project_document/${projectId}`,
  );
  return response.data;
};

// --- GET Project Document by Document ID ---
export const getProjectDocumentById = async (
  docId: string,
): Promise<ProjectDocumentType> => {
  const response = await axios.get<ProjectDocumentType>(
    `${API_URL}/project_document/id/${docId}`,
  );
  return response.data;
};

// --- POST Project Document ---
export const postProjectDocument = async (
  document: ProjectDocumentType,
): Promise<string> => {
  const response = await axios.post<ProjectDocumentResponseType>(
    `${API_URL}/project_document`,
    document,
  );
  return response.data.project_id;
};

// --- PUT Project Document by Project ID ---
export const putProjectDocument = async (
  projectId: string,
  document: ProjectDocumentType,
): Promise<string> => {
  const response = await axios.put<ProjectDocumentResponseType>(
    `${API_URL}/project_document/${projectId}`,
    document,
  );
  return response.data.message;
};

// --- PUT Project Document by Document ID ---
export const putProjectDocumentById = async (
  docId: string,
  document: ProjectDocumentType,
): Promise<string> => {
  const response = await axios.put<ProjectDocumentResponseType>(
    `${API_URL}/project_document/id/${docId}`,
    document,
  );
  return response.data.message;
};

// --- PATCH Project Document by Project ID ---
export const patchProjectDocument = async (
  projectId: string,
  documentPatch: ProjectDocumentPatch,
): Promise<string> => {
  const response = await axios.patch<ProjectDocumentResponseType>(
    `${API_URL}/project_document/${projectId}`,
    documentPatch,
  );
  return response.data.message;
};

// --- DELETE Project Document by Project ID ---
export const deleteProjectDocument = async (
  projectId: string,
): Promise<{ message: string }> => {
  const response = await axios.delete(
    `${API_URL}/project_document/${projectId}`,
  );
  return response.data;
};

// --- DELETE Project Document by Document ID ---
export const deleteProjectDocumentById = async (
  docId: string,
): Promise<{ message: string }> => {
  const response = await axios.delete(
    `${API_URL}/project_document/id/${docId}`,
  );
  return response.data;
};
