"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useDarkMode } from "@/hooks/useDarkMode";
import { postMember } from "@/libs/modelAPI/member";
import { MemberType } from "@/types/modelTypes";
import PageLoading from "@/components/PageLoading";

const MemberSettings = () => {
  const router = useRouter();
  const { darkMode } = useDarkMode();

  const [loading, setLoading] = useState(false);
  const [member, setMember] = useState<MemberType>({
    member_name: "",
    member_skill: "",
    github_name: "",
  });

  const handleChange = (field: keyof MemberType) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setMember({ ...member, [field]: e.target.value });
  };

  const fetchMember = async (member: MemberType) => {
    try {
      const memberId = await postMember(member);
      console.log("Member ID:", memberId);
      sessionStorage.setItem("memberId", memberId.toString());
      router.push("/"); // 成功したら画面遷移
    } catch (error) {
      console.error("Error fetching member:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await fetchMember(member); // ← ここで呼び出し！
  };

  if (loading) return <PageLoading/>;

  return (
    <div
      className={`flex flex-col items-center justify-center min-h-screen px-4 ${
        darkMode ? "bg-gray-900 text-white" : "bg-white text-black"
      }`}
    >
      <h1 className="text-2xl font-bold mb-6">Member Registration</h1>

      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <label className="block">
          <span className="font-semibold">Name</span>
          <input
            type="text"
            required
            value={member.member_name}
            onChange={handleChange("member_name")}
            className="w-full px-4 py-2 rounded border mt-1"
            placeholder="例: Alice"
          />
        </label>

        <label className="block">
          <span className="font-semibold">Skill</span>
          <input
            type="text"
            required
            value={member.member_skill}
            onChange={handleChange("member_skill")}
            className="w-full px-4 py-2 rounded border mt-1"
            placeholder="例: React, Python"
          />
        </label>

        <label className="block">
          <span className="font-semibold">GitHub</span>
          <input
            type="text"
            required
            value={member.github_name}
            onChange={handleChange("github_name")}
            className="w-full px-4 py-2 rounded border mt-1"
            placeholder="例: octocat"
          />
        </label>

        <button
          type="submit"
          className={`w-full py-2 rounded text-white font-semibold ${
            darkMode ? "bg-cyan-500 hover:bg-cyan-600" : "bg-purple-500 hover:bg-purple-600"
          } transition`}
        >
          Register
        </button>
      </form>
    </div>
  );
};

export default MemberSettings;
