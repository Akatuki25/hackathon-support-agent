"use client";
import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Session/Header';
import { getMemberByGithubName, postMember } from '@/libs/modelAPI/member';
import { getProjectMembersByProjectId, postProjectMember } from '@/libs/modelAPI/project_member';
import { ProjectMemberType, MemberType } from '@/types/modelTypes';
import { UserPlus, Check, AlertCircle } from 'lucide-react';
import { useDarkMode } from '@/hooks/useDarkMode';

export default function MemberPage({ params }: { params: Promise<{ ProjectId: string }> }) {
  const { ProjectId } = use(params);
  const router = useRouter();
  const { darkMode } = useDarkMode();
  const [githubUsername, setGithubUsername] = useState('');
  const [memberName, setMemberName] = useState('');
  const [memberSkill, setMemberSkill] = useState('');
  const [projectMembers, setProjectMembers] = useState<ProjectMemberType[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjectMembers = async () => {
      try {
        const members = await getProjectMembersByProjectId(ProjectId);
        setProjectMembers(members);
      } catch (err: any) {
        // 404エラー(メンバーがまだいない場合)は正常な状態として扱う
        if (err.response?.status === 404) {
          setProjectMembers([]);
        } else {
          console.error('Failed to fetch project members:', err);
        }
      }
    };

    fetchProjectMembers();
  }, [ProjectId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let memberId: string;
      try {
        const existingMember = await getMemberByGithubName(githubUsername);
        memberId = existingMember.member_name;
      } catch {
        const newMember: MemberType = {
          member_name: memberName,
          member_skill: memberSkill,
          github_name: githubUsername,
        };
        memberId = await postMember(newMember);
      }

      const projectMember: ProjectMemberType = {
        project_id: ProjectId,
        member_id: memberId,
        member_name: memberName,
      };

      await postProjectMember(projectMember);

      setSuccess(`${memberName} added to project`);
      setGithubUsername('');
      setMemberName('');
      setMemberSkill('');

      const updatedMembers = await getProjectMembersByProjectId(ProjectId);
      setProjectMembers(updatedMembers);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add member');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900' : 'bg-gradient-to-br from-gray-50 via-purple-50 to-gray-50'}`}>
      <Header />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent mb-2">
              Project Members
            </h1>
            <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Add members by GitHub username</p>
          </div>

          <div className={`backdrop-blur-xl rounded-2xl border p-6 mb-8 ${darkMode ? 'bg-gray-800/50 border-purple-500/30' : 'bg-white/80 border-purple-200'}`}>
            <h2 className={`text-xl font-bold mb-4 flex items-center gap-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              <UserPlus className="text-purple-400" size={24} />
              Add New Member
            </h2>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  GitHub Username *
                </label>
                <input
                  type="text"
                  value={githubUsername}
                  onChange={(e) => setGithubUsername(e.target.value)}
                  required
                  placeholder="e.g. octocat"
                  className={`w-full px-4 py-2 border rounded-lg focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/20 ${darkMode ? 'bg-gray-900/50 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Member Name *
                </label>
                <input
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  required
                  placeholder="e.g. John Doe"
                  className={`w-full px-4 py-2 border rounded-lg focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/20 ${darkMode ? 'bg-gray-900/50 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
              </div>

              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  Skills *
                </label>
                <input
                  type="text"
                  value={memberSkill}
                  onChange={(e) => setMemberSkill(e.target.value)}
                  required
                  placeholder="e.g. React, TypeScript, Python"
                  className={`w-full px-4 py-2 border rounded-lg focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-400/20 ${darkMode ? 'bg-gray-900/50 border-gray-600 text-white placeholder-gray-500' : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400'}`}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                  <AlertCircle size={20} />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg text-green-400">
                  <Check size={20} />
                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-medium rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus size={20} />
                    Add Member
                  </>
                )}
              </button>
            </form>
          </div>

          <div className={`backdrop-blur-xl rounded-2xl border p-6 ${darkMode ? 'bg-gray-800/50 border-purple-500/30' : 'bg-white/80 border-purple-200'}`}>
            <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Current Members ({projectMembers.length})
            </h2>

            {projectMembers.length === 0 ? (
              <p className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                No members added yet
              </p>
            ) : (
              <div className="space-y-3">
                {projectMembers.map((member) => (
                  <div
                    key={member.project_member_id}
                    className={`flex items-center justify-between p-4 rounded-lg border transition-all ${darkMode ? 'bg-gray-900/50 border-gray-700 hover:border-purple-500/50' : 'bg-white border-gray-200 hover:border-purple-400'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-bold">
                        {member.member_name.charAt(0)}
                      </div>
                      <div>
                        <p className={`font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>{member.member_name}</p>

                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 flex gap-4">
            <button
              onClick={() => router.back()}
              className={`px-6 py-3 rounded-lg transition-all ${darkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-900'}`}
            >
              Back
            </button>
            <button
              onClick={() => router.push(`/hackSetUp/${ProjectId}/taskDivision`)}
              className="px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white rounded-lg transition-all"
            >
              Next: Task Division
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
