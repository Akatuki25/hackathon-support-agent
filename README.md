## 環境構築手法

### 1. リポジトリのクローン
```bash
$ git clone
```

## back側の環境構築

```bash
$ python -m venv venv
$ source venv/bin/activate
$ cd back
$ pip install -r requirements.txt
```

.envファイルを作成し、以下の内容を記述する

Google API Key はGoogle AI Platformから取得する
```bash
DATABASE_URL="postgresql://hack_helper:hackson@db/hackson_support_agent"
GOOGLE_API_KEY="YOUR_GOOGLE_API_KEY"

```
## front側の環境構築

```bash
$ cd front
$ npm install
```

.envファイルを作成し、以下の内容を記述する
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```



## 2. バックエンドの起動(一回目)
```bash
$ cd back
$ source venv/bin/activate
$ python create_tables.py
$ python app.py
```
とする。


## 3.バックエンドの起動（二回目）
```bash
$ cd back
$ source venv/bin/activate
$ python app.py
```
で回すことが出来る。

## 3. フロントエンドの起動
```bash
$ cd front
$ npm run dev
```

