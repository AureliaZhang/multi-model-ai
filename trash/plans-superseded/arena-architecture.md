# multi-model-ai → AI 模型竞技与评测平台 · 架构设计

> **状态**：仅设计，不编码。  
> **范围**：只在 `/workspace/multi-model-ai/` 内演进；保留现有聊天 / 中转站 / 记忆 / 文件 / MCP / 正则。  
> **产品拍板（2026-07-11）**：
> 1. **Battle** = 用户提一题 → 多模型各自回答 → 用户**多选一**（不打分、不排名文案）。  
> 2. **管理员**看各模型被选**次数与概率**；无 ELO / 无裁判模型（首版）。  
> 3. **第一版竞技相关能力仅 `role=admin` 可用**（user / guest 看不到入口、API 拒绝）。

---

## 1. Context（为什么做）

现有平台已是「多中转站 + 统一模型名 + ChatGPT 风对话」的个人助手。目标是在此之上长出 **Lab 向的模型竞技与评测层**，使管理员可以：

- 统一看见并配置可参赛模型  
- 用同一问题让多模型同台回答，并记录「被人选中」的事实  
- 跑固定题集（Benchmark）、看排行榜、做 Prompt 对照实验  
- 回溯历史与简单成绩统计  

**不是**公开 LMSYS 全网竞技场；**也不是**首版就做 LLM-as-Judge。先做 **管理员私有评测台**，数据模型预留多用户字段，避免以后推倒重来。

---

## 2. 产品信息架构（管理员视角）

在现有侧栏 `chat | settings | users | memory | files` 上，**仅 admin** 增加一组 **Arena（竞技）** 入口：

| 模块 | 用户可见动作 | 产出数据 |
|------|--------------|----------|
| **Models 台账** | 从已聚合模型中勾选「可参赛 / 可评测」、标签、备注 | 参赛池 |
| **Battle 对战** | 选题/自写问题 → 选 N 个模型 → 并发生成 → 展示答案卡片 → **点选 1 个胜者** | 对战局 + 选择事件 |
| **Prompt Lab** | 同一 prompt × 多模型（或同一模型 × 多 prompt 变体）并排看结果 | Prompt 实验记录 |
| **Benchmark** | 选题集 → 选模型集 → 批量跑 → 看每题原始输出与（可选）对勾 | Run + Case 结果 |
| **Leaderboard** | 按时间窗 / 题集 / 标签聚合「被选次数、被选率、完成率」 | 只读视图 |
| **History & Stats** | 历史局列表、筛选、导出；仪表盘计数 | 查询层 |

普通用户与游客：**完全不暴露**上述入口；访问 API 返回 403。现有 Chat / Memory / Files 行为不变。

```
现有 ── Chat / Settings / Memory / Files / Users
新增（admin only）── Arena
                      ├─ Models（参赛池，复用 stations 聚合）
                      ├─ Battle
                      ├─ Prompt Lab
                      ├─ Benchmark
                      ├─ Leaderboard
                      └─ History / Stats
```

---

## 3. 总体架构（在现有栈上长模块）

### 3.1 原则

| # | 原则 | 含义 |
|---|------|------|
| 1 | **保留聊天管道** | 不拆掉 `POST /api/chat`；评测调用走**抽出的共享调用层** |
| 2 | **Model 身份统一** | 参赛主体 = 已有 `AggregatedModel.normalizedName`（+ 可选锁定 station） |
| 3 | **事件即成绩** | Battle 的「胜」= 一次 `selection` 事件，不是分数 |
| 4 | **Admin gate** | 路由中间件 `requireAdmin`；前端按 `role` 藏入口 |
| 5 | **同步写库、异步可演进** | V1 对战可请求内并行调模型；Benchmark 大批量预留 Job 队列接口 |
| 6 | **framework.md 纪律** | 实现阶段同步更新 `framework.md`，不删旧章节 |

### 3.2 逻辑分层

```
┌─────────────────────────────────────────────────────────────┐
│  Client (React + Zustand)                                     │
│  Chat（现有） │ Arena Shell（新）│ Settings…（现有）            │
└───────────────────────────┬─────────────────────────────────┘
                            │ REST (+ SSE 可选)
┌───────────────────────────▼─────────────────────────────────┐
│  API Layer (Express)                                          │
│  /api/chat…（现有）  /api/arena/*（新，requireAdmin）          │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│  Domain Services                                              │
│  ┌──────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ ModelInvocation  │  │ ArenaOrchestrator│  │ StatsQuery  │ │
│  │ (从 chat 抽出)    │  │ Battle/Bench/…  │  │ 聚合排行榜  │ │
│  └────────┬─────────┘  └────────┬────────┘  └──────┬──────┘ │
│           │ 复用 resolveModel / failover / fetch 中转站       │
└───────────┼─────────────────────┼──────────────────┼────────┘
            ▼                     ▼                  ▼
┌──────────────────┐    ┌─────────────────────────────────────┐
│ Stations / Models│    │ SQLite：arena_* 新表 + 现有表只读复用 │
└──────────────────┘    └─────────────────────────────────────┘
```

