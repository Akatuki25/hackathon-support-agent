- 技術選定の部分はAIが選んでくれた方が圧倒的にUXとしていいな。これとこれがいいですよと推薦してくれる感じだとなおよい。
そう考えるとここの部分は小さなモデルを使ってもよい。先に十分な量の選択を用意していて、AIが推薦してくれた奴が不服なら自分で選びなおすることが出来るような設計にしたほうが筋がいいきがする


#  要件定義書




1. 最初のページ : アイディアと期間とプロジェクトタイトルなどを設定する。 
2. QAセッションを行う。オープンなクエッションを用いていいものを作る。QAセッションでメンターの方や上級者からプラスする。 
3. 第一の要件定義書を作る。（MVP)に特化する。（よりどのような状況なのか？みたいな最終的に提供する価値などを定義する。） 
4. その後に機能要件を作る。(どのような機能が必要かどうかを作る）（機能を要件定義から作る） 
5. その後に実装のための技術を生成する。 
6. 技術を実装するための技術を考える。 
7. タスクを全て生成する。 
8. 技術選定とその技術の環境構築を生成する。 
9. 開発タスクを全体的に考えてどのような順番でそのアプリを実装するかをグラフ的に見せる。 
10. タスクの一覧を見せる。タスクを看板ボードとして見せる。
11. AIサポートの導入（QAファシリテーション、技術選定、タスク優先度付け）
12. ビジュアル要素の追加（マインドマップ、依存関係グラフ、ガントチャート切り替え）
13. ハッカソンらしい時間圧縮支援（カウントダウン、簡易テンプレート、即時アドバイス）




```mermaid
erDiagram
  %% Core
  MEMBER ||--o{ PROJECT_MEMBER : participates
  PROJECTBASE ||--o{ PROJECT_MEMBER : has
  PROJECTBASE ||--o| PROJECTDOCUMENT : has
  PROJECTBASE ||--o{ TASK : has
  PROJECTBASE ||--o{ ENV : has
  PROJECTBASE ||--o{ QA : has

  %% Task assignments (M:N)
  PROJECT_MEMBER ||--o{ TASK_ASSIGNMENT : assigned
  TASK ||--o{ TASK_ASSIGNMENT : has

  %% Dependencies
  TASK ||--o| TASK : depends_on
  QA ||--o| QA : follows_from
  PROJECTDOCUMENT ||--o{ TASK : referenced_by
  PROJECTDOCUMENT ||--o{ QA : referenced_by


  QA ||--o{ PROJECTBASE : about

  MEMBER {
    UUID member_id PK
    string member_name
    string member_skill
    string github_name
  }

  PROJECTBASE {
    UUID project_id PK
    string title
    string idea
    date   start_date
    datetime end_date
    int    num_people
  }

  PROJECT_MEMBER {
    UUID project_member_id PK
    UUID project_id FK
    UUID member_id  FK
    string member_name
  }

  PROJECTDOCUMENT {
    UUID doc_id PK
    UUID project_id FK
    text specification
    text specification_doc
    text frame_work_doc
    text directory_info
    timestamptz created_at
  }

  ENV {
    UUID env_id PK
    UUID project_id FK          "-> PROJECTBASE.project_id"
    string front
    string backend
    string devcontainer
    string database
    string deploy
    timestamptz created_at
  }

  %% --- QA with dependencies & trace ---
  QA {
    UUID qa_id PK
    UUID project_id FK          "-> PROJECTBASE.project_id"
    text question
    text answer
    bool is_ai
    UUID source_doc_id FK       "-> PROJECTDOCUMENT.doc_id (任意: どの文書由来か)"
    UUID follows_qa_id FK       "self reference (任意: どのQAに続くか)"
    int  importance             "任意: 重要度/投票集計"
    timestamptz created_at
  }

  TASK {
    UUID task_id PK
    UUID project_id FK          "-> PROJECTBASE.project_id"
    string title
    text   description
    text   detail
    string status               "TODO|DOING|DONE (enum想定)"
    string priority             "LOW|MEDIUM|HIGH|CRITICAL (enum想定)"
    timestamptz due_at
    UUID source_doc_id FK       "-> PROJECTDOCUMENT.doc_id (任意)"
    UUID source_qa_id  FK       "-> QA.qa_id (任意: QAから起票)"
    UUID depends_on_task_id FK  "self reference (任意)"
  }

  TASK_ASSIGNMENT {
    UUID task_assignment_id PK
    UUID task_id FK             "-> TASK.task_id"
    UUID project_member_id FK   "-> PROJECT_MEMBER.project_member_id"
    timestamptz assigned_at
    string role                 "owner|contrib 等 任意"
  }

%%   %% Stripe/Billing 追加
%%   MEMBER ||--o| BILLING_ACCOUNT : owns
%%   BILLING_ACCOUNT ||--o| STRIPE_CUSTOMER : maps_to
%%   BILLING_ACCOUNT ||--o{ SUBSCRIPTION : has
%%   PRICE_CATALOG ||--o{ SUBSCRIPTION : priced_by
%%   BILLING_ACCOUNT ||--o{ ENTITLEMENT : grants
%%   STRIPE_EVENT_LOG }o--|| BILLING_ACCOUNT : about
%%   PROJECTBASE }o--|| BILLING_ACCOUNT : billed_to

%%   MEMBER {
%%     UUID member_id PK
%%     string member_name
%%     string member_skill
%%     string github_name
%%     string email  "NEW: Stripe顧客作成に必須"
%%   }

%%   BILLING_ACCOUNT {
%%     UUID billing_account_id PK
%%     UUID owner_member_id FK "-> MEMBER.member_id"
%%     string kind  "PERSONAL|ORG (まずはPERSONAL)"
%%     timestamptz created_at
%%     timestamptz updated_at
%%   }

%%   STRIPE_CUSTOMER {
%%     UUID billing_account_id PK, FK
%%     string stripe_customer_id  "cus_xxx"
%%   }

%%   PRICE_CATALOG {
%%     UUID price_id PK
%%     string plan_code     "FREE|PRO|TEAM|ENTERPRISE"
%%     string stripe_price_id "price_xxx"
%%     string interval      "month|year"
%%     int    trial_days
%%     jsonb  features      "表示用/説明用"
%%     bool   active
%%   }

%%   SUBSCRIPTION {
%%     UUID subscription_id PK
%%     UUID billing_account_id FK
%%     UUID price_id FK
%%     string stripe_subscription_id "sub_xxx"
%%     string status     "incomplete|active|trialing|past_due|canceled|unpaid"
%%     timestamptz current_period_start
%%     timestamptz current_period_end
%%     timestamptz cancel_at
%%     bool   cancel_at_period_end
%%     int    seat_limit   "任意: TEAMプランなど"
%%   }

%%   ENTITLEMENT {
%%     UUID entitlement_id PK
%%     UUID billing_account_id FK
%%     string key     "max_projects|max_members|ai_calls_per_day ... "
%%     int    value
%%     timestamptz updated_at
%%   }

%%   STRIPE_EVENT_LOG {
%%     UUID event_id PK
%%     UUID billing_account_id FK
%%     string stripe_event_id  "evt_xxx"
%%     string type             "checkout.session.completed 等"
%%     timestamptz received_at
%%     jsonb payload
%%     string idempotency_key
%%   }

%%   PROJECTBASE {
%%     UUID project_id PK
%%     string title
%%     string idea
%%     date   start_date
%%     datetime end_date
%%     int    num_people
%%     UUID   billing_account_id FK "NEW: このプロジェクトの請求主体"
%%   }
```