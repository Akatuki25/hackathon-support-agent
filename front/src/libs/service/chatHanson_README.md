# ChatHanson Service - フロントエンド実装

## 概要

`chatHanson.ts`は、ハッカソン開発支援チャットAPI (`/api/chatHanson`) を呼び出すためのフロントエンドサービスです。

## 利用可能な関数

### 1. `chatWithHanson` - メインのチャット関数

プロジェクト情報を基にAIが質問に回答します。

```typescript
import { chatWithHanson } from '@/libs/service/chatHanson';

const response = await chatWithHanson(
  'project-uuid',
  '認証機能の実装方法は？',
  '',      // chat_history (オプション)
  false    // return_plan (オプション)
);

console.log(response.answer);  // AI生成の回答
```

**パラメータ:**
- `projectId: string` - プロジェクトID (必須)
- `userQuestion: string` - ユーザーからの質問 (必須)
- `chatHistory: string` - チャット履歴 (オプション、デフォルト: '')
- `returnPlan: boolean` - 計画も返すかどうか (オプション、デフォルト: false)

**戻り値:**
```typescript
{
  answer: string;    // AI生成の回答
  plan?: string;     // 回答計画 (return_plan=trueの場合のみ)
}
```

---

### 2. `getPlanOnly` - 計画のみを取得

回答計画だけを取得したい場合に使用します。

```typescript
import { getPlanOnly } from '@/libs/service/chatHanson';

const response = await getPlanOnly(
  'project-uuid',
  '認証機能の実装方法は？',
  ''  // chat_history (オプション)
);

console.log(response.plan);  // 回答計画
```

**パラメータ:**
- `projectId: string` - プロジェクトID (必須)
- `userQuestion: string` - ユーザーからの質問 (必須)
- `chatHistory: string` - チャット履歴 (オプション、デフォルト: '')

**戻り値:**
```typescript
{
  plan: string;  // 回答計画
}
```

---

### 3. `sendMessage` - シンプルな質問送信

履歴なしでシンプルに質問する場合に使用します。

```typescript
import { sendMessage } from '@/libs/service/chatHanson';

const answer = await sendMessage(
  'project-uuid',
  '認証機能の実装方法は？'
);

console.log(answer);  // AI生成の回答（文字列）
```

**パラメータ:**
- `projectId: string` - プロジェクトID (必須)
- `question: string` - ユーザーからの質問 (必須)

**戻り値:**
- `string` - AI生成の回答

---

### 4. `getDetailedResponse` - 詳細な回答を取得（計画付き）

計画と回答の両方を取得したい場合に使用します。

```typescript
import { getDetailedResponse } from '@/libs/service/chatHanson';

const response = await getDetailedResponse(
  'project-uuid',
  '認証機能の実装方法は？',
  'Previous chat...'  // chat_history (オプション)
);

console.log(response.answer);  // AI生成の回答
console.log(response.plan);    // 回答計画
```

**パラメータ:**
- `projectId: string` - プロジェクトID (必須)
- `question: string` - ユーザーからの質問 (必須)
- `chatHistory: string` - チャット履歴 (オプション、デフォルト: '')

**戻り値:**
```typescript
{
  answer: string;  // AI生成の回答
  plan: string;    // 回答計画
}
```

---

## React コンポーネントでの使用例

### 基本的なチャットコンポーネント

```tsx
'use client';

import { useState } from 'react';
import { sendMessage } from '@/libs/service/chatHanson';

export default function ChatComponent({ projectId }: { projectId: string }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await sendMessage(projectId, question);
      setAnswer(response);
    } catch (error) {
      console.error('Error:', error);
      setAnswer('エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="質問を入力してください"
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? '送信中...' : '送信'}
        </button>
      </form>

      {answer && (
        <div>
          <h3>回答:</h3>
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
}
```

---

### チャット履歴を保持するコンポーネント