### 3.3 关键复用（不要重写）

| 现有能力 | 路径 | 评测如何用 |
|----------|------|------------|
| 模型聚合 / 去重 | `server/src/routes/models.ts` `normalizeModelName` | 参赛 ID |
| 中转解析 + 失败重试 | `chat.ts` 内 `resolveModel` / failover 循环 | **抽出**为 `services/modelInvocation.ts` |
| 鉴权角色 | `middleware/auth.ts` + `users.role` | `requireAdmin` |
| 前端页面切换 | `Layout.tsx` 的 `PageView` | 扩展 `'arena' \| 'battle' | …` 或单页内子路由 |
| SSE 习惯 | chat 流式 | Battle 可用「非流式完整回复」简化 V1；流式为增强 |
| i18n | `client/src/i18n` | 新文案中英 |

**抽出 ModelInvocation 是架构关键路径**：Battle / Prompt / Benchmark 都调同一函数  
`invokeModel({ modelNormalizedName, messages, options }) → { content, modelUsed, stationId, latencyMs, error? }`  
避免三套复制 failover 逻辑。Chat 路由逐步改为调用该服务（行为对齐，可分 PR）。

---

## 4. 领域模型（概念）

### 4.1 参赛模型（统一管理）

在聚合模型之上增加 **Arena 配置**（不改 station 表语义）：

- `model_normalized_name`（主键语义）  
- `eligible_for_battle` / `eligible_for_benchmark`  
- `display_label`（榜上显示名，可覆盖）  
- `tags[]`（如 `coding` / `zh` / `cheap`）  
- `notes`  
- `sort_order` / `is_active`  

数据来源仍是 Settings 里已 pull 的 models；Arena 只决定「谁能进池」。

### 4.2 Prompt 资产

- `prompts`：可复用题干（title, body, system_optional, tags, source）  
- `prompt_sets`：题集（Benchmark 用），多对多挂 prompt  
- 支持从 Battle 临时输入「一次性 prompt」而不强制入库  

### 4.3 Battle（对战局）— 符合你的规则

```
Admin 输入 question
    → 选择 models[1..N]（N≥2）
    → 系统对每个 model 调用 ModelInvocation（并行，独立请求）
    → UI 展示 N 张答案卡（可打乱顺序，隐藏模型名直到选择后揭晓 —— 可选配置）
    → Admin 点击「选这个」→ 恰好 1 个 winner
    → 写入 selection；不写分数
```

**管理员统计仅：**

- 某模型被选中 **次数**  
- 某模型在「它参与且已决出胜者的局」中的 **被选率** = wins / appearances  
- 可选：参与局数、失败/超时次数（完成率）  

**明确不做（V1）：** 1–10 分、ELO、pairwise 矩阵、LLM 裁判、匿名群众投票。

### 4.4 Prompt Lab（Prompt 测试）

两种模式（同一套 run 表可表达）：

1. **一 prompt × 多模型**：对照风格/能力  
2. **一模型 × 多 prompt 变体**：对照提示词工程  

交互：并排结果、可手动标记「偏好某一格」（可选，记为 soft preference，不进默认 Leaderboard；或复用 selection 事件并带 `mode=prompt_lab`）。

### 4.5 Benchmark

- `benchmark_suites`：题集元数据  
- `benchmark_runs`：一次「选 suite + 选模型列表 + 开始」  
- `benchmark_case_results`：每个 (run, prompt, model) 的输出、延迟、状态  

V1 **默认无自动判分**；可选手动 `pass | fail | skip | unset`，便于以后加规则判分 / LLM 裁判而不改主结构。  
Leaderboard 的 Benchmark 视图可展示：完成数、平均延迟、手动 pass 率（若有标注）。

### 4.6 Leaderboard / Stats / History

- **Leaderboard**：SQL 聚合视图（或物化到 `arena_stats_daily` 若以后量大）  
  - 维度：时间范围、tag、suite、仅 battle / 含 prompt_lab  
  - 指标：selections、appearances、selection_rate、errors  
- **History**：`battle_sessions` / `benchmark_runs` / `prompt_experiments` 列表 + 详情回放  
- **Stats**：仪表盘卡片（总局数、今日对战、最常被选模型…）  

---

## 5. 数据模型（SQLite 新表草案）

> 仅设计字段语义；实现时再落 migration。现有表不删。

