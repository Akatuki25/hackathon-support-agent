# Upstash Redis セットアップガイド

Railwayで$5/月に収めるため、Redisは**Upstash**の無料枠を使用します。

## Upstash Redisの無料枠

- **コマンド数**: 10,000/日
- **ストレージ**: 256MB
- **同時接続**: 1,000
- **レイテンシ**: グローバルで低レイテンシ
- **料金**: $0（完全無料）

ハンズオン生成タスクは頻度が低いため、無料枠で十分です。

## セットアップ手順

### 1. Upstashアカウント作成

1. [Upstash Console](https://console.upstash.com/) にアクセス
2. GitHubアカウントでサインアップ（推奨）

### 2. Redis データベース作成

1. 「Create Database」をクリック
2. 設定:
   - **Name**: `hackathon-support-agent-redis`
   - **Type**: Regional（無料）
   - **Region**: `ap-northeast-1` (Tokyo) - Railwayと同じリージョン推奨
   - **Eviction**: `allkeys-lru`（メモリ不足時に古いキーを削除）
3. 「Create」をクリック

### 3. 接続情報の取得

作成したデータベースの詳細ページで：

1. **REST API** タブではなく **Details** タブを開く
2. **Endpoint** をコピー:
   ```
   redis://default:YOUR_PASSWORD@useast1-xxx.upstash.io:6379
   ```

### 4. Railwayに環境変数を設定

Railway ダッシュボードで：

1. プロジェクトを開く
2. サービス（backend）を選択
3. **Variables** タブ
4. 新しい変数を追加:
   ```
   REDIS_URL=redis://default:YOUR_PASSWORD@useast1-xxx.upstash.io:6379
   ```

### 5. その他の環境変数

Railwayで以下も設定:

```bash
# 必須
DATABASE_URL=<Railwayが自動設定>
GOOGLE_API_KEY=<Google Cloud Consoleから取得>

# オプション（Celery設定）
CELERYD_MAX_TASKS_PER_CHILD=100
CELERY_TASK_TIME_LIMIT=600
CELERY_TASK_SOFT_TIME_LIMIT=540
```

## デプロイ

1. `back/` ディレクトリの変更をコミット:
   ```bash
   git add back/
   git commit -m "feat: add Supervisor for single-container deployment"
   git push origin main
   ```

2. Railwayが自動的に再デプロイ

3. ログで確認:
   ```bash
   railway logs --follow
   ```

   正常に起動していれば:
   ```
   INFO supervisord started with pid 1
   INFO spawned: 'fastapi' with pid 7
   INFO spawned: 'celery-worker' with pid 8
   INFO success: fastapi entered RUNNING state
   INFO success: celery-worker entered RUNNING state
   ```

## 動作確認

### FastAPI の確認

```bash
curl https://your-app.up.railway.app/
```

### Celery Worker の確認

Railway ログで以下を確認:
```
celery@xxx ready.
```

### ハンズオン生成のテスト

```bash
curl -X POST https://your-app.up.railway.app/api/task_hands_on/generate_all \
  -H "Content-Type: application/json" \
  -d '{"project_id": "your-project-id"}'
```

ステータスが `200 OK` で `job_id` が返ってくればOK

## Upstash使用量の監視

Upstash Console で:
1. データベースを選択
2. **Metrics** タブ
3. コマンド数、接続数、メモリ使用量を確認

### 無料枠を超えそうな場合

- Celeryの `result_expires` を短くする（デフォルト24時間）
- タスク結果を即座に削除

`celery_app.py` で設定:
```python
celery_app.conf.update(
    result_expires=3600,  # 1時間後に結果を削除
)
```

## トラブルシューティング

### Redis接続エラー

**症状**:
```
redis.exceptions.ConnectionError: Error connecting to Redis
```

**原因**: `REDIS_URL` が設定されていない

**解決**: Railway Variables で `REDIS_URL` を確認

### Celery Workerが起動しない

**症状**:
```
INFO exited: celery-worker (exit status 1; not expected)
```

**原因**: Redisに接続できない、または依存パッケージ不足

**解決**:
1. `REDIS_URL` が正しいか確認
2. `requirements.txt` に `supervisor` が含まれているか確認

### Supervisorログの確認

Railway ログで `supervisord` のログを確認:
```bash
railway logs --follow | grep supervisor
```

## 費用

- **Upstash Redis**: $0（無料枠）
- **Railway**: $5/月（Hobby Plan、1サービス）
- **PostgreSQL**: Railwayに含まれる

**合計**: **$5/月**

## 制限事項

### Upstash無料枠の制約

- **10,000コマンド/日**を超えると一時的にアクセス不可
- 超過した場合は翌日までアクセスできない（データは保持）

### 対策

1. ハンズオン生成は頻度が低いため、通常は問題なし
2. もし超過する場合は Upstash の有料プラン（$10/月〜）を検討

## 参考リンク

- [Upstash Documentation](https://docs.upstash.com/redis)
- [Upstash Pricing](https://upstash.com/pricing)
- [Supervisor Documentation](http://supervisord.org/)
