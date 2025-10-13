// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GitHub from "next-auth/providers/github";
import type { NextAuthOptions } from "next-auth";
import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

const authOptions: NextAuthOptions = {
  providers: [
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, profile }) {
      try {
        // GitHubプロフィール情報を取得
        type GitHubProfile = { login?: string };
        const githubProfile = profile as GitHubProfile;
        const githubName = githubProfile?.login || user.name || "";
        const email = user.email || "";

        // 既存ユーザーをチェック
        try {
          await axios.get(`${API_URL}/member/github/${githubName}`);
          // ユーザーが存在する場合は何もしない
          return true;
        } catch (error) {
          // ユーザーが存在しない場合は新規作成
          if (axios.isAxiosError(error) && error.response?.status === 404) {
            await axios.post(`${API_URL}/member`, {
              member_id: "", // バックエンドでUUID生成
              member_name: githubName,
              member_skill: "", // 初期値は空
              github_name: githubName,
              email: email,
            });
            console.log(`新規メンバー作成: ${githubName}`);
            return true;
          }
          throw error;
        }
      } catch (error) {
        console.error("ログイン時のユーザー登録エラー:", error);
        // エラーが発生してもログインは許可する
        return true;
      }
    },
    async session({ session, token }) {
      // セッションにGitHubログイン名を保存
      if (session.user && token.login) {
        session.user.name = token.login as string;
      }
      return session;
    },
    async jwt({ token, profile }) {
      // JWTトークンにGitHubログイン名を保存
      if (profile) {
        type GitHubProfile = { login?: string };
        const githubProfile = profile as GitHubProfile;
        token.login = githubProfile?.login;
      }
      return token;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
