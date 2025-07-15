import { ProjectDocumentType } from "@/types/modelTypes";

export const postDocument = async (document: ProjectDocumentType) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const response = await fetch(`${apiUrl}/project_document`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(document),
  });

  if (!response.ok) {
    throw new Error(`API エラー: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const ID: string = data.project_id;
  return ID;
};

export const getDocument = async (projectId: string) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  const response = await fetch(`${apiUrl}/project_document/${projectId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`API エラー: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data as ProjectDocumentType;
};