```tsx
'use client';

import { useState } from 'react';
import { chatWithHanson } from '@/libs/service/chatHanson';

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

export default function ChatHistoryComponent({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);

  const buildChatHistory = () => {
    return messages
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    const userMessage: Message = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const chatHistory = buildChatHistory();
      const response = await chatWithHanson(projectId, question, chatHistory, false);

      const assistantMessage: Message = { role: 'assistant', content: response.answer };
      setMessages((prev) => [...prev, assistantMessage]);
      setQuestion('');
    } catch (error) {
      console.error('Error:', error);
      const errorMessage: Message = {
        role: 'assistant',
        content: 'エラーが発生しました。もう一度お試しください。'
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div>
        {messages.map((msg, index) => (
          <div key={index} className={msg.role === 'user' ? 'text-right' : 'text-left'}>
            <strong>{msg.role === 'user' ? 'あなた' : 'AI'}:</strong>
            <p>{msg.content}</p>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="質問を入力してください"
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? '送信中...' : '送信'}
        </button>
      </form>
    </div>
  );
}
```

---

### 計画も表示するコンポーネント

```tsx
'use client';

import { useState } from 'react';
import { getDetailedResponse } from '@/libs/service/chatHanson';

export default function DetailedChatComponent({ projectId }: { projectId: string }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [plan, setPlan] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await getDetailedResponse(projectId, question);
      setAnswer(response.answer);
      setPlan(response.plan || '');
    } catch (error) {
      console.error('Error:', error);
      setAnswer('エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="質問を入力してください"
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          {loading ? '送信中...' : '送信'}
        </button>
      </form>

      {plan && (
        <div>
          <h3>回答計画:</h3>
          <pre>{plan}</pre>
        </div>
      )}

      {answer && (
        <div>
          <h3>回答:</h3>
          <p>{answer}</p>
        </div>
      )}
    </div>
  );
}
```

---

## SWR を使用したデータフェッチング例

```tsx
'use client';

import useSWR from 'swr';
import { sendMessage } from '@/libs/service/chatHanson';

const fetcher = (args: [string, string]) => sendMessage(...args);

export default function SWRChatComponent({
  projectId,
  question
}: {
  projectId: string;
  question: string;
}) {
  const { data, error, isLoading } = useSWR(
    question ? [projectId, question] : null,
    fetcher
  );

  if (isLoading) return <div>読み込み中...</div>;
  if (error) return <div>エラーが発生しました。</div>;
  if (!data) return <div>質問を入力してください。</div>;

  return (
    <div>
      <h3>回答:</h3>
      <p>{data}</p>
    </div>
  );
}
```

---

## エラーハンドリング

```typescript
import { chatWithHanson } from '@/libs/service/chatHanson';
import { AxiosError } from 'axios';

try {
  const response = await chatWithHanson(projectId, question);
  console.log(response.answer);
} catch (error) {
  if (error instanceof AxiosError) {
    switch (error.response?.status) {
      case 400:
        console.error('無効なproject_idフォーマット');
        break;
      case 404:
        console.error('プロジェクトが見つかりません');
        break;
      case 500:
        console.error('サーバーエラー');
        break;
      default:
        console.error('予期しないエラー', error);
    }
  } else {
    console.error('ネットワークエラー', error);
  }
}
```

---

## 環境変数

`.env.local` に以下を設定してください:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

本番環境では適切なAPIのURLに変更してください。

---

## 型定義

すべての型は `@/types/modelTypes.ts` で定義されています:

- `ChatHansonRequest` - リクエストの型
- `ChatHansonResponse` - レスポンスの型
- `ChatHansonPlanResponse` - 計画のみのレスポンスの型

---

## 関連ファイル

- サービス実装: `front/src/libs/service/chatHanson.ts`
- 型定義: `front/src/types/modelTypes.ts`
- バックエンドAPI: `back/routers/chatHanson.py`
- バックエンドサービス: `back/services/chat_hanson_service.py`