```
arena_model_profiles
  id, model_normalized_name UNIQUE, display_label,
  eligible_battle, eligible_benchmark, tags_json, notes,
  is_active, sort_order, created_at, updated_at

arena_prompts
  id, title, body, system_prompt NULL, tags_json,
  created_by, created_at, updated_at

arena_prompt_sets
  id, name, description, created_by, created_at

arena_prompt_set_items
  set_id, prompt_id, position
  PK(set_id, prompt_id)

arena_battle_sessions
  id, question_text, prompt_id NULL,  -- 可临时题或关联库
  status: pending|running|awaiting_selection|completed|cancelled|failed
  reveal_mode: hidden_until_pick|always_show_names
  created_by, created_at, completed_at

arena_battle_candidates
  id, session_id, model_normalized_name, station_id NULL,
  position,                    -- UI 顺序（可打乱）
  status: pending|streaming|done|error
  content, error_message, latency_ms, token_usage_json NULL,
  finished_at

arena_battle_selections
  id, session_id UNIQUE,       -- 一局只能选一次
  selected_candidate_id,
  selected_model_normalized_name,  -- 冗余便于聚合
  selector_user_id,
  created_at

arena_prompt_experiments
  id, mode: multi_model|multi_prompt,
  title, status, created_by, created_at, completed_at

arena_prompt_experiment_cells
  id, experiment_id, prompt_body, model_normalized_name,
  content, status, latency_ms, error_message

  -- 可选偏好：selected INTEGER 0/1，一 experiment 最多一个 selected=1

arena_benchmark_runs
  id, set_id, name, status: queued|running|completed|failed|cancelled
  model_list_json,             -- 本次参赛模型
  created_by, created_at, started_at, finished_at

arena_benchmark_case_results
  id, run_id, prompt_id, model_normalized_name,
  status: pending|done|error|skipped
  content, latency_ms, error_message,
  manual_verdict: unset|pass|fail|skip,
  finished_at

-- 可选：缓存日聚合（V1 可先实时 SQL）
arena_stats_snapshots ...
```

索引建议：`battle_selections(selected_model_*)`、`battle_candidates(session_id)`、`benchmark_case_results(run_id, model_*)`。

---

## 6. API 草图（均在 `/api/arena/*`，全部 requireAdmin）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/PUT | `/models` | 列表/更新参赛配置 |
| GET/POST | `/prompts` | Prompt 库 |
| GET/POST | `/prompt-sets` | 题集 |
| POST | `/battles` | 创建对战（question + model[]） |
| POST | `/battles/:id/run` | 触发生成（或 create 时自动 run） |
| GET | `/battles/:id` | 状态 + 候选（含内容） |
| POST | `/battles/:id/select` | body: `{ candidateId }` 一局一次 |
| GET | `/battles` | 历史分页 |
| POST | `/prompt-experiments` | 创建并跑 |
| GET | `/prompt-experiments/:id` | 结果 |
| POST | `/benchmarks/runs` | 启动 run |
| GET | `/benchmarks/runs/:id` | 进度与结果 |
| PATCH | `/benchmarks/results/:id` | 手动 verdict |
| GET | `/leaderboard` | query: `from,to,source=battle\|all,tag` |
| GET | `/stats/summary` | 仪表盘 |

**错误约定**：非 admin → 403；重复 select → 409；模型不可用 → 候选 `error`，局仍可对成功者选择（策略写进产品说明）。

**并发**：单 session 内 N 路 `Promise.allSettled` 调 ModelInvocation；Benchmark run V1 可顺序或有限并发（如 2～3），避免打爆中转站。

---

## 7. 前端结构（建议）

```
client/src/
  components/arena/
    ArenaLayout.tsx          # 子导航：Battle | Prompt | Bench | Board | History
    models/ArenaModelPool.tsx
    battle/BattleCreate.tsx
    battle/BattleArena.tsx   # 多卡 + 选择
    battle/BattleHistory.tsx
    prompt/PromptLab.tsx
    benchmark/SuiteEditor.tsx
    benchmark/RunMonitor.tsx
    board/Leaderboard.tsx
    stats/StatsDashboard.tsx
  stores/arenaStore.ts       # 或拆 battleStore / benchStore
  services/api.ts            # 增加 arena* 方法
```

- `Layout.tsx`：`PageView` 增加 `arena`；Sidebar 仅 `role==='admin'` 显示奖杯/竞技入口。  
- 视觉：延续现有暗色 ChatGPT 变量，Battle 结果区用卡片网格，选中高亮，不引入「分数环」以免误解。  
- 可选配置：`reveal_mode` — 选前隐藏模型名（减少品牌偏见），选后揭晓。

---

## 8. 分阶段路线图（仍不编码，只排期逻辑）

