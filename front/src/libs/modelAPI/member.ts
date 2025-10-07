import axios from 'axios';
import { MemberType, MemberResponseType, MemberPatch } from '@/types/modelTypes';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// --- GET All Members ---
export const listMembers = async (): Promise<MemberType[]> => {
  const response = await axios.get<MemberType[]>(`${API_URL}/members`);
  return response.data;
};

// --- GET Member by ID ---
export const getMemberById = async (memberId: string): Promise<MemberType> => {
  const response = await axios.get<MemberType>(`${API_URL}/member/id/${memberId}`);
  return response.data;
};

// --- GET Member by GitHub Name ---
export const getMemberByGithubName = async (githubName: string): Promise<MemberType> => {
  const response = await axios.get<MemberType>(`${API_URL}/member/github/${githubName}`);
  return response.data;
};

// --- POST Member ---
export const postMember = async (member: MemberType): Promise<string> => {
  const response = await axios.post<MemberResponseType>(`${API_URL}/member`, member);
  return response.data.member_id; // Return the ID of the created member
};

// --- PUT Member by ID ---
export const putMemberById = async (memberId: string, member: MemberType): Promise<string> => {
  const response = await axios.put<MemberResponseType>(`${API_URL}/member/id/${memberId}`, member);
  return response.data.message;
};

// --- PUT Member by GitHub Name ---
export const putMemberByGithubName = async (githubName: string, member: MemberType): Promise<string> => {
  const response = await axios.put<MemberResponseType>(`${API_URL}/member/github/${githubName}`, member);
  return response.data.message;
};

// --- PATCH Member by ID ---
export const patchMemberById = async (memberId: string, memberPatch: MemberPatch): Promise<string> => {
  const response = await axios.patch<MemberResponseType>(`${API_URL}/member/id/${memberId}`, memberPatch);
  return response.data.message;
};

// --- DELETE Member by ID ---
export const deleteMemberById = async (memberId: string): Promise<{ message: string }> => {
  const response = await axios.delete(`${API_URL}/member/id/${memberId}`);
  return response.data;
};

// --- DELETE Member by GitHub Name ---
export const deleteMemberByGithubName = async (githubName: string): Promise<{ message: string }> => {
  const response = await axios.delete(`${API_URL}/member/github/${githubName}`);
  return response.data;
};
