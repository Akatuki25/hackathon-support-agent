import useSWR from 'swr';
import { getProjectMembersByProjectId } from '@/libs/modelAPI/project_member';
import { ProjectMemberType } from '@/types/modelTypes';

export function useProjectMembers(projectId?: string) {
  const { data, error, isLoading, mutate } = useSWR<ProjectMemberType[]>(
    projectId ? `/project_member/project/${projectId}` : null,
    () => getProjectMembersByProjectId(projectId!),
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    members: data,
    isLoading,
    isError: error,
    mutate,
  };
}