| 阶段 | 目标 | 交付 | 依赖 |
|------|------|------|------|
| **P0 地基** | 可复用调用 + 权限 | `ModelInvocation` 服务；`requireAdmin`；framework 新章 | 现有 chat |
| **P1 参赛池 + Battle MVP** | 管理员能完成一局并看到历史 | 表：profiles/sessions/candidates/selections；UI 创建→跑→选；Leaderboard 仅 battle 次数/率 | P0 |
| **P2 History & Stats** | 可回顾、可看仪表盘 | 列表筛选、详情回放、summary API | P1 |
| **P3 Prompt Lab** | 对照实验 | experiments + cells UI | P0–P1 |
| **P4 Benchmark** | 题集批量跑 | sets/runs/results + 手动 verdict | P3 可并行 |
| **P5 增强（可选）** | 体验与规模 | 流式候选、打乱匿名、导出 CSV、run 队列、并发限流、日聚合表 | 按需 |
| **以后（明确不做进 V1）** | 多用户开放、ELO、LLM 裁判、公开匿名对战 | 表已有 `created_by`，扩展策略再开文档 | — |

**建议首个可演示里程碑 = P1 结束**：管理员三模型对战 → 点选 → 榜上出现次数与概率。

---

## 9. 与现有功能的边界

| 现有 | 关系 |
|------|------|
| 日常 Chat | 不变；不自动写入 arena 表 |
| Memory | 默认 **不** 把 battle 答案注入记忆（避免污染）；设置里可留开关（默认关） |
| Files / RAG | V1 Battle 不做附件；P5 可复用 attachments |
| MCP / Regex | V1 竞技调用走「干净」completion（不挂 MCP、不套角色正则），保证评测可比性；高级选项以后再开 |
| Users | 仅 admin 用竞技；不改 user/guest 聊天权 |

---

## 10. 风险与决策记录

| 风险 | 缓解 |
|------|------|
| chat.ts 过大难抽出 | P0 只抽「单次 completion + resolve + failover」，MCP 环可暂留 chat |
| 中转限速 / 费用 | 并发上限、Benchmark 确认弹窗显示预估调用次数 |
| 模型名合并误差 | 榜用 normalizedName；详情展示实际 `model_used` + station |
| 文档滞后 | 每阶段更新 `framework.md` §Arena；功能表 Status 与代码同步 |
| 明文 Key / 弱鉴权（已有债） | 竞技上线前建议单独安全小步：admin 路由强制 JWT（可与 P0 同做） |
| 误以为「评分」 | UI 文案用「选择 / 被选次数 / 被选率」，避免「得分」「胜率」若你反感「胜」可用「入选率」 |

---

## 11. 成功标准（架构验收，非代码）

设计落地后，实现阶段应能回答：

1. 管理员能否在不离开本产品的情况下完成「一问多答一点选」并在管理视图看到次数与概率？  
2. 新功能是否零破坏现有 Chat / Settings？  
3. 所有竞技 API 是否对非 admin 关闭？  
4. Benchmark / Prompt 是否共用 ModelInvocation，而非复制三份调用逻辑？  
5. 数据是否可导出、可回溯单局全文？  

---

## 12. 推荐实现顺序（批准后才动手）

1. 更新 `framework.md` 写入 Arena 专章（仍只文档）— *若你希望文档也算「编码」可跳过，改放 `plans/arena-architecture.md`*  
2. P0：`ModelInvocation` + `requireAdmin`  
3. P1：Battle MVP + 简易 Leaderboard  
4. P2 → P3 → P4  

**本阶段不创建应用代码、不改 schema、不推 Git。** 待你批准本架构后，再按阶段拆实现任务。

---

## 13. 关键现有文件（实现时会动到，现仅列出）

| 文件 | 未来角色 |
|------|----------|
| `server/src/routes/chat.ts` | 抽出调用逻辑的来源 |
| `server/src/routes/models.ts` | normalizedName 复用 |
| `server/src/middleware/auth.ts` | requireAdmin |
| `server/src/database.ts` | 新表 |
| `server/src/index.ts` | 挂载 `/api/arena` |
| `client/src/components/layout/Layout.tsx` / `Sidebar.tsx` | 入口 |
| `client/src/services/api.ts` / stores | 新客户端 |
| `framework.md` | SSOT 文档扩展 |

新建（实现阶段）：`server/src/services/modelInvocation.ts`、`server/src/routes/arena/*.ts`、`client/src/components/arena/**`。

---

## 14. 一句话总结

在 **不拆现有助手** 的前提下，用 **共享模型调用层 + admin-only Arena 域** 增加「参赛池 / 一问多答点选对战 / Prompt 对照 / 题集跑批 / 次数·概率榜 / 历史统计」；Battle 的语义严格等于 **选择事件**，管理员只看频次与占比，第一版不做评分体系与非管理员入口。
