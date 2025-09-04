import { ProjectType } from "@/types/modelTypes";
import { UUID } from "crypto";

export const postProject = async (project: ProjectType) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  console.log(project);
  const response = await fetch(`${apiUrl}/project`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(project),
  });
  if (!response.ok) {
    throw new Error(`API エラー: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  const ID: UUID = data.project_id;
  return ID;
};

export const getProject = async (project_id: string) => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const response = await fetch(`${apiUrl}/project/${project_id}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`API エラー: ${response.status} ${response.statusText}`);
  }
  const data: ProjectType = await response.json();
  return data;
};

export const getAllProjects = async () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  const response = await fetch(`${apiUrl}/projectsAll`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`API エラー: ${response.status} ${response.statusText}`);
  }
  const data: ProjectType[] = await response.json();
  return data;
};
