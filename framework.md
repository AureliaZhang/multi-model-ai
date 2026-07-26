# Multi-Model AI Integration Platform — Framework Document

<!-- > **Version**: 0.7.1 -->
<!-- > **Last Updated**: 2026-07-11 (v0.7.1 — cleanup: trash/ archive + comment deprecated multi_prompt strings; §10.6 still not implemented) -->
<!-- > **Version**: 0.7.4 -->
<!-- > **Last Updated**: 2026-07-14 (v0.7.4 — P1: conversation export/import (nested conv+messages, idempotent import); see §12 change log) -->
<!-- > **Version**: 0.7.5 -->
<!-- > **Last Updated**: 2026-07-15 (v0.7.5 — P1: light/dark theme toggle (dual-theme CSS vars + overlay token scale, no-flash bootstrap, ThemeToggle beside LanguageToggle); see §12 change log) -->
<!-- > **Version**: 0.7.6 -->
<!-- > **Last Updated**: 2026-07-15 (v0.7.6 — P1: responsive mobile design (sidebar drawer + rooms list/detail + table horizontal-scroll + form stacking); see §12 change log) -->
<!-- > **Version**: 0.7.7 -->
<!-- > **Last Updated**: 2026-07-17 (v0.7.7 — P1: group-chat WebSocket realtime (roomHub + roomSocket, replace 3s poll with push; AI “typing…” indicator; poll kept as disconnect fallback); see §12 change log) -->
<!-- > **Version**: 0.7.8 -->
<!-- > **Last Updated**: 2026-07-17 (v0.7.8 — P2 start: vitest harness + pure unit tests for roundRobin + normalizeModelName; see §12 change log) -->
<!-- > **Version**: 0.7.9 -->
<!-- > **Last Updated**: 2026-07-17 (v0.7.9 — P2: getErrorMessage helper + eliminate all catch (err: any); see §12 change log) -->
<!-- > **Version**: 0.7.10 -->
<!-- > **Last Updated**: 2026-07-17 (v0.7.10 — P2: route-level React.lazy code-split secondary pages; see §12 change log) -->
<!-- > **Version**: 0.7.11 -->
<!-- > **Last Updated**: 2026-07-17 (v0.7.11 — security: remove hardcoded MIMO API key from seed; see §12 change log) -->
<!-- > **Version**: 0.7.12 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.12 — P2: occupancy pure FSM + cosineSimilarity tests; see §12 change log) -->
<!-- > **Version**: 0.7.13 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.13 — P2: SQLite row types for conversations/stations/rooms; see §12 change log) -->
<!-- > **Version**: 0.7.14 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.14 — P2: SQLite row types for memories/files/regex; see §12 change log) -->
<!-- > **Version**: 0.7.15 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.15 — P2: SQLite row types for rooms residual + chat/mcp/embeddings/modelInvocation; see §12 change log) -->
<!-- > **Version**: 0.7.16 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.16 — P2: SQLite row types for models/users/usage/prefs/media/auth + fileProcessor; see §12 change log) -->
<!-- > **Version**: 0.7.17 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.17 — P2: SQLite row types for arena (last route `as any` zero); see §12 change log) -->
<!-- > **Version**: 0.7.18 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.18 — P2 closeout: invokeModel failover tests + vectorSearch harness + client vitest + README; see §12 change log) -->
<!-- > **Version**: 0.7.19 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.19 — P3 start: conversation export/import includes attachments; see §12 change log) -->
<!-- > **Version**: 0.7.20 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.20 — P3: group AI true token streaming over WebSocket; see §12 change log) -->
<!-- > **Version**: 0.7.21 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.21 — P3: mobile stacked-card layouts for Memory/Files/Users tables; see §12 change log) -->
<!-- > **Version**: 0.7.22 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.22 — P3 polish: vite manualChunks + chat domain typing; see §12 change log) -->
<!-- > **Version**: 0.7.23 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.23 — UX bugs: toggle cluster, users header, memory gate, new-chat menu, settings label; see §12 change log) -->
<!-- > **Version**: 0.7.24 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.24 — virtual placeholder user for group create; see §12 change log) -->
<!-- > **Version**: 0.7.25 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.25 — group chat: single unified timeline + one composer with 群聊/@AI toggle; surface @AI errors incl. no-chat-model; see §12 change log) -->
<!-- > **Version**: 0.7.26 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.26 — group chat: restore two panes (b human chat + c AI replies) under one composer; keep 群聊/@AI toggle; see §12 change log) -->
<!-- > **Version**: 0.7.27 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.27 — group chat polish: @AI delivery pill + composer live in column b only; column c holds only AI answers; transient "reply generating on the right" placeholder in b that clears when c finishes; see §12 change log) -->
<!-- > **Version**: 0.7.28 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.28 — group chat: column c renders the AI reply as formatted markdown (react-markdown + remarkGfm + normalizeMarkdown, same as private chat) instead of raw text; hide the first-pass raw stream, show "generating & formatting" until done; see §12 change log) -->
<!-- > **Version**: 0.7.29 -->
<!-- > **Last Updated**: 2026-07-18 (v0.7.29 — smaller top-right toggle cluster (icon-first, no big grey block); spec §10.6.13 AI-reply export docx/pdf, §10.6.14 room pinned note + edit-grant approval, §10.6.15 recorded; see §12 change log) -->
<!-- > **Version**: 0.7.30 -->
<!-- > **Last Updated**: 2026-07-19 (v0.7.30 — fix: client production build (tsc -b) was broken by the v0.7.29 batch; requestNotepadEdit typed Promise<string|null> (was void → TS2322/TS1345); hoisted exportableReplies useMemo above GroupChatLayout early return (react-hooks/rules-of-hooks); see §12 change log) -->
<!-- > **Version**: 0.7.31 -->
<!-- > **Last Updated**: 2026-07-19 (v0.7.31 — chore: eliminate all 4 no-explicit-any lint errors → eslint 0 errors (12 set-state-in-effect warnings remain); see §12 change log) -->
<!-- > **Version**: 0.7.32 -->
<!-- > **Last Updated**: 2026-07-19 (v0.7.32 — refactor: single shared <MarkdownMessage> for assistant markdown, dedup 3 react-markdown call sites → 1 (MessageBubble + group-chat column c + exportAiReplies); evaluated lazy-loading it but rolldown-vite still preloads vendor-markdown, so kept eager; see §12 change log) -->
<!-- > **Version**: 0.7.33 -->
<!-- > **Last Updated**: 2026-07-20 (v0.7.33 — feature: per-conversation system prompt / persona (conversations.system_prompt column + migration; injected as leading system message before file/memory RAG; create/update/export v2/import carry it; ChatArea 人设/Persona button + SystemPromptModal; +3 server tests → 80); see §12 change log) -->
<!-- > **Version**: 0.7.34 -->
<!-- > **Last Updated**: 2026-07-20 (v0.7.34 — team-readiness kickoff: recorded §9 impl status + §10.8 security/isolation audit; first fix batch — memory cross-user leak now scoped on the AI chat path (retrieveRelevantMemories→vectorSearch by conversation owner + legacy NULL), vectorSearch returns id/conversation_id/message_id (fixes blank-id semantic results), CORS lockable via CORS_ORIGIN env, SQLite busy_timeout=5s; +2 tests → 82; see §12 change log) -->
<!-- > **Version**: 0.7.42 -->
<!-- > **Version**: 0.7.46 -->
<!-- > **Version**: 0.7.47 -->
<!-- > **Version**: 0.7.48 -->
<!-- > **Version**: 0.7.49 -->
<!-- > **Version**: 0.7.50 -->
> **Version**: 0.7.51
> **Created**: 2026-06-15
<!-- > **Last Updated**: 2026-07-20 (v0.7.35 — Phase 1 security batch (§10.8 TC0/TC1): memories router requireAuth + per-user scoping; conversation + chat ownership guards; file/folder mutation owner-gated; JWT-secret boot guard + ADMIN_PASSWORD guardrails; dependency-free rate limiter on /api/chat + /api/arena; +3 tests → 85) -->
<!-- > **Last Updated**: 2026-07-21 (v0.7.36 — Phase 2 data-safety: versioned schema migrations (schema_migrations ledger + transactional runMigrations) + online DB backups (db.backup() snapshots, keep-N rotation, admin /api/backups); +21 tests → 106) -->
<!-- > **Last Updated**: 2026-07-21 (v0.7.37 — Phase 3 start (§10.8 TC1 #3): API keys encrypted at rest (utils/crypto.ts AES-256-GCM, opt-in ENCRYPTION_KEY, transparent decrypt at read sites, boot sweep); +10 tests → 116) -->
<!-- > **Last Updated**: 2026-07-21 (v0.7.38 — Phase 3 usage dashboard (FE-B, token-based, first client change): GET /api/usage/summary + collapsible per-user/per-model tables; +5 tests → 121) -->
<!-- > **Last Updated**: 2026-07-22 (v0.7.39 — Phase 3 per-user monthly token quota backend + enforcement (migration v2, services/quota.ts, chat 429); +6 tests → 127) -->
<!-- > **Last Updated**: 2026-07-23 (v0.7.40 — Phase 3 COMPLETE: quota admin UI (QuotaCell in UserManagement)) -->
<!-- > **Last Updated**: 2026-07-23 (v0.7.41 — Phase 4 FE-A message actions: copy/regenerate/edit + truncate endpoint) -->
<!-- > **Last Updated**: 2026-07-24 (v0.7.45 — **Phase 5 start (TC2 perf): chat path speedups** — historical PDFs/text files no longer re-parsed every turn (new `attachments.extracted_text` cache column, migration v5; parse-once-then-persist), the per-history-message attachment query is now ONE batched `IN (...)` load, and the query embedding is computed once and shared between file-RAG and memory vector search. Behaviour-preserving; +4 tests → server 160 / tsc clean; no client changes. Next Phase 5: retention purge (TC1 #5), chat organize/pin/folders (FE-A), member invite (FE-B).) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.46 — **Phase 5: memory retention purge (TC1 #5)** — `memory_config.retention_days` is finally ENFORCED: new `services/retention.ts` periodic purge job (boot sweep + 6h interval, `unref`'d, env-tunable `RETENTION_ENABLED`/`RETENTION_SWEEP_INTERVAL_MS`; 0 = keep forever, policy read live from DB so admin changes apply without restart), wired into `index.ts` start/shutdown; +7 tests → server 167 / tsc clean; no client changes. Next Phase 5: chat organize/pin/folders (FE-A), member invite (FE-B), history LIMIT (单独讨论).) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.47 — **Phase 5: chat organize — pin + folders (FE-A)** — migration v6 `conversations.pinned`/`folder`, PUT accepts both (pure `computeConversationUpdate`), list orders pinned-first; Sidebar groups 已置顶 → 折叠文件夹 → 其余, hover pin/move-to-folder actions + per-row folder dropdown (existing/new/remove); +6 tests → server 173 / both tsc clean / build+eslint clean. Next Phase 5: member invite (FE-B), history LIMIT (单独讨论), vector-scan bound, a11y.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.48 — **Phase 5: member invite / onboarding (FE-B)** — migration v7 `invites` (code/role/max_uses/expires/revoked), admin `/api/users/invites` mint/list/revoke + UserManagement 邀请面板 (copy `?invite=CODE` link), register consumes codes (role stamped, one use), `REQUIRE_INVITE=1` makes the instance invite-only; invite links land on the register page with the code prefilled; +8 tests → server 181 / both tsc / build / eslint clean. Remaining Phase 5: history LIMIT (单独讨论), vector-scan bound, a11y.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.49 — **Phase 5: history LIMIT (TC2 #2)** — owner decision: send only the last N verbatim turns (default 20, 0=unlimited), older context covered by memory-RAG; migration v8 `memory_config.history_max_turns`, pure `limitHistory` applied BEFORE the attachment batch load, admin input in Memory settings; +8 tests → server 189 / both tsc / build / eslint clean. Remaining Phase 5: vector-scan bound, a11y.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.50 — **chore: full-project redundancy audit + notepad i18n fix** — repo-wide sweep after the network-interruption sessions found ONE real bug (group-notepad i18n three-way mismatch: code/`zh`/`en` used different key names → raw keys rendered in UI; now 12/12 aligned both locales) + a documented-debt list (dead deps `dotenv`/`node-fetch`/`react-router-dom`/`react-textarea-autosize`; `getStationsForModel` chat.ts/modelInvocation.ts near-duplicate; TC2 #5 resolveModel rescan) — see §12. Tests/tsc/build all green; no behaviour change.) -->
> **Last Updated**: 2026-07-26 (v0.7.51 — **chore: i18n dead-key purge** — closed the v0.7.50 audit's open item: every 'suspect' key individually verified (3 dynamic t() sites resolved: guide.stepN via titleKey/descKey arrays, settings.howItWorksStepN via [1..6].map; 6 substring false positives re-checked with exact-quote match) → **34 keys confirmed zero-referenced and removed from BOTH locales**, 18 dynamic-covered kept; zh=en=554, no code-required key missing; build/tsc/tests green.)
<!-- > **Last Updated**: 2026-07-12 (v0.7.2 — bug/breakpoint sweep across shipped work; wired the already-built group-chat UI (§10.6) into the app; fixed 4 real bugs; see §12 change log) -->
> **Rule**: This file must be kept in sync with every development step. Content is NEVER deleted, only commented out with `<!-- ... -->` when superseded. Other files may be freely modified.

---

## 1. Project Overview

### 1.1 Purpose

Build a web-based multi-model AI integration platform that:

- Aggregates multiple LLM relay/proxy stations (中转站) behind a unified interface.
- Presents deduplicated model names to the end user (e.g., if Station A and Station B both offer `deepseek-chat`, the user sees it once).
- Provides automatic failover and round-robin load balancing across stations for each model.
- Offers a ChatGPT-style conversational UI with file upload and image generation support.
- Acts as a **personal assistant** with a persistent **memory store (记忆库)** — every conversation is saved and can be referenced by the assistant for context-aware responses.

### 1.2 Core Principles

| # | Principle | Description |
|---|-----------|-------------|
| 1 | **Model-centric UX** | Users interact with model names only; station complexity is hidden. |
| 2 | **High availability** | Automatic failover + round-robin ensures service continuity. |
| 3 | **Extensibility** | New stations and models can be added via configuration without code changes. |
| 4 | **Memory-first assistant** | All conversations are persisted into a memory store; the assistant retains context across sessions. |
| 5 | **Framework discipline** | Every change is logged in this document; nothing is deleted. |

---

## 2. Architecture

### 2.1 High-Level Diagram

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (SPA)                    │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Sidebar   │  │ Chat View│  │ Settings / Config │  │
│  │ (models)  │  │ (messages│  │ (stations CRUD)   │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
└──────────────────────┬──────────────────────────────┘
                       │ REST / WebSocket
┌──────────────────────▼──────────────────────────────┐
│                   Backend (API)                      │
│  ┌────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │ Model       │  │ Station      │  │ Chat / Stream│  │
│  │ Router &    │  │ Manager      │  │ Handler      │  │
│  │ Load Balancer│ │ (CRUD+Health)│  │              │  │
│  └──────┬─────┘  └──────┬───────┘  └──────┬──────┘  │
│  ┌────────────────────────────────────────────────┐  │
│  │              Memory Store (记忆库)              │  │
│  │  Conversation persistence & semantic retrieval  │  │
│  └────────────────────────────────────────────────┘  │
└─────────┼───────────────┼─────────────────┼─────────┘
          │               │                 │
┌─────────▼───────────────▼─────────────────▼─────────┐
│              Relay Stations (中转站)                  │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐     │
│  │Station A│  │Station B│  │Station C│  │  ...   │     │
│  │(OpenAI) │  │(GLM)    │  │(DeepSeek│  │        │     │
│  └────────┘  └────────┘  └────────┘  └────────┘     │
└─────────────────────────────────────────────────────┘
```

### 2.2 Tech Stack (Planned)

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React + TypeScript + Vite | Modern, fast, type-safe |
| UI Components | Tailwind CSS + shadcn/ui | Clean, ChatGPT-like aesthetic |
| State Management | Zustand | Lightweight, simple |
| Backend | Node.js + Express / Fastify | Fast API development |
| Database | SQLite (via better-sqlite3) | Lightweight, zero-config for local deployment |
| Real-time | Server-Sent Events (SSE) | Streaming LLM responses |
| Config | JSON / YAML config file | Easy station & model configuration |

---

## 3. Feature Specification

### 3.1 Station Management (Admin/Settings Panel)

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F-S01 | Add Station | User provides station name, base URL, API key | `TODO` |
| F-S02 | Edit Station | Modify URL, API key, enable/disable | `TODO` |
| F-S03 | Delete Station | Remove a station (with confirmation) | `TODO` |
| F-S04 | Model Pull | Fetch available model list from station's `/v1/models` endpoint | `TODO` |
| F-S05 | Model Selection | User toggles which pulled models are exposed in the chat UI | `TODO` |
| F-S06 | Station Health Check | Periodic ping to verify station availability | `TODO` |

### 3.2 Model Aggregation & Routing

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F-M01 | Model Deduplication | Merge models from all stations by normalized name; UI shows unique model names only | `TODO` |
| F-M02 | Station Mapping | Internal mapping: `model_name → [station_1, station_2, ...]` | `TODO` |
| F-M03 | Round-Robin Load Balancer | Distribute requests across available stations for a model | `TODO` |
| F-M04 | Automatic Failover | If a station returns error/timeout, automatically retry on next station | `TODO` |
| F-M05 | Health-based Routing | Skip unhealthy stations in the routing pool | `TODO` |
| F-M06 | Model Capability Tags | Tag models with capabilities: `text`, `vision`, `image-gen`, `code` | `TODO` |

### 3.3 Chat Interface

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F-C01 | Model Selector | Dropdown or selector in chat header to pick model | `TODO` |
| F-C02 | Text Conversation | Standard message send/receive with streaming | `TODO` |
| F-C03 | Multi-turn Context | Maintain conversation history per session | `TODO` |
| F-C04 | File Upload | Upload files (images, PDFs, docs) for vision/document-capable models | `TODO` |
| F-C05 | Image Generation | Select image-gen capable models, display generated images inline | `TODO` |
| F-C06 | Conversation Management | Create, rename, delete, switch between conversations | `TODO` |
| F-C07 | Markdown Rendering | Render LLM responses with proper markdown, code highlighting | `TODO` |
| F-C08 | Stop Generation | Ability to stop a streaming response mid-generation | `TODO` |
| F-C09 | Error Handling | Display user-friendly errors with retry option | `TODO` |

### 3.4 UI Design (ChatGPT-style)

| ID | Element | Description | Status |
|----|---------|-------------|--------|
| F-U01 | Left Sidebar | Conversation list with create/rename/delete | `TODO` |
| F-U02 | Chat Area | Centered message thread with user/assistant bubbles | `TODO` |
| F-U03 | Model Dropdown | Top of chat area, shows available models with capability icons | `TODO` |
| F-U04 | Input Bar | Bottom of chat: text input, file attach button, send button | `TODO` |
| F-U05 | Settings Page | Station CRUD, model pull & selection, API key management | `TODO` |
| F-U06 | Dark/Light Theme | Toggle between themes | `TODO` |
| F-U07 | Responsive Design | Mobile-friendly layout | `TODO` |

### 3.5 Memory Store (记忆库)

| ID | Feature | Description | Status |
|----|---------|-------------|--------|
| F-MEM01 | Auto-Save Conversations | Every conversation turn (user + assistant) is automatically persisted to the memory store | `TODO` |
| F-MEM02 | Memory Indexing | Each memory entry is indexed by conversation, model, timestamp, and extracted keywords | `TODO` |
| F-MEM03 | Keyword Search | User can search memories by keywords across all past conversations | `TODO` |
| F-MEM04 | Semantic Search | Vector-based semantic search to find relevant past conversations by meaning, not just keywords | `TODO` |
| F-MEM05 | Context Injection | Before sending a prompt to LLM, automatically retrieve relevant memories and inject them as system context | `TODO` |
| F-MEM06 | Memory Management UI | Browse, search, view, and delete individual memory entries or entire conversation memories | `TODO` |
| F-MEM07 | Conversation Summarization | For long conversations, auto-generate summaries to compress memory storage | `TODO` |
| F-MEM08 | Memory Tags | Tag memories with auto-detected topics (e.g., "coding", "travel", "recipe") for filtering | `TODO` |
| F-MEM09 | Memory Export/Import | Export memory store to JSON/CSV; import from backup | `TODO` |
| F-MEM10 | Memory Settings | User can configure: auto-save on/off, context injection on/off, max memories injected, retention period | `TODO` |

---

## 4. Data Model

### 4.1 Station

```typescript
interface Station {
  id: string;              // UUID
  name: string;            // Display name
  baseUrl: string;         // e.g., "https://api.example.com/v1"
  apiKey: string;          // Encrypted at rest
  enabled: boolean;
  healthStatus: 'healthy' | 'unhealthy' | 'unknown';
  lastHealthCheck: Date;
  models: StationModel[];  // Models pulled from this station
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.2 StationModel (raw model from a station)

```typescript
interface StationModel {
  id: string;              // UUID
  stationId: string;       // FK → Station
  modelId: string;         // Raw model ID from API, e.g., "deepseek-chat"
  displayName: string;     // User-friendly name
  capabilities: ModelCapability[];
  enabled: boolean;        // Whether admin has enabled this model
  createdAt: Date;
}

type ModelCapability = 'text' | 'vision' | 'image-gen' | 'code';
```

### 4.3 AggregatedModel (virtual, not persisted — computed on the fly)

```typescript
interface AggregatedModel {
  displayName: string;                        // Deduplicated display name
  normalizedName: string;                     // Lowercase, trimmed key
  capabilities: ModelCapability[];
  stations: { stationId: string; modelId: string; healthy: boolean }[];
}
```

### 4.4 Conversation

```typescript
interface Conversation {
  id: string;              // UUID
  title: string;
  modelNormalizedName: string;  // Which aggregated model is selected
  createdAt: Date;
  updatedAt: Date;
  messages: Message[];
}
```

### 4.5 Message

```typescript
interface Message {
  id: string;              // UUID
  conversationId: string;  // FK → Conversation
  role: 'user' | 'assistant' | 'system';
  content: string;         // Text content
  attachments?: Attachment[];
  modelUsed?: string;      // Actual model + station that served the response
  createdAt: Date;
}

interface Attachment {
  id: string;
  type: 'image' | 'file';
  filename: string;
  mimeType: string;
  url: string;             // Local storage path or base64
}
```

### 4.6 MemoryEntry (记忆条目)

```typescript
interface MemoryEntry {
  id: string;                    // UUID
  conversationId: string;        // FK → Conversation
  messageId: string;             // FK → Message (the specific turn)
  role: 'user' | 'assistant';   // Who said it
  content: string;               // The actual text content
  summary?: string;              // Auto-generated summary (for long entries)
  keywords: string[];            // Extracted keywords for indexing
  tags: string[];                // Auto-detected topic tags
  embedding?: number[];          // Vector embedding for semantic search (optional)
  modelUsed?: string;            // Which model was used for this turn
  importance: number;            // 0-1 score, higher = more important (for context injection ranking)
  createdAt: Date;
  updatedAt: Date;
}
```

### 4.7 MemoryTag (记忆标签)

```typescript
interface MemoryTag {
  id: string;                    // UUID
  name: string;                  // Tag name, e.g., "coding", "travel"
  color?: string;                // UI display color
  entryCount: number;            // Number of memories with this tag
  createdAt: Date;
}
```

### 4.8 MemoryConfig (记忆配置)

```typescript
interface MemoryConfig {
  autoSave: boolean;             // Auto-save conversations to memory
  contextInjection: boolean;     // Auto-inject relevant memories into LLM context
  maxContextMemories: number;    // Max number of memories to inject per prompt (default: 5)
  retentionDays: number;         // Auto-delete memories older than N days (0 = forever)
  semanticSearch: boolean;       // Enable vector-based semantic search
  autoSummarize: boolean;        // Auto-summarize long conversations
  summarizeThreshold: number;    // Number of turns before auto-summarization kicks in
}
```

---

## 5. API Design (Backend)

### 5.1 Station Endpoints

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/stations` | List all stations | `TODO` |
| POST | `/api/stations` | Create a station | `TODO` |
| PUT | `/api/stations/:id` | Update a station | `TODO` |
| DELETE | `/api/stations/:id` | Delete a station | `TODO` |
| POST | `/api/stations/:id/pull-models` | Fetch models from station | `TODO` |
| POST | `/api/stations/:id/health-check` | Trigger health check | `TODO` |

### 5.2 Model Endpoints

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/models` | List all aggregated (deduplicated) models | `TODO` |
| GET | `/api/models/:normalizedName/stations` | List stations serving a model | `TODO` |
| PUT | `/api/stations/:stationId/models/:modelId` | Enable/disable a specific station-model | `TODO` |

### 5.3 Chat Endpoints

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/conversations` | List conversations | `TODO` |
| POST | `/api/conversations` | Create conversation | `TODO` |
| DELETE | `/api/conversations/:id` | Delete conversation | `TODO` |
| PUT | `/api/conversations/:id` | Update conversation (rename, change model) | `TODO` |
| GET | `/api/conversations/:id/messages` | Get messages | `TODO` |
| POST | `/api/chat` | Send message & get streaming response (SSE) | `TODO` |
| POST | `/api/upload` | Upload file attachment | `TODO` |

### 5.4 Chat Request/Response Flow

```
User sends message
       │
       ▼
┌─────────────────┐
│  POST /api/chat  │
│  { model, msgs } │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Model Router         │
│ 1. Resolve model →   │
│    list of stations  │
│ 2. Filter healthy    │
│ 3. Round-robin pick  │
│ 4. Forward request   │
└────────┬────────────┘
         │
    ┌────▼────┐   Success?   ┌──────────┐
    │ Station │──────────────▶│ Stream   │
    │   A     │               │ Response │
    └────┬────┘               └──────────┘
         │ Fail
         ▼
    ┌──────────┐  Success?   ┌──────────┐
    │ Station  │─────────────▶│ Stream   │
    │   B      │              │ Response │
    └────┬─────┘              └──────────┘
         │ Fail
         ▼
    ┌──────────┐  Success?   ┌──────────┐
    │ Station  │─────────────▶│ Stream   │
    │   C      │              │ Response │
    └────┬─────┘              └──────────┘
         │ All failed
         ▼
    ┌──────────────┐
    │ Error to User│
    └──────────────┘
```

### 5.5 Memory Endpoints

| Method | Path | Description | Status |
|--------|------|-------------|--------|
| GET | `/api/memories` | List all memory entries (with pagination & filters) | `TODO` |
| GET | `/api/memories/search?q=keyword` | Keyword search across memories | `TODO` |
| POST | `/api/memories/search/semantic` | Semantic (vector) search with query text | `TODO` |
| GET | `/api/memories/:id` | Get a single memory entry | `TODO` |
| DELETE | `/api/memories/:id` | Delete a memory entry | `TODO` |
| DELETE | `/api/memories/conversation/:convId` | Delete all memories for a conversation | `TODO` |
| GET | `/api/memories/tags` | List all memory tags | `TODO` |
| GET | `/api/memories/context?q=query&limit=5` | Retrieve top-N relevant memories for context injection | `TODO` |
| GET | `/api/memories/config` | Get memory configuration | `TODO` |
| PUT | `/api/memories/config` | Update memory configuration | `TODO` |
| POST | `/api/memories/export` | Export all memories to JSON | `TODO` |
| POST | `/api/memories/import` | Import memories from JSON | `TODO` |
| POST | `/api/memories/summarize/:convId` | Generate summary for a conversation's memories | `TODO` |

### 5.6 Memory Context Injection Flow

```
User sends message
       │
       ▼
┌──────────────────────────┐
│ 1. Check MemoryConfig    │
│    .contextInjection?    │
└──────────┬───────────────┘
           │ Yes
           ▼
┌──────────────────────────┐
│ 2. Search memory store   │
│    GET /api/memories/    │
│    context?q=user_msg    │
│    (keyword + semantic)  │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ 3. Build system prompt   │
│    with retrieved memory │
│    context prepended     │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ 4. Send to LLM via       │
│    Model Router          │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│ 5. Auto-save both user   │
│    msg & assistant resp  │
│    to memory store       │
└──────────────────────────┘
```

---

## 6. Frontend Structure (Planned)

```
src/
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx          # Conversation list
│   │   ├── ChatArea.tsx         # Main chat view
│   │   └── Layout.tsx           # Root layout wrapper
│   ├── chat/
│   │   ├── MessageBubble.tsx    # Single message render
│   │   ├── ChatInput.tsx        # Input bar with file attach
│   │   ├── ModelSelector.tsx    # Model dropdown
│   │   └── FileUpload.tsx       # File upload handler
│   ├── memory/
│   │   ├── MemoryPanel.tsx      # Memory browser panel
│   │   ├── MemorySearch.tsx     # Search bar with keyword + semantic toggle
│   │   ├── MemoryCard.tsx       # Single memory entry display
│   │   ├── MemoryTagFilter.tsx  # Tag-based filtering
│   │   └── MemorySettings.tsx   # Memory configuration UI
│   ├── settings/
│   │   ├── StationManager.tsx   # Station CRUD
│   │   ├── ModelPuller.tsx      # Pull & select models
│   │   └── SettingsPage.tsx     # Settings layout
│   └── ui/                      # shadcn/ui components
├── stores/
│   ├── chatStore.ts             # Conversation & message state
│   ├── modelStore.ts            # Aggregated models state
│   ├── stationStore.ts          # Station config state
│   └── memoryStore.ts           # Memory entries & search state
├── services/
│   ├── api.ts                   # API client
│   ├── chatService.ts           # Chat SSE handling
│   ├── stationService.ts        # Station API calls
│   └── memoryService.ts         # Memory CRUD, search, context retrieval
├── types/
│   └── index.ts                 # TypeScript interfaces
├── utils/
│   ├── modelUtils.ts            # Model dedup, normalization
│   └── formatUtils.ts           # Formatting helpers
├── App.tsx
├── main.tsx
└── index.css
```

---

## 7. Model Normalization & Deduplication Strategy

### 7.1 Normalization Rules

```
Input:  "DeepSeek-Chat", "deepseek-chat", "DEEPSEEK Chat"
Output: "deepseek-chat"

Steps:
1. Trim whitespace
2. Convert to lowercase
3. Replace spaces/special chars with hyphens
4. Remove duplicate hyphens
```

### 7.2 Dedup Algorithm

```
1. For each station, fetch model list
2. For each model, compute normalized name
3. Group models by normalized name
4. For each group:
   a. displayName = "best" display name (first non-empty, or normalized)
   b. capabilities = union of all capabilities
   c. stations = list of (stationId, originalModelId, healthy)
5. Return list of AggregatedModel
```

---

## 8. Failover & Load Balancing

### 8.1 Round-Robin Strategy

- Maintain a counter per normalized model name.
- On each request, increment counter and pick `stations[counter % stations.length]`.
- Skip unhealthy stations (pick next in rotation).

### 8.2 Failover Strategy

- On request failure (timeout > 30s, HTTP 5xx, connection error):
  1. Mark the station as `unhealthy` for that model (temporary, 5 min cooldown).
  2. Retry with next station in rotation.
  3. If all stations fail, return error to user with details.

### 8.3 Health Check

- Background job every 60 seconds (override via `HEALTH_CHECK_INTERVAL_MS`).
- Call `/v1/models` or lightweight endpoint on each station.
- Update `healthStatus` field.
- Unhealthy stations are excluded from routing; re-included once healthy.

**Implemented** (`server/src/services/healthCheck.ts`): `checkStationHealth()` pings `/models` and writes health to the DB; `runHealthCheckSweep()` runs all enabled stations in parallel on a timer started in `server/src/index.ts` (`startHealthCheckJob()` on listen, `stopHealthCheckJob()` on SIGINT/SIGTERM; timer is `unref()`'d). The manual health-check route reuses `checkStationHealth()`.

---

## 9. Security Considerations

| # | Concern | Mitigation | Status (audited 2026-07-20) |
|---|---------|------------|------------------------------|
| 1 | API keys stored locally | Encrypt at rest using AES-256; never expose in frontend | ❌ station `apiKey` stored **plaintext** in SQLite (no crypto anywhere). Not sent to frontend (ok). |
| 2 | File upload risks | Validate file type, limit size (50MB), scan for malware | 🟡 `files.ts` multer `fileSize` **20MB** only; no type allowlist, no malware scan. |
| 3 | Prompt injection | Sanitize file content before sending to model | ❌ extracted file text injected verbatim (not line-audited, but no sanitizer present). |
| 4 | Rate limiting | Implement per-model and per-station rate limits | 🟡 dependency-free per-user/IP limiter on `/api/chat` + `/api/arena` (v0.7.35); per-model/per-station granularity still todo. |
| 5 | CORS | Restrict to frontend origin only | 🟡 now lockable via `CORS_ORIGIN` env (default still `*` so local dev unbroken) — v0.7.34. |

> **Audit note (2026-07-20):** §9 was written for the original single-user "personal assistant". Cross-checked against code during the team-readiness review — **most mitigations were never implemented**. See §10.8 for the ranked backlog (this table's ❌ items are TC1 there).

---

## 10. Development Roadmap

### Phase 1: Foundation
- [x] Project scaffolding (frontend + backend) — Vite+React+TS frontend, Express+SQLite backend
- [x] Station CRUD API + UI — Full CRUD with add/edit/delete/pull-models/health-check
- [x] Model pull from station (`/v1/models`) — Fetches and stores models per station
- [x] Model deduplication logic — normalizeModelName() + aggregated model API

### Phase 2: Core Chat
- [x] Chat UI (ChatGPT-style layout) — Sidebar + ChatArea + MessageBubble
- [x] Model selector dropdown — Capability icons, health indicators, station count
- [x] Streaming chat via SSE — streamChat() with chunk-by-chunk rendering
- [x] Conversation management (CRUD) — Create, list, delete, select conversations

### Phase 3: Reliability
- [x] Round-robin load balancer — real per-model RR counter across stations (commit 05c2a97)
- [x] Automatic failover — try next station on failure (chat + modelInvocation)
- [x] Health check background job — periodic sweep pings `/models` per station, writes health to DB (§8.3)
- [x] Error handling & retry UI — error banner offers retry when all stations fail

### Phase 4: Advanced Features
<!-- superseded 2026-07-11: file upload/vision largely implemented via chat attachments + files module -->
- [x] File upload & vision model support — chat attachments + file library RAG (partial vision path)
<!-- superseded 2026-07-11: image generation MVP via /api/media/images + prefs image model -->
- [x] Image generation model support — `/api/media/images` + confirm modal (MVP)
- [x] Dark/Light theme toggle — dual-theme CSS + ThemeToggle (v0.7.5)
- [x] Responsive mobile design — sidebar drawer + rooms list/detail + table scroll (v0.7.6)
- [x] Export/import conversations — nested JSON (v0.7.4); **attachments included from v0.7.19** (export version 2)
- [x] Group chat / Group AI (§10.6) — wired into app 2026-07-12 (RoomsPage + Sidebar entry); **realtime WebSocket landed 2026-07-17 (v0.7.7)** — poll kept only as disconnect fallback

### Phase 5: Memory Store (记忆库)
- [x] Memory store database schema & CRUD — memory_entries, memory_tags, memory_config tables
- [x] Auto-save every conversation turn to memory — autoSaveMemory() in chat route
- [x] Memory search (keyword + semantic) — /api/memories/search, /api/memories/search/semantic
- [x] Memory retrieval injection into chat context — /api/memories/context endpoint
<!-- superseded 2026-07-11: MemoryBrowser UI exists -->
- [x] Memory management UI (browse, search, delete memories) — `MemoryBrowser`
- [x] Conversation summarization for long-term memory compression — /api/memories/summarize/:convId
- [x] Memory export/import — /api/memories/export, /api/memories/import

### Phase 6: Polish
- [x] Testing (unit + integration) — **P2 closeout (v0.7.18)**: server vitest **72** tests (roundRobin, normalize, errors, cosine/serdes, occupancy FSM, **invokeModel failover** with injectable deps, **vectorSearch** in-memory SQLite, asyncPool). Client vitest harness + **9** pure tests (`getErrorMessage`, `normalizeMarkdown`). Root `npm test` still a placeholder; run under `server/` and `client/`.
- [x] Type-safety cleanup — catch-path `any` done (v0.7.9); **SQLite row `as any` zeroed (v0.7.17)** via `dbRows.ts`. Domain request-body `any` in chat still optional. See §10.7.
- [x] Documentation — root `README.md` (v0.7.18) points at framework + quick start; framework remains SoT.
- [ ] Comprehensive error messages — optional product copy polish (not blocking).
- [x] Performance optimization — route-level lazy (v0.7.10) + vendor `manualChunks` (v0.7.22: react / markdown / icons / zustand)

### Phase 7: Arena — Model Battle & Eval (管理员)
- [x] Shared `ModelInvocation` service (non-stream completion + station failover) — `server/src/services/modelInvocation.ts`
- [x] Admin gate (`requireAuth` + `requireRole('admin')`) on `/api/arena/*`
- [x] Schema: `arena_model_profiles`, `arena_battle_sessions`, `arena_battle_candidates`, `arena_battle_selections`
- [x] Battle API: create + parallel run + select-one + history
- [x] Leaderboard (selection counts & rate) + stats summary
- [x] Admin UI: Arena shell (Battle / History / Leaderboard / Models / Stats)
- [x] Prompt Lab (multi_model / multi_prompt experiments + soft prefer)
- [x] Benchmark suites / runs / manual verdict
- [x] CSV export (leaderboard / battles / benchmark / experiment)
- [x] Async benchmark queue (`async:true` + client poll)
- [x] Shared concurrency limiter (`ARENA_CONCURRENCY`, mapPool)

---

## 10.5 Arena Product Rules (2026-07-11)

| Rule | Detail |
|------|--------|
| Audience | **Admin only** for V1 (user/guest: no nav entry, API 403) |
| Battle | One question → N models answer in parallel → admin **picks exactly one** answer |
| Scoring | **None**. Metrics = selection **count** and **rate** (selections / appearances) only |
| No | ELO, 1–10 scores, LLM-as-judge, public crowd voting (V1) |
| Chat | Unchanged; battles do not write to memory by default |
| Clean invoke | Arena calls skip MCP / memory / regex for comparability |

API base: `/api/arena/*` (see `server/src/routes/arena.ts`).

---

## 10.6 Collaborative Chat & Group AI — Product Spec (Draft, 2026-07-11)

<!-- > **Status**: Design locked via product discussion; **not implemented yet**. (superseded 2026-07-12) -->
> **Status**: **Implemented (V1)** as of 2026-07-12; **realtime (WebSocket)** as of 2026-07-17 (v0.7.7); **AI token streaming over WS** as of 2026-07-18 (v0.7.20). Backend (`server/src/routes/rooms.ts` + `services/roomHub.ts` on `/ws/rooms`), `roomStore` + `roomSocket`, and `GroupChatLayout` are live via Sidebar → "Group Chats" → `RoomsPage`. Live events: human messages, AI thinking/**streaming**/done, occupancy/room state, members, disband. 3s poll remains only while the socket is not open. i18n `room.*` keys zh/en.  
> **Scope**: `multi-model-ai` only.  
> **Principle**: Two tracks in a group — left = human social, right = shared AI workbench. AI never reads human-only chat unless the user explicitly @AI.

### 10.6.1 Session list (sidebar)

| Type | Behavior |
|------|----------|
| **Private (DM with AI)** | One user ↔ AI only. **Pinned at top** by default. If more than **~3** private sessions, older ones **fold** (WeChat-style expand on click). |
| **Group** | Multiple users + **one** shared group AI. Created by users; **platform admin does not join** as a member. |

### 10.6.2 Group UI layout

**Desktop (primary)**

```
┌── ~1/3 ──────────────┬── ~2/3 ────────────────────────────┐
│ Human chat           │ Group AI workbench (single thread) │
│ Text / kaomoji        │ Delivered prompts + AI replies     │
│ Images & files       │ Streaming, “thinking…”, long text  │
│ @AI = delivery stub  │                                    │
│ only (no AI essay)   │                                    │
└──────────────────────┴────────────────────────────────────┘
```

**Mobile**

- Default: **human chat only**.
- Enter AI pane via **right arrow / horizontal swipe** (page-slide feel).
- Desktop-first product; mobile is secondary.

### 10.6.3 What may be sent (human track)

| Allowed | Not allowed |
|---------|-------------|
| Plain text | Voice messages |
| Keyboard kaomoji / unicode emoji typed by user | Sticker shop / custom emoji packs |
| Attachments: **images** and **files** | Video, voice clips, etc. |

Attachment button is required; no separate emoji system.

### 10.6.4 @AI occupancy (input lock)

- Typing `@` in the composer does **nothing**. Only the **header @AI button** starts delivery mode.
- When user A clicks @AI:
  - Everyone else’s @AI button is **disabled (grey)**.
  - UI shows **“A is typing…”** and a **shared countdown**.
- **Countdown**: 2 minutes per cycle; **no max renewals**.
- When timer hits 0: modal “Still need to type?”
  - **Need** → add **+2 minutes**; countdown **syncs for all members**.
  - **Don’t need** → release immediately.
  - **No choice within 30s** → treat as don’t need → **auto-release**.
- After send: enter **AI task running** until the assistant **finishes the reply**; only then can anyone @AI again.

### 10.6.5 AI task concurrency (critical)

| Scope | Rule |
|-------|------|
| **Inside one group** | Only **one** AI task at a time. Next @AI only after previous reply **completes**. |
| **Across groups** | Independent — groups may run AI in parallel. |
| **Private AI chats** | Independent of all groups and of each other. |
| **Backend** | Multi-session/multi-room capable; **product lock is per `roomId` only**. Multi-thread APIs may be reserved for later; V1 UI is single-task per group. |

### 10.6.6 Context isolation

- **Human track messages** (no @AI): AI **never** sees them.
- To inform AI: user must **@AI and restate** (or future “forward quote to AI”).
- **AI track** is the only context sent to the model.
- Left side shows only a short **delivery stub** when someone @AIs (no long AI answer on the left).
- Right side: full user delivery + “thinking” + full streaming reply. **All members** (including newcomers) see **full left history and full right AI history**.

### 10.6.7 Files & knowledge bases

| Upload location | Storage | Who can read via AI |
|-----------------|---------|---------------------|
| **Group** | Group knowledge base | **Only that group’s AI**, when user @AI and **selects** attachment(s) |
| **Private chat** | User personal knowledge base | **All of that user’s private AI sessions** may use the full personal library |

- Group files do **not** enter personal KB; personal files do **not** enter group AI.
- On @AI, the chat message may carry **file name / id only**; content is loaded on a **separate RAG/read path** into the AI request.
- **Multi-file select allowed**, with confirm modal: context is limited; prefer one file; multiple is allowed at user risk.

### 10.6.8 Model preferences

| Scope | Slots | Who changes | Cooldown |
|-------|-------|-------------|----------|
| **Group** | chat / image / TTS (one set per group) | Any member | **Shared 5 minutes for whole group** after a change |
| **Private** | Same three slots (per user) | That user | **5 minutes** per user |

- Each change requires a **confirm modal**: “After confirm, cannot change again within 5 minutes.”
- Group model changes **do not** affect private preferences, and vice versa.
- @AI in a group uses **group** model prefs, not the individual’s.

### 10.6.9 Group owner (minimal)

| Rule | Detail |
|------|--------|
| Owner | **Creator** of the group; **cannot transfer / cannot change** |
| Create | At least **2 members** (owner + ≥1 other) |
| Owner powers only | **Disband**, **invite**, **kick** |
| Explicitly out of scope | Co-admins, mute, announcements, etc. |
| Member cap | Default **10**; higher only via **platform admin** grant |

### 10.6.10 Platform admin vs content privacy

| Daily | Exception |
|-------|-----------|
| Admin **cannot** read private or group message bodies | Safety pipeline watches **AI replies** (e.g. refusal / policy lines) using **admin-maintained** keywords/rules |
| Admin manages: stations, model pull/public flags, member-cap grants, functional config | On hit: **alert + push that single dialog**; admin gains **read access only for that dialog** |

**User-facing notice (required when alert fires):**

> 该对话收到 NSFW 警告，平台管理员将拥有该对话框的查阅权限。如需继续对话，请新建对话。

English equivalent for i18n:

> This chat received an NSFW warning. Platform admins can now review **this** dialog. To continue privately, start a **new** chat.

### 10.6.11 Implementation notes (non-binding until build)

Suggested building blocks (for later implementation; not started):

- Entities: `rooms`, `room_members`, `room_messages` (human), `room_ai_messages` or linked `conversations`, `room_files`, `room_model_prefs`, `safety_alerts`.
- Realtime: WebSocket (or similar) for human messages + occupancy/countdown; reuse SSE for AI stream fan-out to room members.
- State machine per room: `idle → occupying_input → ai_running → idle`.
- Safety: rule engine on assistant text → alert row + temporary read grant scoped to one dialog id.

### 10.6.13 AI reply export (docx / pdf) — spec (2026-07-18)

**Goal:** from column c (the AI-reply pane) the user can export **only the AI's replies** as a downloadable file, in **.docx** and **.pdf**. The exported formatting must match what column c shows (headings, bold, tables, lists) — no raw markdown symbols, and **.docx must open cleanly in WPS/Word** (a real OOXML document, NOT HTML renamed to `.doc`).

**Scope of content:** assistant replies only (`room_ai_messages.role='assistant'`, `status='done'`). The `X → AI:` delivery rows and the human chat (column b) are **excluded**. Export includes every done assistant reply in the room's AI thread, in chronological order (one document for the whole thread).

**How (decided):**
- **.docx** — generated **client-side** as a genuine OOXML file with **no new npm dependency**. A `.docx` is a ZIP of XML parts; we build the ZIP (stored/deflated entries) and map markdown → Word-native elements: headings → Word heading styles, `**bold**` → real bold runs, `| tables |` → Word native tables, lists → numbered/bulleted paragraphs. Result opens clean in WPS. (Rationale: avoids native-binary install pain like better-sqlite3/rolldown; keeps parity with column c because both start from the same markdown.)
- **.pdf** — via the **browser print pipeline**: open a print view styled with the *same* `.markdown-content` CSS as column c, call `window.print()`; the user picks "Save as PDF". Pixel-parity with column c, zero server work.
- Both paths start from the **same normalized markdown** (`normalizeMarkdown`) used by column c, so the export looks like what the user saw.

**UI:** an export control in the column-c header (download icon → menu: `.docx` / `.pdf`). Disabled when there are no done assistant replies.

**Non-binding implementation notes:** docx builder is a pure module (`client/src/utils/docx.ts`) with its own unit test; markdown→doc AST reuses `marked`-free hand parsing kept minimal (headings/bold/italic/inline-code/tables/lists/paragraphs — the subset the group AI actually emits).

### 10.6.14 Group pinned note (置顶便签) + edit-permission approval — spec (2026-07-18)

**Goal:** a WeChat-style pinned note at the top of column b (the human-chat pane). It's a shared work log for the group. Placeholder shows grey hint text inviting the user to record work here.

**Permissions:**
- The **owner** can always edit.
- Other members are **read-only** by default.
- A member may **request edit access**; the request is queued for owner review.
- The **owner approves/denies**. On approval that member gains a **persistent edit grant** (can edit the note freely thereafter, until the owner revokes). This is the "grant persistent edit rights" model (chosen over per-change approval).

**Data model (new):**
- `rooms.pinned_note TEXT` (nullable) + `rooms.pinned_note_updated_at`, `rooms.pinned_note_updated_by`.
- `room_note_editors (room_id, user_id, granted_at)` — members (besides owner) with a standing edit grant.
- `room_note_requests (id, room_id, user_id, status pending|approved|denied, created_at, decided_at)` — edit-access requests.

**Routes (new, all under `/api/rooms/:id`, members only unless noted):**
- `PUT /note` — set note body. Allowed if caller is owner **or** has a row in `room_note_editors`. Broadcasts `note` event.
- `POST /note/requests` — member asks for edit access (creates a `pending` request). Broadcasts `note_request` to owner.
- `GET /note/requests` — owner lists pending requests.
- `POST /note/requests/:reqId/decide` — owner sets `approved`/`denied`; approval inserts into `room_note_editors`. Broadcasts `members`/`note_perm`.
- (`DELETE /note/editors/:userId` — owner revokes a grant. Optional V1.)

**UI:** pinned bar at top of column b. Grey placeholder when empty. Pencil/edit affordance: owner + granted editors see an editable field (save/cancel); others see a read-only note with a "request edit" button (→ pending state → owner sees an approve/deny prompt, e.g. in the Manage modal or an inline banner).

**Realtime:** new WS event types `note` (body changed), `note_request` (new pending request), `note_perm` (grant changed). Clients update the note bar / owner's pending list live; poll fallback via room refresh.

### 10.6.15 Top-right toggle cluster + column-c rich rendering (done 2026-07-18)

- **Toggle cluster** (`TopRightToggles`): the fixed theme+language buttons were oversized/grey and clashed with the UI. Restyled smaller, icon-forward, less heavy background. (v0.7.29)
- **Column-c rendering** (done v0.7.28): AI replies render via the private-chat markdown pipeline (`react-markdown` + `remarkGfm` + `normalizeMarkdown` + `.markdown-content`). The first pass is produced in the background — while `thinking`/`streaming` the raw markdown is **not** shown (a "生成回复中…" placeholder is shown instead); once `status='done'` the calibrated, formatted answer appears. Trade-off: column c no longer shows token-by-token streaming (required by the "don't show the raw first pass" ask).

### 10.6.12 Out of scope (explicit)

- Full WeChat clone (moments, friend graph, calls).
- Group co-admin roles.
- Emoji/sticker marketplace.
- Multi-AI-task UI inside one group (backend may reserve; product V1 is single task).
- Platform admin routine content surveillance.

---

## 10.7 Remaining Work — Prioritized Backlog (added 2026-07-12)

> Single consolidated view of everything still open, ranked. The project **builds and runs**; nothing here blocks that. Items are pulled from the roadmap above (Phase 3/4/6) plus a bug/breakpoint sweep on 2026-07-12.

### P0 — Reliability gaps that affect live behaviour

**All three P0 reliability items are now done** (2026-07-13, v0.7.3). Kept here for traceability:

| Item | Where | Status / note |
|------|-------|---------------|
| Round-robin load balancer | `server/src/routes/chat.ts`, `server/src/services/modelInvocation.ts` | ✅ Done (commit 05c2a97) — real per-model RR counter across stations, replacing the earlier random pick. |
| Health-check background job | `server/src/services/healthCheck.ts`, `server/src/index.ts` | ✅ Done — periodic sweep pings `/models` per enabled station in parallel and writes health to DB; started on listen, stopped on SIGINT/SIGTERM (§8.3). Interval override via `HEALTH_CHECK_INTERVAL_MS`. |
| Error handling & retry UI | `client/src/stores/chatStore.ts`, `client/src/components/Layout/ChatArea.tsx` | ✅ Done — failed sends stash their params in `lastFailedSend`; the error banner shows a **Retry** button that re-runs the send without duplicating the user bubble. |

### P1 — Product features users will notice missing

| Item | Note |
|------|------|
| ~~Export / import conversations~~ | ✅ Done (2026-07-14, v0.7.4) text-only. ✅ **Attachments included (2026-07-18, v0.7.19)** — export `version: 2` embeds per-message attachment rows (`id/type/filename/mimeType/url`, typically `data:` URLs already in SQLite); import restores via `INSERT OR IGNORE` on `attachments`; GET messages now joins attachments so re-import is visible in UI. v1 export files still import (no attachments field). |
| ~~Dark / Light theme toggle~~ | ✅ Done (2026-07-15, v0.7.5). `index.css` refactored to dual-theme: `:root` is now LIGHT, `.dark` holds the original dark palette; added `--overlay-2..25` semantic tint scale (black-on-light / white-on-dark) that replaced ~104 hardcoded `rgba(255,255,255,x)` surface tints across 22 tsx files, plus `--code-block-bg`. `themeStore` + `ThemeToggle` (beside LanguageToggle in all 5 mount points), inline no-flash bootstrap script in `index.html` (reads `localStorage['theme']` / OS pref before paint). `theme.*` i18n (zh/en). Role/identity colors (assistant purple `#ab68ff`, accent-green avatars, `text-white` on colored buttons) intentionally left theme-agnostic. |
| ~~Responsive mobile design~~ | ✅ Done (2026-07-15, v0.7.6). Main chat sidebar is now inline on desktop (`md:static w-[260px]`) but a fixed slide-in drawer + tap-to-dismiss backdrop on mobile (`<768px` starts closed; `Layout` initial state from `window.innerWidth`); selecting a conversation/page closes it via a new `onNavigate` Sidebar prop. `RoomsPage` uses a list/detail swap on mobile (list full-width → group full-width with a `md:hidden` back arrow via new `GroupChatLayout` `onBack` prop); the group's own two-pane human/AI split was already responsive (§10.6). The three fixed-column grid tables (`MemoryBrowser` 7-col, `FileBrowser` 5-col, `UserManagement` 6-col) now sit in `overflow-x-auto` wrappers with `min-w` on header+rows — **tables scroll sideways on narrow screens rather than reflowing into stacked cards** (deliberate trade-off: card layouts would be 4 separate redesigns; revisit per-table if wanted). Form/filter grids stack single-column under `sm`. No new lint issues (the `any`/`set-state-in-effect` items are the pre-existing P2 backlog). |
| ~~Group chat realtime~~ | ✅ Done (2026-07-17, v0.7.7). WebSocket push + typing indicator. ✅ **Token streaming (v0.7.20):** `streamInvokeModel` + WS `ai` events with `status: streaming` and growing `content`; UI shows typing cursor while streaming. |

### P2 — Code quality / hardening (no runtime impact)

| Item | Note |
|------|------|
| Remove ~80 `any` — **done for row casts + chat domain** | ✅ Catch-path (v0.7.9) + SQLite row `as any` = **0** (v0.7.17). ✅ Chat domain shapes typed (v0.7.22). |
| ~~Test suite (unit + integration)~~ | ✅ **P2 closeout (v0.7.18).** Server tests now **77** after stream suite (v0.7.20). Client vitest **9**. |
| Bundle code-splitting | ✅ Route lazy (v0.7.10) + vendor `manualChunks` (v0.7.22). Main index **~132 KB / 34 KB gz**. |
| Comprehensive error messages + docs | ✅ **Docs (v0.7.18):** root `README.md`. Error *copy* polish still optional / non-blocking. |

### P3 — Product upgrades (post-P2; user-visible polish)

| Item | Note |
|------|------|
| ~~Export/import with attachments~~ | ✅ Done (v0.7.19). Export version **2** nests `messages[].attachments[]` (data URLs); import writes `attachments` table; GET `/messages` returns attachments for bubble render. |
| ~~Group AI true token streaming~~ | ✅ Done (v0.7.20). `streamInvokeModel` (SSE parse + station failover) + WS fan-out `status:thinking→streaming→done|error`; ~40ms throttle; UI typing-cursor while streaming. Private chat SSE path unchanged. |
| ~~Mobile table card layouts~~ | ✅ Done (v0.7.21). `MemoryBrowser` / `FileBrowser` / `UserManagement`: mobile (`md:hidden`) stacked cards with same actions; desktop (`hidden md:block`) keeps fixed-column grids. No horizontal-scroll requirement on phone. |
| ~~Vendor `manualChunks`~~ | ✅ Done (v0.7.22). `client/vite.config.ts` splits `vendor-react`, `vendor-markdown`, `vendor-icons`, `vendor-zustand`. Main entry ~132 KB / 34 KB gz. |
| ~~Chat domain `any` variables~~ | ✅ Done (v0.7.22). `chat.ts` multimodal / tool-call / memory-context request shapes typed; 0 remaining `: any` / `as any` / `any[]` in that route. |

### Done in the 2026-07-12 sweep (for reference)

- Fixed 4 real bugs: RegexManager form remount/focus-loss, empty group-chat model dropdowns (wrong catalog key), ChatInput object-URL leak, GroupChatLayout impure `Date.now()` in render.
- Wired the already-built §10.6 group chat into the app; added missing `room.*` i18n (zh/en).
- ESLint: `set-state-in-effect` → warn (was error-spamming 10 files); honoured `^_` unused-var convention.
- Local env: rebuilt `better-sqlite3`, installed linux-arm64 rolldown binding (node_modules was macOS-built).

---

## 10.8 Team-readiness backlog — security & multi-user isolation (audit 2026-07-20)

> **Why this exists:** the owner pivoted the goal to an **internal tool for a real team** (multiple users), not a solo personal assistant. A backend audit (2026-07-20) cross-checked the code against §9 + §4.6/§4.8. **Root cause of most items:** the original spec was single-user (§4.6 `MemoryEntry` had no `userId`; §1 "personal assistant"); multi-user (admin/user/guest) + `user_id` columns were **retrofitted**, but per-endpoint auth and per-user data scoping were only partly applied. Nothing here blocks solo use; several become **privacy/integrity holes once teammates share one instance**. Backend findings ranked by value (impact ÷ effort). Frontend/product findings (UX + team features) to be appended from the parallel review.
>
> Line numbers are as-audited on 2026-07-20 and may drift — treat as pointers.

### TC0 — Data-isolation / auth holes (close BEFORE real teammates share it)

| # | Item | Where | Fix |
|---|------|-------|-----|
| 1 | **Memory retrieval leaks across users** | `chat.ts:288` → `embeddings.ts` `vectorSearch` / `retrieveRelevantMemories` | Loads ALL `memory_entries`, no `user_id` filter → one member's memories injected into another's chat. Thread `userId` + `WHERE user_id = ? OR user_id IS NULL`. **Prereq:** `vectorSearch` must also SELECT/return `id`/`conversation_id`/`message_id` (currently omitted → blank ids in semantic-search results, can't open/delete). **✅ Done v0.7.34** — AI chat path scoped by `conv.user_id` (+ legacy NULL); vectorSearch now returns the ids. *(The `/api/memories` HTTP endpoints' own auth/scoping = finding #2, still open.)* |
| 2 | **`routes/memories.ts` has no auth + no scoping** | whole router (`index.ts:44`) | Unauthenticated caller can list/read/**delete**/export everyone's memories. Add `router.use(requireAuth)` + scope by `user_id` (admin sees all). Infra exists — arena already uses `requireAuth`+`requireRole`. **✅ Done v0.7.35** (full router requireAuth + own/legacy scoping; config & maintenance admin-only). |
| 3 | **Conversation ownership not enforced** | `conversations.ts` DELETE `:174` (no auth), PUT `:139`, GET `/:id/messages`; `chat.ts` POST `:119` | Anyone with an id can read/edit/delete another member's private conversation (or flip it public). List/export already scope by user+visibility; mutate/read-by-id don't. Add `requireAuth` + owner/admin guard. **✅ Done v0.7.35** (`canReadConv`/`canModifyConv`; chat send also owner-gated). |
| 4 | **File library: any member can delete any file** | `files.ts` DELETE `:407` | `uploaded_by` recorded but never enforced. Product decision first: shared team KB vs per-user; then guard mutate accordingly. **🟡 Partial v0.7.35** — mutate (delete/reindex/folder rename+delete) now owner|admin. **✅ Done v0.7.44** — reads now isolated too: `visibility` column (default-private, opt-in team), `scope=mine|team` listing, `canSeeFile` gate on detail/chunks, and `filterVisibleFileIds` on both RAG paths (chat injection + `/search`) so private files can't be read/forged across users. |
| 5 | **Hardcoded fallback JWT secret + default admin creds** | `middleware/auth.ts:6`; `database.ts` seed (~`:689`) | `JWT_SECRET` falls back to a known literal → forgeable admin tokens; seeded `admin`/`admin123`. Refuse to boot in prod without a real `JWT_SECRET`; force admin password change on first login. **🟡 Partial v0.7.35** — boot-time guards done (`assertAuthSecurity` refuses prod on default secret; `ADMIN_PASSWORD` env + prod refusal). Forced-password-change-on-first-login UI still todo. |

### TC1 — §9 security items specified but never implemented (see §9 status table)

| # | Item | §9 ref | Note |
|---|------|--------|------|
| 1 | CORS restrict to origin | §9#5 | `cors({origin:'*'})` → set to deployed frontend origin(s). **✅ Done v0.7.34** — `CORS_ORIGIN` env (comma-separated; default still open). |
| 2 | Rate limiting | §9#4 | none → `express-rate-limit` on `/api/chat` + arena; optional per-user daily token cap vs `api_usage_logs`. **✅ Done v0.7.35** — dependency-free `rateLimit` middleware on chat (60/min) + arena (120/min), per-user/IP, env-tunable. (Per-user *token/day cap* still todo → Phase 3.) |
| 3 | API key encryption at rest | §9#1, §4.1 | plaintext → encrypt station `apiKey` (e.g. AES-256-GCM, key from env). **✅ Done v0.7.37** — `utils/crypto.ts` AES-256-GCM (`enc:v1:iv:tag:ct` envelope), opt-in via `ENCRYPTION_KEY` (unset ⇒ plaintext passthrough = prior behaviour; legacy plaintext auto-detected & passed through on read; encrypted-value-with-no-key throws loud). Encrypt on write (create/update/seed), transparent `decryptSecret` at all station-key read sites (both `getStationsForModel` mappers, `rowToStation`, station health route, `embeddings`, `healthCheck`); boot sweep re-encrypts existing plaintext in place. *(memory_config `embedding_api_key` not yet covered — easy follow-up.)* |
| 4 | File upload hardening | §9#2 | 20MB limit only → add type allowlist; malware scan optional. |
| 5 | Memory retention purge | §4.8 `retentionDays`, F-MEM10 | config stored + surfaced in UI but **never enforced** → periodic purge job (`0` = keep forever). **✅ Done v0.7.46** — `services/retention.ts` scheduled sweep (boot + every 6h) deletes `memory_entries` older than the configured window; 0/negative = keep forever; policy read live from `memory_config` each sweep. |

### TC2 — Performance / hardening (new scope; not in original spec)

| # | Item | Where | Note |
|---|------|-------|------|
| 1 | **chat history N+1 + re-parses historical PDFs every turn** | `chat.ts:52-116, 224-227` | Per-history-msg attachment query (N+1) **and** `extractFileText` re-decodes every historical PDF (`pdf-parse`, CPU-blocking) on every turn. Batch attachments once; only extract the NEW message. Biggest pure-perf win; worse under team load. **✅ Done v0.7.45** — attachments now batch-loaded in one `WHERE message_id IN (...)` query grouped by message; migration v5 adds `attachments.extracted_text` cache so a historical PDF/text file is parsed **once** (result persisted, incl. `''` for empty) and read from the column thereafter; the new message's extraction is also written to the cache for next turn. |
| 2 | Full history sent to model, no `LIMIT` | `chat.ts:168-170` | Unbounded prompt size / cost / latency as threads grow. Cap to last N turns — weigh vs §3.3 "maintain context". **✅ Done v0.7.49** — owner decision (2026-07-26): last 20 turns verbatim by default, admin-tunable (`memory_config.history_max_turns`, 0=unlimited), memory-RAG covers older context; sliced before the attachment batch load so dropped turns cost nothing. |
| 3 | Vector search = unbounded full scan + `JSON.parse` per row | `embeddings.ts:249` | Bound by recency/importance as `memory_entries` grows across all users. |
| 4 | No `busy_timeout` pragma | `database.ts:12` (getDb) | `db.pragma('busy_timeout = 5000')` — cheap insurance vs `SQLITE_BUSY` (backup / 2nd process). **✅ Done v0.7.34.** |
| 5 | Redundant per-turn embeddings | `chat.ts:271, 739` (+ 2 auto-save) | Same query embedded 2–4× per turn; dedupe the query embedding. Also `resolveModel` (`:173`) does a station scan whose result is unused (recomputed at `:311`). **🟡 Partial v0.7.45** — the query-side double-embed is gone: the file-RAG search and the memory vector search now share ONE `generateEmbedding(message)` (threaded via a new optional `precomputedEmbedding` param on `retrieveRelevantMemories`). Still open: the 2 auto-save embeddings and the unused `resolveModel` station scan. |

### Data safety (team) — not yet specified anywhere

- **Schema migrations** — **✅ Done v0.7.36 (Phase 2).** Was a stack of swallow-all `try/catch ALTER TABLE`, no `schema_version`, no down-path. Now `server/src/migrations.ts`: a `schema_migrations` ledger + transactional `runMigrations` (each migration's `up` + ledger insert share one transaction → atomic, never half-applied; a throwing migration aborts loudly instead of being swallowed). `SCHEMA_MIGRATIONS` (in `database.ts`) starts at **v1 "baseline" = the whole existing idempotent schema** (`initTables`), which absorbs both a fresh DB and any pre-ledger production DB, then stamps v1. New schema changes append as v2, v3, … single-run migrations. Down-path still deferred (SQLite drop-column pain; `Migration` can carry an optional `down` later). Tests: `migrations.test.ts` incl. the legacy-DB upgrade path.
- **Backups** — **✅ Done v0.7.36 (Phase 2).** `server/src/services/backup.ts`: online, WAL-safe snapshots via native `db.backup()` → `app-YYYYMMDD-HHMMSS.db`, keep-N rotation (`pruneBackups`), an `unref`'d scheduled job (`startBackupJob`/`stopBackupJob`, wired into `index.ts` start/shutdown), all env-tunable (`BACKUP_ENABLED` default on, `BACKUP_DIR` default `data/backups/`, `BACKUP_INTERVAL_MS` default daily, `BACKUP_KEEP` default 7; in-memory DBs skipped). Admin-only `routes/backup.ts` (`GET /api/backups` list+config, `POST /api/backups` snapshot-now — works even if the scheduled job is off, e.g. before a risky import). Tests: `backup.test.ts` (env parse, prune, online round-trip, sweep). Backup **retention/offsite** (litestream / copying snapshots off the box) left to ops.

### Frontend / product — team features & UX (self-assessed 2026-07-20)

> The parallel frontend-review agent hung (~50 min no output, no result, self-terminated), so this is a lighter self-assessment from the client inventory + targeted spot-checks — not a full per-file audit; revisit deeper per chosen item. **Verified gaps:** `MessageBubble` has no copy/regenerate/edit; `Sidebar` has no conversation search; `UsageLogsPage` shows totals (count/tokens/errors) but no per-user / per-model or cost($) breakdown; no user-facing shared prompt/persona library (arena prompts are admin-only battle tooling). Almost all of FE-B is **new scope from the team pivot** — the only collaboration feature the framework actually built is group chat (§10.6).

**FE-A — UX polish (missing standard affordances)**

| Item | Where | Effort | Value | Note |
|------|-------|--------|-------|------|
| Message actions: copy / regenerate / edit-and-resend | `MessageBubble.tsx` | S–M | high | ChatGPT-standard; used constantly; none exist today. **✅ Done v0.7.41** — hover action bar (copy always; regenerate on assistant; edit on user → inline textarea). Backed by `POST /api/conversations/:id/truncate` (rowid-exact, owner-gated); client truncates the turn then re-sends via the existing chat path. Limits: drops that turn's attachments; discards later turns (standard truncate-and-regenerate). |
| Conversation search | `Sidebar.tsx` | M | med–high | No way to find an old chat once the list grows (team pain). **✅ Done v0.7.42** — `GET /api/conversations/search?q=` (`searchConversations`: title LIKE OR message-content EXISTS, list-scoped, wildcards escaped) + a debounced search box in `Sidebar` that swaps the list for results. |
| Code-block copy button | `common/MarkdownMessage.tsx` | S | med | Confirm presence; add if missing. |
| Organize chats: pin / folders / tags | `Sidebar.tsx`, `chatStore` | M | med | Many chats become unmanageable for a team. **✅ Done v0.7.47** (pin + folders; tags deliberately dropped — folder covers the organize need, one concept less). |

**FE-B — Team / collaboration features (new scope)**

| Item | Where | Effort | Value | Note |
|------|-------|--------|-------|------|
| Shared prompt / persona library | new `chat` UI + table | M | high | Builds on v0.7.33 persona: team-reusable roles ("文案","代码审查","翻译") members apply in one click. **✅ Done v0.7.43** — `persona_library` table (migration v3), `GET/POST/PUT/DELETE /api/personas` (`requireAuth`; team-visible read/use, creator-or-admin edit/delete via `canModifyPersona`), `personaStore` + a library section inside the existing `SystemPromptModal` (apply → loads body into the editor; save-current-text-as-persona; inline rename/delete for own). |
| Admin usage & **cost** dashboard | `admin/UsageLogsPage.tsx` + API agg | M | high | Per-user / per-model aggregation + $ cost. Data already in `api_usage_logs`. Top team concern. **🟡 Token usage done (v0.7.38)** — `GET /api/usage/summary` (`computeUsageSummary`) + collapsible per-user/per-model tables in `UsageLogsPage`. **$ cost deferred** (owner chose usage-first; needs a pricing source — per-model unit price table vs built-in map). |
| Per-user quota / budget (UI + backend) | settings + `chat` guard | M+M | high | Monthly token cap per member; pairs with §10.8 TC1 rate/quota. **✅ Done (backend v0.7.39, UI v0.7.40)** — migration v2 `users.monthly_token_limit` (0=unlimited), `services/quota.ts` `checkUserQuota` (this-month `total_tokens` sum), `chat.ts` 429 for over-quota non-admins, `users` API get/set, and an inline `QuotaCell` editor per member in `UserManagement`. |
| File library: team-shared vs private (ownership UI) | `files/FileBrowser.tsx` + backend | M | high | Do together with the TC0#4 backend isolation decision. **✅ Done v0.7.44** — default-private / opt-in team-shared. Migration v4 adds `file_library.visibility` (existing files → `team` to preserve prior behaviour; new uploads → `private`); `GET /files?scope=mine\|team` (mine = own files browsable by folder; team = flat list of `visibility='team'`); `PATCH /:id/visibility` (owner/admin); read gate `canSeeFile` on detail/chunks + `filterVisibleFileIds` on both RAG paths. `FileBrowser` gets a 我的/团队 tab + per-file 🔒/👥 badge & toggle. |
| Member invite / onboarding | `admin/UserManagement.tsx` + `guide` | M | med | Invite link + role assign + first-run guide (`GuideOverlay` exists). **✅ Done v0.7.48** — invite links + role assign + optional invite-only mode (`REQUIRE_INVITE=1`); first-run guide already existed (`GuideOverlay`), not touched. |

> **Classification for the owner (2026-07-20):** TC0 = mostly *incomplete multi-user retrofit* (user_id added, enforcement not); TC1 = *specified in §9 but never built* (遗漏); TC2 + backups = *never planned* (new scope); migrations = §13 *known-open*.

### Recommended sequencing (roadmap, 2026-07-20)

Ordered for a team rollout — *make it safe to invite people → don't lose data → see & control spend → collaborate → polish.* (Owner picked "give me the roadmap".)

- **Phase 0 — ✅ done (v0.7.34):** worst memory cross-user leak closed on the AI path; CORS lockable; `busy_timeout`.
- **Phase 1 — ✅ done (v0.7.35)** "safe to invite teammates" (privacy / authz): TC0 #2 memories auth + per-user scoping, #3 conversation ownership guards, #4 file-delete authz, #5 JWT secret enforcement + default-admin-password (boot guards; forced-change UI deferred); TC1 #2 rate limiting. Effort: M.
- **Phase 2 — ✅ done (v0.7.36)** "won't lose data": versioned schema migrations (`schema_migrations` ledger + transactional runner, replacing the try/catch ALTER stack) + online DB backups (`db.backup()` snapshots, keep-N rotation, scheduled job + admin route). Effort: M.
- **Phase 3 — ✅ done (v0.7.37–v0.7.40)** "see & control spend": API-key encryption at rest (TC1 #3, v0.7.37); admin usage dashboard — per-user/per-model token & request breakdown (FE-B, v0.7.38); per-user monthly token quota with hard 429 enforcement + admin UI to set caps (FE-B + TC1, v0.7.39 backend / v0.7.40 UI). **Deferred (optional):** $ cost figures on the dashboard (owner chose token-usage-first; needs a per-model pricing source). Effort: M.
- **Phase 4 — ✅ done (v0.7.41–v0.7.44) "nice to use together":** message actions copy/regenerate/edit (FE-A, v0.7.41); conversation search (FE-A, v0.7.42); shared prompt/persona library (FE-B, v0.7.43); team-vs-private file library (FE-B + TC0 #4, v0.7.44). Effort: M–L (was splittable; all four shipped).
- **Phase 5 — polish:** TC2 perf (chat N+1 + historical re-parse, history `LIMIT`, vector-scan bound, dedupe embeddings), retention purge (TC1 #5), member invite/onboarding (FE-B), chat organize/pin/folders (FE-A), a11y/keyboard/ARIA. Effort: many small. **🟡 In progress:** chat-path perf **✅ done (v0.7.45)** — batched attachment load (killed the N+1), `attachments.extracted_text` cache (migration v5) so historical PDFs/text files parse once not every turn, and one shared query embedding across file-RAG + memory search. Retention purge (TC1 #5) **✅ done (v0.7.46)** — `services/retention.ts` scheduled sweep enforcing `memory_config.retention_days`. Chat organize (pin/folders, FE-A) **✅ done (v0.7.47)**. Member invite/onboarding (FE-B) **✅ done (v0.7.48)**. History `LIMIT` (TC2 #2) **✅ done (v0.7.49)** — the product call was made: recent-verbatim + memory-RAG hybrid, default 20 turns. **Remaining:** vector-scan bound, a11y.

---

## 11. Configuration File Format

```yaml
# config.yaml — Station configuration (alternative to UI-based config)
stations:
  - name: "Station A"
    baseUrl: "https://api-station-a.example.com/v1"
    apiKey: "${STATION_A_API_KEY}"  # Environment variable reference
    enabled: true

  - name: "Station B"
    baseUrl: "https://api-station-b.example.com/v1"
    apiKey: "${STATION_B_API_KEY}"
    enabled: true

settings:
  healthCheckInterval: 60        # seconds
  requestTimeout: 30000          # milliseconds
  maxRetries: 3
  maxFileSize: 52428800          # 50MB in bytes
```

---

## 12. Change Log

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-06-15 | 0.1.0 | Initial framework document created | Roo |
| 2026-06-15 | 0.2.0 | Added memory store (记忆库) feature: new data models (MemoryEntry, MemoryTag), API endpoints, UI components, frontend structure, and development roadmap phase | Roo |
| 2026-06-15 | 0.3.0 | Phase 1+2+5 implementation: Full project scaffolding (Vite+React+TS, Express+SQLite), station CRUD, model pull/dedup, ChatGPT-style chat UI with streaming SSE, conversation management, model selector, memory store backend (schema, auto-save, search, context, export/import, summarize) | Roo |
| 2026-07-11 | 0.4.0 | Arena MVP (admin): ModelInvocation service, arena tables, battle one-question-multi-answer + single pick, leaderboard by selection count/rate, admin-only UI shell | Claude |
| 2026-07-11 | 0.5.0 | Arena Prompt Lab + Benchmark: prompt library/sets, multi-model & multi-prompt experiments, benchmark runs with manual pass/fail/skip | Claude |
| 2026-07-11 | 0.6.0 | Arena P5: CSV exports, async benchmark runs with polling, concurrency-limited invocation pool | Claude |
| 2026-07-11 | 0.7.0 | Spec only: Collaborative group chat + dual-pane Group AI (human left / AI right), occupancy countdown, per-room single AI task, KB isolation, model cooldown, NSFW single-dialog admin open-window — see §10.6 | Claude + Aurelia |
| 2026-07-11 | 0.7.1 | Cleanup only: archived obsolete screenshots & superseded plans under `trash/` (not deleted); commented deprecated multi_prompt i18n/UI paths; roadmap checkboxes synced to reality | Claude |
| 2026-07-12 | 0.7.2 | Bug/breakpoint sweep on shipped work. Fixed: (1) `RegexManager` `ScriptForm` defined inside render → input focus loss (now a plain render fn); (2) group-chat model dropdowns empty due to wrong catalog key (`text`/`image-gen` → `chat`/`image`); (3) `ChatInput` object-URL leak — unmount cleanup captured empty mount-time array (now a live ref); (4) `GroupChatLayout` `Date.now()` in render (purity) → mount-time state init. Wired the already-built §10.6 group chat into the app (`RoomsPage` + Sidebar entry + Layout route) and added all `room.*` i18n keys (zh/en) that were missing. ESLint: downgraded the over-aggressive `react-hooks/set-state-in-effect` to `warn`, honoured `^_` unused-var convention. Client `tsc -b` + `vite build` and server `tsc` now pass; rooms CRUD smoke-tested end-to-end. Also fixed local env: rebuilt `better-sqlite3` + installed linux-arm64 rolldown binding (node_modules had been populated on macOS). | Claude |
| 2026-07-14 | 0.7.4 | P1: conversation export/import. Backend `server/src/routes/conversations.ts`: `GET /export` streams a JSON download (`{ exportedAt, version:1, conversations:[{...conv, messages:[]}] }`) scoped exactly like the list endpoint (authed user's own all-visibility + public; guests public-only); `POST /import` accepts the wrapped object or a bare array, inserts conv+messages in a single transaction with `INSERT OR IGNORE` (idempotent — re-importing the same file is 0/0), skips malformed entries, returns `{ importedConversations, importedMessages, total }`. Frontend: `conversationApi.downloadExport`/`import` (api.ts, blob download mirrors arena's), `chatStore.exportConversations`/`importConversations` (refreshes list after import), Sidebar footer Export/Import buttons (non-guest) + hidden file input; `sidebar.export*/import*` i18n (zh/en) with `{convs}`/`{msgs}` interpolation. NOTE: attachments (images/files) are NOT in v1 — separate binary storage; TODO left in code + P1 backlog. Smoke-tested end-to-end on a DB copy (create→export→re-import→idempotent re-import→400 on bad body→verified rows in DB); real `data/app.db` untouched. Server `tsc` + client `tsc -b`/`vite build` pass; no new lint issues (the 80 `any` errors are the pre-existing P2 backlog). | Claude |
| 2026-07-13 | 0.7.3 | P0 reliability closeout. (1) Health-check background job: new `server/src/services/healthCheck.ts` (`checkStationHealth()` pings `/models` and writes status; `runHealthCheckSweep()` walks all enabled stations in parallel on a timer, `HEALTH_CHECK_INTERVAL_MS` override, `unref()`ed), started in `index.ts` on listen and stopped on SIGINT/SIGTERM; manual health-check endpoint refactored to reuse `checkStationHealth()` (response shape unchanged). (2) Whole-app failure retry: `chatStore` gains `lastFailedSend` + `retryLastSend`, with a shared `startStream()` helper so the error banner (`ChatArea`) can offer a **Retry** button that reuses the existing user bubble; added `common.retry` i18n (zh/en). (3) Note: round-robin (commit 05c2a97) was already done but the backlog still listed it as open — corrected §8, §10.7, Phase 3. Server `tsc` + client `tsc -b`/`vite build` pass. | Claude |
| 2026-07-15 | 0.7.5 | P1: dark/light theme toggle. `index.css` refactored to a two-theme token system — `:root` is now the **light** palette, `.dark` holds the original dark values (Tailwind's `@custom-variant dark` was already declared but unused). Added a semantic `--overlay-2..25` scale (black-on-light / white-on-dark) that replaces the ~104 hardcoded `rgba(255,255,255,x)` surface tints across 22 tsx files (1:1 alpha mapping, exact substitution), plus `--code-block-bg` for markdown `<pre>`. New `themeStore` (mirrors i18n store: persists `localStorage['theme']`, falls back to `prefers-color-scheme`) + `ThemeToggle` component (Sun/Moon, sits left of LanguageToggle at all 5 mount points). Inline `<script>` in `index.html` sets `.dark` before first paint to avoid flash. Also: `ModelSelector` dropdown `bg-[#2f2f2f]`→`--color-main-surface-tertiary`; `LanguageToggle` base `bg-[rgba(0,0,0,0.35)]`→`--overlay-20` for parity. Left intentionally theme-agnostic: `bg-black/60` modal scrims, accent-button `text-white`, assistant-avatar `bg-[#ab68ff]`, send-button dark icon on green. `theme.*` i18n (zh/en). Client `tsc -b`/`vite build` pass; lint has only the 2 pre-existing `set-state-in-effect` warnings (no new issues). | Claude |
| 2026-07-15 | 0.7.6 | P1: responsive mobile design. (1) **Sidebar drawer** — main chat `Layout` sidebar is now an inline `w-[260px]` column on desktop (`md:static`) but a `fixed` slide-in drawer (`z-40`, `w-[280px] max-w-[85vw]`) with a tap-to-dismiss backdrop (`z-30`, `md:hidden`) on mobile; `sidebarOpen` initial state is viewport-aware (`window.innerWidth >= 768`); added `Sidebar` `onNavigate` prop so selecting/creating a conversation closes the drawer on mobile, and page-nav uses a `goToPage` helper that does the same. (2) **RoomsPage** switched to a list/detail pattern on mobile (`w-full md:w-[280px]` list, hidden once a room opens; detail full-width with a back arrow); `GroupChatLayout` gained an optional `onBack` prop → mobile-only `md:hidden` ChevronLeft in its header (the human/AI dual-pane was already responsive from §10.6). (3) **Data tables** — `MemoryBrowser` (7-col), `FileBrowser` (5-col), `UserManagement` (6-col) fixed-column grids each wrapped in `overflow-x-auto` with matching `min-w` on header + rows so narrow screens scroll sideways instead of crushing. (4) **Forms** — config/create-user grids `grid-cols-2/3` → `grid-cols-1 sm:grid-cols-*`; MemoryBrowser top-bar button labels `hidden sm:inline` (icon-only when tight). **Trade-off (honest):** tables use horizontal-scroll fallback, NOT a mobile stacked-card redesign — usable (swipe to see columns) and far lower risk; a per-table card layout can be done later if wanted. Settings/Arena full-screen pages already used `max-w-3xl mx-auto`/`overflow-x-auto` and were left as-is. Client `tsc -b`/`vite build` pass; lint unchanged from baseline (same 6 pre-existing errors / 5 warnings on touched files — zero new issues, verified via stash). | Claude |
| 2026-07-17 | 0.7.7 | P1: group-chat WebSocket realtime (replace always-on 3s polling). **Server:** pin `ws@8.21.1` + `@types/ws@8.5.12` (exact; 8.18 had GHSA advisories). `server/src/index.ts` now uses `http.createServer(app)` and `attachRoomHub(server)`. New `server/src/services/roomHub.ts`: path `/ws/rooms?token=&roomId=`, JWT query auth + membership gate, heartbeat, `broadcast` / `disconnectUser` / `closeRoom`. `rooms.ts` write paths emit `message` (human), `ai` (thinking + done/error), `room` (occupancy/models/state), `members` (invite/kick), `disband`. **Client:** new `client/src/services/roomSocket.ts` (connect/reconnect backoff/ping); `roomStore` opens a socket per room and only falls back to 3s poll while `socketStatus !== 'open'`. AI pane `status:thinking` shows bouncing dots + `room.thinking` (“正在输入中…” / “Typing…”) — answer still arrives as one chunk (product choice: typing indicator, not token streaming). Vite `/ws` proxy with `ws: true`. Honest deferrals: true multi-member token streaming of AI text; multi-tab same-user fan-out is fine (one socket per open room). | Claude |
| 2026-07-17 | 0.7.8 | P2 start: server test harness + pure unit tests. Added `vitest@^4` (`server` devDep), `vitest.config.ts` (node env, `src/**/*.test.ts`, forks pool), scripts `test` / `test:watch`; `tsconfig` excludes `**/*.test.ts` from `tsc` emit. Extracted `normalizeModelName` to `server/src/services/normalizeModelName.ts` (behaviour unchanged; `routes/models.ts` re-exports; callers in chat/media/prefs/arena/modelInvocation point at the pure module). New suites: `loadBalancer.test.ts` (empty/single/rotate/failover-full-list/independent-keys/no-mutate) + `normalizeModelName.test.ts` (12 table-driven cases). `npm test` → 18 passed; `tsc --noEmit` clean. **Not in this drop:** failover integration, memory search, occupancy FSM, client tests, bundle split, `any` cleanup. | Claude |
| 2026-07-17 | 0.7.9 | P2 type-safety: eliminate all `catch (err: any)`. New `getErrorMessage` + `isAbortError` helpers (`server/src/utils/errors.ts`, `client/src/utils/errors.ts`) with vitest coverage. Bulk-converted every catch-any on client+server to `unknown` and routed `.message` through the helper; special abort/timeout branches in stations/memories/modelInvocation use `isAbortError`. Also typed 6× `db: any` params as `Database.Database` (chat/embeddings/mcpClient). Server `npm test` 24 passed; server+client `tsc` clean. Remaining `any` is mostly SQLite row casts / domain shapes — deferred. | Claude |
| 2026-07-17 | 0.7.10 | P2 bundle: route-level code-splitting. `Layout.tsx` swaps static imports of Settings/UserManagement/UsageLogs/Memory/Files/Arena/Rooms/Guide for `React.lazy` + named-export `.then(m => ({default: m.X}))`; secondary pages render inside `Suspense` with a small Loading fallback (Guide uses null fallback). Chat/Sidebar stay eager. `vite build`: main chunk **487.6 KB / 144.8 KB gz** (was single ~667 KB / ~169 KB gz); 8 lazy page chunks. Client `tsc -b` clean. | Claude |
| 2026-07-17 | 0.7.11 | **Security:** removed hardcoded MIMO relay API key from `seedDefaultStation` in `server/src/database.ts` (present since initial commit). Seed now only runs when `MIMO_API_KEY` env is set (`MIMO_BASE_URL` optional). **Note:** key remains in git history on public + private remotes until history rewrite or key rotation; rotate the relay key at the provider. | Claude |
| 2026-07-18 | 0.7.12 | P2 tests + pure occupancy FSM. (1) `embeddings.pure.test.ts`: cosineSimilarity (identical/orthogonal/opposite/len-mismatch/zero/symmetric/rank) + serializeEmbedding/deserializeEmbedding round-trip & invalid inputs — free pure coverage noted as follow-up in v0.7.8. (2) New `server/src/services/occupancy.ts` pure reducer (`reconcile` / `claim` / `renew` / `release` / `beginAiTask` / `finishAiTask`, injectable clock + `OCCUPANCY_MS`); `occupancy.test.ts` covers expire, re-claim, 409 paths, full claim→renew→begin→finish cycle. (3) `rooms.ts` occupancy + `ai/ask` paths call the pure module and persist via `applyOccupancy` (behaviour-preserving: renew checks holder only, not wall-clock expiry; finish clears occupant fields already null after begin). Server `npm test` **55 passed**; `tsc --noEmit` clean. **Not in this drop:** SQLite row `as any` sweep, invokeModel failover mocks, client vitest, docs polish. | Claude |
| 2026-07-18 | 0.7.13 | P2 type-safety row bite #1. New `server/src/dbRows.ts` with snake_case SQLite shapes: `ConversationRow`/`MessageRow`/`StationRow`/`StationModelRow`/`RoomRow`/`RoomListRow`/`RoomMemberInfoRow` + import payload types. Wired: `conversations.ts` (all `.get`/`.all` + mappers; 0 `as any`), `stations.ts` (CRUD/models/pull/health; 0 `as any`), `rooms.ts` (`getRoom`/`roomToSnap`/`serializeRoom`/`memberInfo`/list + count). Residual 4× `as any` in rooms message/AI/file list queries deferred. Server `npm test` 55 passed; `tsc --noEmit` clean. No runtime behaviour change. | Claude |
| 2026-07-18 | 0.7.14 | P2 type-safety row bite #2. Extended `dbRows.ts` with `MemoryEntryRow` (join alias `user_username`), `MemoryTagRow`, `MemoryConfigRow`, `FileFolderRow`, `FileLibraryRow`, `FileChunkListRow`, `RegexScriptRow`/`RegexPresetRow`/`ConversationPresetRow`. Wired: `memories.ts` (0 `as any`), `files.ts` (0), `regex.ts` + `regexEngine.ts` (0). Server `npm test` 55 passed; `tsc --noEmit` clean. Remaining routes+services `as any` **~88**. No runtime behaviour change. | Claude |
| 2026-07-18 | 0.7.15 | P2 type-safety row bite #3. Extended `dbRows.ts` with room list projections (`RoomMessageListRow`/`RoomAiMessageListRow`/`RoomFileRow`/`InviteUserRow`), `McpServerRow`/`McpToolRow`, `StationModelJoinRow`. Wired: `rooms.ts` residual lists (0 `as any`), `chat.ts` conversation/history/memory_config/station-join row casts (0 `as any`; domain request-body `any` left), `mcp.ts`+`mcpClient.ts` (0), `embeddings.ts`+`modelInvocation.ts` (0). Server `npm test` 55 passed; `tsc --noEmit` clean. Remaining `as any` **~61** (arena ~45). No runtime behaviour change. | Claude |
| 2026-07-18 | 0.7.16 | P2 type-safety row bite #4 (small files). Extended `dbRows.ts` with `UserPublicRow`, `UserModelPrefsRow`, `UsageLogListRow`, `AggregatedModelSourceRow`, `FileChunkSearchRow`. Wired: `models.ts`, `users.ts`, `auth.ts`, `prefs.ts`, `usage.ts`, `media.ts` (image API json shape), `fileProcessor.ts` — all **0 `as any`**. Server `npm test` 55 passed; `tsc --noEmit` clean. Remaining routes+services `as any` **~45, all in arena.ts**. No runtime behaviour change. | Claude |
| 2026-07-18 | 0.7.17 | P2 type-safety row bite #5 (**arena closeout**). Extended `dbRows.ts` with full arena family (`ArenaBattle*`, `ArenaModelProfileRow`, `ArenaPrompt*`, `ArenaExperiment*`, `ArenaBenchmark*`, `CountRow`, `LeaderboardAppearanceRow`, `SelectionCountRow`). Wired entire `routes/arena.ts` (battle/leaderboard/prompts/sets/experiments/benchmarks/export) — **0 `as any`**. Routes+services explicit-`as any` total **0** (was ~176 at start of row sweep). Server `npm test` 55 passed; `tsc --noEmit` clean. No runtime behaviour change. | Claude |
| 2026-07-18 | 0.7.18 | **P2 test/docs closeout.** (1) `invokeModel` gains optional `deps` (`getStations` / `fetchImpl` / `markStationHealth`) + pure `filterStationsForModel`; production path unchanged. `modelInvocation.test.ts`: no-station / HTTP failover+health marks / empty-content skip / all-fail combined errors / AbortError continue. (2) `embeddings.vectorSearch.test.ts` in-memory SQLite harness (rank/limit/threshold/bad JSON/importance tie-break). (3) `asyncPool.test.ts` (order, concurrency cap, env clamp). (4) Client: `vitest` + `errors.test.ts` + `markdown.test.ts` (9). (5) Root `README.md` quick start. Server **72** / client **9** tests green; `tsc` clean. P2 row+test+docs items closed; optional leftovers: chat domain `any` vars, error-copy polish, vendor manualChunks. | Claude |
| 2026-07-18 | 0.7.19 | **P3 start:** conversation export/import includes attachments. Export payload `version: 2` embeds `messages[].attachments[]` (`id/type/filename/mimeType/url` — usually in-DB `data:` URLs; batched attachment load). Import restores attachments with `INSERT OR IGNORE` (idempotent; v1 files without attachments still work). `GET /api/conversations/:id/messages` now returns `attachments` so bubbles show images after re-import. Client: import summary may show attachment count (`sidebar.importDoneWithAtts` zh/en). Server+client `tsc` clean; server tests 72. Remaining P3: group AI token streaming, mobile table cards, optional vendor chunks. | Claude |
| 2026-07-18 | 0.7.20 | **P3:** group AI true token streaming. New `streamInvokeModel` + pure `extractSseContentDelta` in `modelInvocation.ts` (stream:true, station failover, health marks, injectable deps). `rooms.ts` `POST .../ai/ask` uses it and broadcasts WS `ai` events: thinking → streaming (throttled ~40ms) → done/error with full content. `GroupChatLayout` renders streaming content with typing cursor (keeps thinking dots before first token). Tests: +5 (SSE parse + stream order + empty-stream failover) → server **77** passed. Private chat SSE path unchanged. Remaining P3: mobile table cards, optional vendor chunks / domain any. | Claude |
| 2026-07-18 | 0.7.21 | **P3:** mobile stacked-card data tables. `MemoryBrowser`, `FileBrowser`, `UserManagement` each render a `md:hidden` card list (key fields + actions, memory expand/delete preserved) and keep the existing fixed-column grid under `hidden md:block` for desktop. Closes the v0.7.6 horizontal-scroll trade-off for phones. Client `tsc -b` clean; server tests unchanged (77). Remaining P3 optional: vendor `manualChunks`, chat domain `any`. | Claude |
| 2026-07-18 | 0.7.22 | **P3 polish closeout.** (1) Vite `manualChunks`: `vendor-react` / `vendor-markdown` / `vendor-icons` / `vendor-zustand` — main index **132 KB / 34 KB gz** (was ~488 / 145). (2) `chat.ts` domain typing: `ChatContentPart`, `ChatApiMessage`, `ChatRequestBody`, `MemoryContextRow`; static import of `searchFileChunks`; 0 remaining `any` casts in chat route. Server tests 77; client+server `tsc` clean. P3 backlog items closed (optional product work can still appear later). | Claude |
| 2026-07-18 | 0.7.23 | **UX bugfix (user report).** (1) `TopRightToggles` cluster replaces separate fixed Theme/Language buttons so they no longer overlap (login/register/layout). (2) `UserManagement` header uses flex-wrap + `pr-28` so count/create no longer collide with fixed toggles. (3) Memory browser disabled (greyed) until embedding Base URL + API Key + model are configured; empty state CTA opens settings. (4) Sidebar “New chat” opens a menu: Private chat / New group chat; rooms remain invite-only (create modal copy). (5) Sidebar settings label → “设置” / “Settings” (no “中转站” in the nav name). Client `tsc -b` clean. | Claude |
| 2026-07-18 | 0.7.24 | **Virtual placeholder user for group create.** Fixed system user `virtual-placeholder` (stable id) seeded on boot — invite picker only, badge + default-checked; cannot log in / register / admin-delete/modify. Lets solo/local use create a group before real members are known; later invite real users and kick the placeholder. Server+client `tsc` clean. | Claude |
| 2026-07-18 | 0.7.25 | **Group chat UX rework + @AI bugfix (user report).** (1) **Bug: @AI silently did nothing** — a freshly-created group has `chat_model = NULL`, so `POST /ai/ask` returned `400 "no chat model set"` but the client only stored `error` and never rendered it. Fix: `roomStore.ask` now returns the error and the group view shows an error banner; `switchToAi`/submit detect no-model and open the model settings modal with a `needChatModel` prompt. (2) **UI: replaced the left/right dual-track panes** (§10.6 original design, now commented as superseded) **with a single chronological timeline + one composer.** A `群聊 / @AI` toggle above the input switches target: chat = human message to the group; @AI = auto-claims the shared input lock (green border, countdown, +2min renew) and streams the reply. Human msgs, `X → AI:` deliveries, and streaming AI answers interleave by `createdAt`; left-track `ai_stub` rows are dropped (AI track already shows the Q+A). **Backend two-track storage + "AI never reads left chat" privacy invariant unchanged** — this is a view merge only. Client+server `tsc` clean. (Server vitest not run in this container — native `rolldown`/`better-sqlite3` bindings are macOS-built for the user's local run; verified via tsc.) | Claude |
| 2026-07-18 | 0.7.26 | **Group chat layout correction (user report + screenshot).** v0.7.25 over-merged: it collapsed BOTH the human track AND the AI reply track into one timeline, so the AI reply pane (c) vanished after answering. Restored the intended **three-column layout**: (a) room-list sidebar, (b) human free-chat pane, (c) dedicated AI-reply pane on the far right — while **keeping the single composer + 群聊/@AI toggle** from v0.7.25. Pane b renders human msgs only (`ai_stub` rows dropped); pane c renders `X → AI:` deliveries + streaming AI replies; each pane scrolls independently (`endRef` / `aiEndRef`). New i18n keys `room.paneChat` / `room.paneAi`. Client+server `tsc` clean. | Claude |
| 2026-07-18 | 0.7.27 | **Group chat composer/pane fine-tuning (user report).** Three tweaks on top of v0.7.26: (1) the `X → AI:` delivery notice moves back to pane **b** (rendered from the `ai_stub` human-track row) so it reads like a normal chat entry; pane **c** now holds ONLY assistant replies. (2) The composer lives **inside column b** (below its message list) instead of spanning the full width under both panes. (3) When an @AI ask is in flight, pane b shows a transient bot placeholder **“回复正在右侧生成中……”** derived purely from AI-track status (`thinking`/`streaming`) — it disappears automatically once the assistant reply on the right flips to `done`/`error`. New i18n key `room.replyGenerating`. Backend two-track + privacy invariants unchanged. Client+server `tsc` clean. | Claude |
| 2026-07-18 | 0.7.28 | **Group chat column c renders formatted markdown (user request).** Pane c previously showed the AI reply as raw text (`**bold**`, pipe tables, etc.). Now the assistant answer renders through the same pipeline as private chat — `react-markdown` + `remarkGfm` + `normalizeMarkdown` under `.markdown-content` (tables wrapped in `.table-wrapper`) — for a GPT/Claude-style look. Per the "calibrate first, then show" request, the raw first-pass stream is **not** shown while `thinking`/`streaming`; pane c shows a "generating & formatting" indicator (new i18n key `room.formatting`) and reveals the formatted answer only on `status: done`. No extra model round-trip (formatting is client-side render, not a second AI pass); this removes c-pane live token streaming by design. Client+server `tsc` clean. | Claude |
| 2026-07-18 | 0.7.29 | **Spec + start of 3-part group polish (user request).** Wrote §10.6.13 (export AI replies to .docx/.pdf), §10.6.14 (pinned owner-editable work note + edit-permission request/approve), §10.6.15 (compact top-right toggles + c-pane render, done) into the framework so the build follows a written spec. Build order: #1 toggles (done here) → #3 export → #2 pinned note. **#1 done:** `TopRightToggles` restyled from a heavy grey pill (`bg-[var(--overlay-20)]` + border + `px-3 py-1.5 text-sm`) to compact borderless icon buttons (`px-2 py-1 text-xs`, hover-only bg) that blend into the UI. Client+server `tsc` clean. | Claude |
| 2026-07-19 | 0.7.30 | **Fix: client production build was red.** The v0.7.29 batch actually shipped the code for #2 (pinned note §10.6.14 — `NotepadBar`, `roomStore` notepad actions) and #3 (export §10.6.13 — `exportAiReplies`, `markdownToDocx`) beyond what the 0.7.29 row above documents, and `client` `tsc -b` did **not** pass: (1) `roomStore.requestNotepadEdit` was declared `() => Promise<void>` but (like `saveNotepad`) returns `string \| null` → TS2322 in `roomStore` + TS1345 (`if(!err)` on a `void`) in `NotepadBar`; corrected the declared type. (2) `exportableReplies` `useMemo` sat **after** the `if (!currentRoom) return` early-return in `GroupChatLayout` → `react-hooks/rules-of-hooks` error; hoisted it above the guard (only depends on `aiMessages`). Now green: client `tsc -b && vite build` + vitest (client 9 / server 77) all pass. Lesson: run `tsc -b`, not just vitest, before calling a batch done — vitest transpiles without type-checking. | Claude |
| 2026-07-19 | 0.7.31 | **Chore: eliminate all `no-explicit-any` lint errors (eslint 5→0 errors; the 5th was the v0.7.30 rules-of-hooks fix).** Four `any` casts replaced with real types, no behavior change: `api.ts` export-error body → `(err as { error?: string })`; `memoryStore.fetchTags` `getTags().map((t: any) => …)` → dropped the redundant annotation (`getTags` is already typed `{id;name;color?;entryCount}[]`); `regexStore.importPreset(data as any)` → `data as RegexExportData` (the API's declared param type, + import); `RegexManager` placement `<select>` `e.target.value as any` → `as RegexScript['placement']`. Verified: eslint **0 errors** (12 `set-state-in-effect` warnings remain, tracked for later), client `tsc -b && vite build` + vitest (client 9 / server 77) all green. | Claude |
| 2026-07-19 | 0.7.32 | **Refactor: one shared `<MarkdownMessage>` for assistant markdown (dedup).** The `react-markdown` + `remarkGfm` + `normalizeMarkdown` + `.table-wrapper` pipeline was copy-pasted in three places (`MessageBubble`, group-chat column c in `GroupChatLayout`, and `exportAiReplies.replyToHtml`); extracted to `components/common/MarkdownMessage.tsx` as the single source of truth — `react-markdown` import sites **3 → 1**. Also evaluated lazy-loading it to pull `vendor-markdown` (~46 kB gz) off first paint: built a `lazy()` + `Suspense` wrapper, but rolldown-vite still hoists `vendor-markdown` into the entry `<link rel=modulepreload>` (it aggressively preloads near-entry dynamic deps), so the wrapper added indirection with **no initial-load win** — reverted to an eager shared component. No behavior change. Verified: eslint **0 errors**, client `tsc -b && vite build` + vitest (client 9 / server 77) green. | Claude |
| 2026-07-20 | 0.7.33 | **Feature: per-conversation system prompt (persona).** New `conversations.system_prompt` column (idempotent `ALTER TABLE ... ADD COLUMN` in `database.ts`; on `ConversationRow`/server `Conversation` + client `Conversation` type). `routes/chat.ts` injects it as the **leading** `role:system` message — unshifted after the file-RAG + memory-context blocks so the persona sits *before* retrieval context and frames the whole exchange; empty/whitespace = no injection. `routes/conversations.ts`: create & update read/write it (update semantics: `undefined`=keep existing, empty string→`null` clears), export `version:2` carries it automatically via `rowToConversation`, import restores it (v1 / older files → `null`). Self-review proofreading pass unchanged (keeps its own fixed prompt); group chat (rooms) intentionally out of scope. **Client:** `components/chat/SystemPromptModal.tsx` (textarea + Save/Clear; parent mounts it on demand so initial state seeds from the conversation with no set-state-in-effect) opened from a `Wand2` **人设 / Persona** button in the `ChatArea` header (accent-colored when a persona is active); saving when no conversation exists yet lazily creates one from the selected model (`localStorage['selected_model']`) so the persona applies from message #1. `persona.*` i18n (zh/en). Also: exported pure `initTables` from `database.ts` for testability (no behavior change). **Tests:** +3 `database.persona.test.ts` (in-memory `initTables` migration → column present; insert/clear round-trip; legacy insert omitting the column defaults to `null`) → server **80** passed. Verified: server `tsc --noEmit` + vitest 80; client `tsc -b` + `vite build` (index **~142 KB / 36 KB gz**) + eslint **0 errors** (12 `set-state-in-effect` warnings, unchanged baseline). | Claude |
| 2026-07-20 | 0.7.34 | **Team-readiness kickoff — audit + first security batch.** Owner pivoted the goal to an internal team tool; recorded the §9 implementation-status column + new **§10.8** backlog (TC0 isolation/auth holes, TC1 §9-specified-but-unbuilt, TC2 perf, data-safety). **Code (batch 1):** (1) **Memory cross-user leak closed on the AI chat path** — `retrieveRelevantMemories` (`chat.ts`) now takes the conversation owner's id and scopes both vector + keyword-fallback queries to `(user_id = ? OR user_id IS NULL)`; passed `conv.user_id` at the call site so one member's saved memories are never injected into another member's chat (private-chat AI path; the `/api/memories` HTTP endpoints' own auth/scoping is a separate, behaviour-changing follow-up — deferred). (2) **`vectorSearch` correctness** — SELECT+return now include `id`/`conversation_id`/`message_id` (were omitted → blank ids in semantic-search results, couldn't open/delete); added optional `userId` scoping param (omitted = unchanged behaviour). (3) **CORS lockable** — `index.ts` `cors({origin:'*'})` → `CORS_ORIGIN` env (comma-separated origins; default still open so nothing breaks locally). (4) **`busy_timeout=5000`** pragma in `getDb` (cheap `SQLITE_BUSY` insurance). Tests: extended `embeddings.vectorSearch.test.ts` harness (conversation_id/message_id/user_id cols) +2 (returned ids; per-user scoping incl. legacy NULL) → server **82** passed. `tsc --noEmit` clean. No client changes. §10.8 TC0#1 + prereq, TC1#1, TC2#4 marked done. | Claude |
| 2026-07-20 | 0.7.35 | **Phase 1 security batch — multi-user isolation & guardrails (§10.8 TC0/TC1).** (1) **`memories.ts`:** whole router now `requireAuth`; list/search/semantic/context/get/delete/export/summarize scoped to the caller's own (+ legacy NULL) rows, admin sees all; `PUT /config` + `/backfill-embeddings` + `/fetch-embedding-models` are admin-only; `import` stamps `user_id`. (2) **`conversations.ts` + `chat.ts`:** `canReadConv`/`canModifyConv` — `DELETE /:id` (was **unauthenticated**), `PUT /:id`, `GET /:id/messages` now owner|admin (public/legacy still readable); chat `POST` refuses to send into someone else's owned conversation. (3) **`files.ts`:** file delete/reindex + folder rename/delete gated to owner (`uploaded_by`/`created_by`) or admin (reads stay shared team-wide for now). (4) **JWT/admin guardrails:** `assertAuthSecurity()` refuses to boot in production on the default JWT secret (warns in dev); default-admin seed honours `ADMIN_PASSWORD` env, refuses a fresh **prod** start without it, loud warning otherwise. (5) **Rate limiting:** new dependency-free `middleware/rateLimit.ts` (in-memory fixed window, keyed by user id / IP) on `/api/chat` (60/min) + `/api/arena` (120/min), env-tunable (`RATE_LIMIT_*_PER_MIN`); `optionalAuth` mounted first for per-user keys. Tests +3 (rate limiter) → server **85** passed; `tsc` clean; **no client changes**. **Behaviour changes (intended for team):** members see/manage only their own memories, conversations & files; memory config is admin-only; can't write into others' private chats. §10.8 TC0 #2–#5 + TC1 #2 + §9 #4 marked done. | Claude |
| 2026-07-21 | 0.7.36 | **Phase 2 — data safety: versioned schema migrations + online DB backups (§10.8 "Data safety").** **(A) Migrations:** new `server/src/migrations.ts` — a `schema_migrations` ledger (`version` PK / `name` / `applied_at`) + `runMigrations(db, list)` applying each pending migration in ascending order, **each `up` + its ledger insert in ONE transaction** (atomic — a crash or throwing migration rolls back to the last good version, never half-applied) and **aborts loudly on failure** instead of swallowing it like the old `try/catch ALTER` stack; plus `ensureMigrationsTable`/`getAppliedVersions`; rejects non-positive/duplicate versions. `database.ts`: `SCHEMA_MIGRATIONS` with **v1 "baseline-schema" = the entire pre-existing idempotent `initTables`** (CREATE TABLE IF NOT EXISTS + guarded ALTERs), which absorbs BOTH a fresh DB and any pre-ledger production DB (guarded ALTERs no-op on existing columns) then records v1; `getDb()` now calls `runMigrations` not `initTables`. Extracted the non-DDL capability refresh (`require('./routes/stations')`) out of `initTables` into `refreshModelCapabilities`, still run **every boot** (a one-time migration would miss later-seeded rows) → `initTables` is now pure DDL. Exported `DB_PATH`. **(B) Backups:** new `server/src/services/backup.ts` — WAL-safe online snapshots via native `db.backup()` → `app-YYYYMMDD-HHMMSS.db`; `pruneBackups` keep-N rotation; `runBackupSweep` (snapshot + prune); `startBackupJob`/`stopBackupJob` (`unref`'d `setInterval`, skips in-memory DBs + when disabled), wired into `index.ts` on listen + graceful shutdown. Env: `BACKUP_ENABLED` (default on), `BACKUP_DIR` (default `data/backups/` beside the DB), `BACKUP_INTERVAL_MS` (default daily), `BACKUP_KEEP` (default 7). New admin-only `routes/backup.ts` (`requireAuth`+`requireRole('admin')`): `GET /api/backups` (config + snapshot list newest-first), `POST /api/backups` (snapshot now — ignores the `enabled` flag so an admin can force one before a risky import), mounted at `/api/backups`. **Tests:** `migrations.test.ts` (ordering / idempotency / append-only / rollback-on-throw / dup+invalid version / **legacy pre-ledger upgrade preserves data**) + `backup.test.ts` (env parse, filename, prune, online round-trip, sweep) → server **106** passed (+21). `tsc --noEmit` + `tsc` build clean; compiled boot smoke on a temp DB verified `schema_version=1` + a real 40-table snapshot. **No client changes.** §10.8 "Data safety" both items + Phase 2 marked done. | Claude |
| 2026-07-21 | 0.7.37 | **Phase 3 start — API keys encrypted at rest (§10.8 TC1 #3).** New `server/src/utils/crypto.ts`: AES-256-GCM authenticated encryption behind `encryptSecret`/`decryptSecret`/`isEncrypted`/`encryptionEnabled`, self-describing `enc:v1:<iv>:<tag>:<ct>` envelope, 32-byte key = SHA-256 of `ENCRYPTION_KEY` env. **Backward-compatible & opt-in:** no `ENCRYPTION_KEY` ⇒ `encryptSecret` is a passthrough (stores plaintext exactly as before); legacy plaintext is auto-detected (no `enc:v1:` prefix) and passed through on read; an encrypted value present with **no** key throws loudly (rotated/lost-key guard). **Wiring — encrypt on write:** `stations.ts` create + update (only a newly-provided key is re-encrypted; unchanged keeps stored ciphertext) and `database.ts` `seedDefaultStation`. **Transparent decrypt at every station-key read site:** `chat.ts` local `getStationsForModel` mapper, `services/modelInvocation.ts` `filterStationsForModel` (feeds media + arena/invoke), `stations.ts` `rowToStation` + manual health-check route, `services/embeddings.ts`, `services/healthCheck.ts`. **Boot self-heal:** `encryptPlaintextStationKeys(db)` (in `getDb`, after seeds) re-encrypts any existing plaintext rows in place the first time `ENCRYPTION_KEY` is set (transactional, logged, non-fatal). API responses still return the decrypted key (unchanged behaviour — response masking is a separate follow-up, as is `memory_config.embedding_api_key`). **Tests:** `crypto.test.ts` (round-trip, random-IV, idempotent, tamper/GCM-auth reject, wrong-key reject, no-key passthrough, encrypted-without-key throw, at-rest storage integration) → server **116** passed (+10); existing `filterStationsForModel`/embeddings tests unchanged (decrypt is passthrough without a key). `tsc --noEmit` + build clean; compiled prod-path smoke verified fresh-boot-with-key stores ciphertext + read path decrypts, and the legacy-plaintext→set-key boot sweep upgrades in place. **No client changes.** §10.8 TC1 #3 done; Phase 3 cost dashboard + per-user quota still open (FE-B). | Claude |
| 2026-07-21 | 0.7.38 | **Phase 3 cont. — admin usage dashboard (FE-B, token-based).** First **client** change of the team-readiness effort. **Backend:** new `GET /api/usage/summary` in `routes/usage.ts` backed by exported, unit-testable `computeUsageSummary(db, {kind,username,from,to})` — per-user (`requests`, `tokens`, `prompt/completion`, `errors`) + per-model (`requests`, `tokens`, `prompt/completion`) aggregation + `totals` (`requests`, `tokens`, `errors`, distinct `users`), sorted by tokens desc. Tokens summed over `status='ok'` rows only; `errors` counts the rest (all `SUM`s `COALESCE`d → 0, not NULL, on empty sets). No `status` filter by design (would zero the error counts). Admin-only (router already gated). **Frontend:** `UsageLogsPage.tsx` gains a collapsible summary panel (two responsive tables: 按用户 / 按模型) above the raw log; `usageApi.getSummary` + `UsageSummary`/`UsageUserAgg`/`UsageModelAgg` types; `usage.summaryTitle/summaryMeta/byUser/byModel/requests` i18n (zh/en). **Token-based only — no $ yet** (owner picked usage-first; $ needs a pricing source: per-model unit-price table vs built-in map — deferred). **Tests:** `usage.summary.test.ts` (per-user/per-model/totals, from/to + kind filters, empty-set zeros) → server **121** passed (+5). Server `tsc` + client `tsc -b` + `vite build` + eslint (0 errors; 1 pre-existing `set-state-in-effect` warning on the page's load effect, baseline) all clean. §10.8 FE-B usage dashboard token-part done; per-user quota next. | Claude |
| 2026-07-22 | 0.7.39 | **Phase 3 cont. — per-user monthly token quota (backend + enforcement).** **Schema migration v2** — the FIRST real incremental migration riding Phase 2's runner (`SCHEMA_MIGRATIONS` now `[v1 baseline, v2 users-monthly-token-limit]`): `ALTER TABLE users ADD COLUMN monthly_token_limit INTEGER NOT NULL DEFAULT 0` (0 = unlimited), applied once and recorded; validates the ledger end-to-end on a live schema change. **`services/quota.ts`:** `monthStartISO` (UTC 1st, ISO to match `api_usage_logs.created_at`), `getUserMonthlyTokens` (sum `total_tokens` over this-month `status='ok'` rows), `getUserMonthlyLimit`, `checkUserQuota` → `{limit,used,remaining,exceeded}` (unlimited short-circuits; `exceeded` uses already-consumed tokens). **Enforcement:** `chat.ts` POST, right after the ownership guard and before any work, hard-blocks over-quota **non-admin** members with **HTTP 429** (`quota` in the body); admins exempt. **`users` API:** list/get/update SELECTs + `UserPublic`/`UserPublicRow` carry `monthlyTokenLimit`; `PUT /api/users/:id { monthlyTokenLimit }` sets it (clamped to a non-negative int). **Tests:** `quota.test.ts` (month boundary, this-month-ok-only sum, unlimited/under/at/over) + updated `migrations.test.ts` (now asserts the full version set + v2 column, legacy pre-ledger upgrade applies v1+v2) → server **127** passed (+6). `tsc --noEmit` clean. **Behaviour:** none until an admin sets a limit (everyone defaults to unlimited). **Remaining Phase 3:** the admin UI to set per-member limits (backend already settable via the users API); optional $ cost on the dashboard. **No client changes yet.** | Claude |
| 2026-07-23 | 0.7.40 | **Phase 3 COMPLETE — quota admin UI.** `components/admin/UserManagement.tsx` gains an inline `QuotaCell` rendered under each **non-admin, non-placeholder** member (desktop table + mobile card): shows the current cap (`月上限 / Monthly cap`, `无限制 / Unlimited` when 0) with a pencil affordance; clicking reveals a number input + save/cancel (Enter saves, Esc cancels) that calls `userApi.update(id, { monthlyTokenLimit })` and reloads. Client `UserPublic` + `UpdateUserRequest` carry `monthlyTokenLimit`; `users.quotaLabel/quotaUnlimited/quotaEdit` i18n (zh/en). Verified: client `tsc -b` + `vite build` + eslint (**0 errors**; the 1 warning is the pre-existing `fetchUsers()` load effect, baseline). Server unchanged (127 tests). **This closes Phase 3** (§10.8 "see & control spend": encryption v0.7.37 + usage dashboard v0.7.38 + quota backend v0.7.39 + quota UI v0.7.40). Only the optional **$ cost** dashboard figure remains deferred (owner chose usage-first; needs a per-model pricing source). | Claude |
| 2026-07-23 | 0.7.41 | **Phase 4 start (FE-A) — message actions: copy / regenerate / edit-and-resend.** **Backend:** new `POST /api/conversations/:id/truncate { messageId }` (`routes/conversations.ts`) → exported `truncateMessagesFrom(db, convId, messageId)` deletes that message + every message after it **by `rowid`** (monotonic with insert order → exact regardless of `created_at` ties; attachments cascade via FK). Permission mirrors sending (owner/admin; ownerless legacy/guest convs stay open). This is **additive** — the complex streaming chat POST is untouched. **Client:** `conversationApi.truncate`; `chatStore` `regenerateMessage(id)` + `editMessage(id, text)` resolve the (possibly ephemeral) local message to its real DB id via `resolveServerMessageId` (real uuids used directly; `temp-`/`assistant-`/`tts-` ids mapped by position among persisted non-tts messages), call `truncate`, trim the local thread, then re-send through the existing `doSendMessage` (regenerate re-sends the prompting user text; edit re-sends the new text). Model = `localStorage['selected_model']` → conv model fallback. `MessageBubble` gains a hover action bar (`Copy` on all → clipboard + tick; `Regenerate` on assistant; `Edit` on user → inline autofocus textarea, Cmd/Ctrl+Enter saves, Esc cancels); hidden on the streaming placeholder / disabled while streaming. `message.copy/regenerate/edit/saveResend` i18n (zh/en). **Known limits (MVP):** regenerate/edit drop that turn's attachments and discard later turns (standard truncate-and-regenerate; no branch/confirm). **Tests:** `conversations.truncate.test.ts` (target+after by insert order, conversation isolation, not-found, last-only) → server **132** (+5). Server `tsc` + client `tsc -b` + `vite build` + eslint (**0 err / 0 warn** on touched files) all clean. §10.8 FE-A message actions done; conversation search + shared prompt library + team/private files remain in Phase 4. | Claude |
| 2026-07-23 | 0.7.42 | **Phase 4 (FE-A) — conversation search.** **Backend:** `GET /api/conversations/search?q=` in `routes/conversations.ts` → exported `searchConversations(db, userId, q, limit=50)`: matches `title LIKE ?` OR `EXISTS(SELECT 1 FROM messages WHERE conversation_id = c.id AND content LIKE ?)`, scoped exactly like the list endpoint (authed: own all-visibility + public + legacy ownerless; guest: public only), LIKE wildcards (`%`/`_`/`\`) escaped with `ESCAPE '\'`, ordered `updated_at DESC`, capped at 50. Empty `q` → `[]`. **Client:** `conversationApi.search`; `Sidebar` gets a debounced (250ms) search box above the list — while the query is non-empty the list is replaced by server results (title + content matches), with searching / no-results / empty states; a clear (✕) button resets. `sidebar.searchPlaceholder/searching/noSearchResults` i18n (zh/en). Debounce effect keeps all `setState` inside the async timeout callback (no synchronous set-state-in-effect → no new lint warning). **Tests:** `conversations.search.test.ts` (title match, content match, scope excludes others' private, guest public-only, wildcard escape, order) → server **138** (+6). Server `tsc` + client `tsc -b` + `vite build` + eslint (**0 err / 0 warn** on touched files) clean. §10.8 FE-A conversation search done; Phase 4 remaining: shared prompt/persona library, team-vs-private files. | Claude |
| 2026-07-24 | 0.7.43 | **Phase 4 (FE-B) — shared persona / prompt library.** Team-reusable roles ("文案","代码审查","翻译") a member applies to a conversation in one click; builds on the v0.7.33 per-conversation persona. **Backend:** schema **migration v3** (`SCHEMA_MIGRATIONS` now `[v1 baseline, v2 quota, v3 persona-library]`) creates `persona_library` (`id/title/body/description/created_by→users(id) ON DELETE SET NULL/created_at/updated_at`, index on `created_at`). New `routes/personas.ts` (mounted `/api/personas`, whole router `requireAuth`): `GET /` lists the whole shared library (everyone sees all, `LEFT JOIN users` for `owner_username`, newest-first); `POST /` creates (title+body required, stamped `created_by`); `PUT /:id` + `DELETE /:id` gated by exported `canModifyPersona` (**creator or admin only**; ownerless personas are admin-only — mirrors the Phase 1 files/memories ownership split). `dbRows.PersonaLibraryRow`. **Client:** `Persona` type + `personaApi` (list/create/update/delete) + `personaStore` (zustand; `fetch`/`create`/`update`/`remove` + a `canModifyPersona(persona, user)` helper mirroring the server rule). The existing **`SystemPromptModal`** gained a team-library section below the per-conversation textarea: each entry has an **Apply** action (loads its `body` into the editor — no auto-save, so the member can tweak before committing), a **save-current-text-as-persona** inline form (bookmark button, enabled once the textarea is non-empty), and inline **rename**/**delete** (pencil/trash, shown only for personas the user may modify). `persona.libraryTitle/libraryDesc/libraryEmpty/apply/saveAs/namePlaceholder/rename` i18n (zh/en). **Tests:** `personas.test.ts` (v3 migration creates the table + records version 3; `canModifyPersona` creator/admin/other/unauth/ownerless matrix) → server **144** (+6). Server `tsc` + client `tsc -b` + `vite build` + eslint (**0 err**; 12 pre-existing `set-state-in-effect` warnings, baseline — none on the new files) all clean. §10.8 FE-B persona library done; **Phase 4 remaining: team-vs-private file library only.** | Claude |
| 2026-07-24 | 0.7.44 | **Phase 4 COMPLETE (FE-B + TC0 #4) — default-private, opt-in team-shared file library.** Closes the last Phase 4 item and the long-standing file-isolation hole (reads were team-wide; only mutation was owner-gated since v0.7.35). **Owner decisions:** new uploads default **private**; existing files migrate to **team** (preserve current visibility); team view is a **flat list** (folders stay a per-user "mine" concept). **Backend:** schema **migration v4** (`SCHEMA_MIGRATIONS` now `[…, v4 file-library-visibility]`) adds `file_library.visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','team'))`, then `UPDATE …SET visibility='team'` on all existing rows + an index. `dbRows.FileLibraryRow`/server `FileLibraryEntry` carry `visibility`. Two new exported helpers in `routes/files.ts`: `canSeeFile(user,row)` (admin | uploader | team | legacy-ownerless) and `filterVisibleFileIds(db,ids,user)` — **the RAG isolation gate**. Wiring: `GET /` now takes `scope=mine|team` (mine = caller's own files browsable by folder, *even admins see only their own here*; team = flat `visibility='team'`, no folders); `GET /:id` + `/:id/chunks` gated by `canSeeFile` (→404 if not); **both RAG entry points** now filter through `filterVisibleFileIds` — `chat.ts` file-context injection (by sender) and `POST /search` (client ids gated; empty ids = "everything I can see", was **everything team-wide**); new `PATCH /:id/visibility` (owner/admin, `canMutateOwn`); upload stamps `visibility:'private'`. **Client:** `FileLibraryEntry.visibility` + `fileApi.list({scope})`/`setVisibility` + `fileStore` `scope`/`setScope`/`setVisibility`. `FileBrowser` gets a **我的文件 / 团队共享** tab bar (team view hides upload/new-folder/breadcrumb), a per-file 🔒private/👥team badge that's a click-to-toggle for own files (admins too), on both the desktop table + mobile cards. `files.scopeMine/scopeTeam/visPrivate/visTeam/makePrivate/makeTeam/teamEmpty` i18n (zh/en). **Tests:** `files.visibility.test.ts` (`canSeeFile` matrix + `filterVisibleFileIds` cross-user isolation) + migration v4 assertions in `migrations.test.ts` (column present on fresh DB; existing rows → team) → server **156** (+12 across the two). Server `tsc` + client `tsc -b` + `vite build` + eslint (**0 err**; 11 pre-existing warnings, none on new code) all clean. **This closes Phase 4** (message actions v0.7.41, conversation search v0.7.42, persona library v0.7.43, file visibility v0.7.44). | Claude |
| 2026-07-24 | 0.7.45 | **Phase 5 start — chat-path performance (TC2 #1 + #5).** Pure speedups on the streaming chat handler; **no change to what the model sees**. **(1) Historical PDFs no longer re-parsed every turn.** New schema **migration v5** (`SCHEMA_MIGRATIONS` now `[…, v5 attachment-extracted-text-cache]`) adds `attachments.extracted_text TEXT` (`dbRows.AttachmentRow`); `chat.ts` gains an `extractCached` helper — a historical attachment returns its cached text when the column is set and only calls `extractFileText` (CPU-blocking `pdf-parse`) on a **miss**, persisting the result (`extracted ?? ''`, so empty/unsupported files aren't re-parsed either; `'' → null` on read). The current turn's new attachments write their extraction into the same column so next turn is a hit. Contract: `NULL` = never parsed, `''` = parsed-but-empty, non-empty = cached text. **(2) Attachment N+1 removed.** The per-history-message `SELECT … WHERE message_id = ?` inside the build loop is replaced by ONE `WHERE message_id IN (…)` batched before the loop, grouped into a `Map` (rowid order within a message preserved). **(3) Query embedding de-duplicated.** The same query text was embedded twice per turn (file-library RAG + memory vector search); now computed at most once (`sharedQueryEmbedding`) and threaded into `retrieveRelevantMemories` via a new optional `precomputedEmbedding` param (keyword/fallback paths unchanged; when no files are attached, memory still computes its own once — no regression). **Deferred (not pure perf):** history `LIMIT` (TC2 #2 — context-retention product tradeoff), vector-scan bound (#3), the unused `resolveModel` scan (#5 tail). **Tests:** `chat.attachmentCache.test.ts` (v5 column contract: NULL default, cache write/read, `''`↔empty round-trip, batched grouping) + migration v5 assertion → server **160** (+4). `tsc --noEmit` clean. **No client changes.** §10.8 TC2 #1 done, #5 query-embedding half done. | Claude |
| 2026-07-26 | 0.7.46 | **Phase 5 — memory retention purge (TC1 #5 / F-MEM10 / §4.8 `retentionDays`).** The retention setting has been stored in `memory_config` and editable in the Memory settings UI since v0.3.0, but **nothing ever purged** — memories lived forever regardless. New **`services/retention.ts`**: `runRetentionSweep(db, now)` reads `retention_days` LIVE from the `memory_config` single row (so an admin change applies on the next sweep, no restart) and deletes `memory_entries` with `created_at < cutoff`; `retentionCutoff(days, now)` emits the SQLite `datetime('now')` format (`YYYY-MM-DD HH:MM:SS`, UTC) so plain string comparison is correct; `0` (the DB default) or negative → keep forever (never purges). `startRetentionJob()` runs one sweep ~30s after boot (config changes don't wait a full interval) then every 6h; both timers `unref`'d; idempotent; `stopRetentionJob()` wired into SIGINT/SIGTERM alongside health-check/backup. Env: `RETENTION_ENABLED` kill-switch (default on — safe because the default policy is keep-forever) + `RETENTION_SWEEP_INTERVAL_MS`; the *policy* (how many days) deliberately stays in the DB where the admin UI edits it, instance-wide (same scope as auto-save / context-injection — `memory_config` is a single row). **Tests:** `services/retention.test.ts` (env parse defaults/kill-switch/garbage-interval fallback; cutoff format; keep-forever default; boundary semantics — 1s-too-old purged, exactly-at-cutoff kept; negative-days = keep; live config pickup mid-process) → server **167** (+7). `tsc --noEmit` clean. **No client changes** (the UI for `retentionDays` already existed). §10.8 TC1 #5 done. | Claude |
| 2026-07-26 | 0.7.47 | **Phase 5 — chat organize: pin + folders (FE-A).** Sidebar chats become manageable for a team: pin what matters, group the rest. **Backend:** schema **migration v6** (`SCHEMA_MIGRATIONS` now `[…, v6 conversations-organize]`) adds `conversations.pinned INTEGER NOT NULL DEFAULT 0` + `conversations.folder TEXT` (free-text label; **no separate folders table** — a folder exists iff a conversation carries its name, mirroring the file-library folder approach). `dbRows.ConversationRow` + server/client `Conversation` carry `pinned`/`folder`. PUT `/api/conversations/:id` now runs through an exported pure `computeConversationUpdate(existing, body)` (replaces the inline field merging): `pinned` undefined=keep / truthy→1 / falsy→0; `folder` undefined=keep, string→set (trimmed; empty/whitespace/non-string→null), null→remove. The list endpoint orders `pinned DESC, updated_at DESC` (both auth branches; search stays flat by recency). Ownership unchanged (`canModifyConv` already gates PUT). **Client:** `conversationApi.update` + `chatStore.updateConversation` accept `pinned`/`folder`; after a pin toggle the store re-sorts locally to mirror the server ORDER BY (no refetch). `Sidebar` renders 3 groups when not searching — **已置顶/Pinned** (header + rows), **collapsible folders** (chevron + name + count; collapse state is component-local), then loose chats; search results stay a flat list. Each row gains hover actions **pin/unpin** (Pin/PinOff) and **move-to-folder** (FolderInput) opening a per-row dropdown: existing folders, 移出文件夹 when foldered, and a new-folder input (Enter/Esc). Pinned rows show a small always-visible pin glyph (useful inside search results). `sidebar.pin/unpin/pinnedSection/moveToFolder/removeFromFolder/newFolderPlaceholder` i18n (zh/en). **Tests:** `conversations.organize.test.ts` (v6 defaults; keep/set/clear + trim + non-string-folder semantics; 1/0 coercion; UPDATE round-trip; pinned-first ordering) + v6 column assertions in `migrations.test.ts` → server **173** (+6). Server `tsc` + client `tsc -b` + `vite build` + eslint (**0 err** on touched files) all clean. §10.8 FE-A chat organize done (tags dropped by design). | Claude |
| 2026-07-26 | 0.7.48 | **Phase 5 — member invite / onboarding (FE-B).** How a teammate actually gets onto the instance, without the admin hand-creating accounts. **Backend:** schema **migration v7** (`SCHEMA_MIGRATIONS` now `[…, v7 invites]`) creates `invites` (`id`, UNIQUE `code`, `role user|admin`, `created_by→users ON DELETE SET NULL`, `max_uses` (0=unlimited, default 1), `used_count`, `expires_at` (NULL=never), `revoked` flag, `created_at`; index on code). New **`services/invites.ts`** (pure, unit-tested): `generateInviteCode` (18-byte base64url ≈142 bits), `requireInvite` env parse, `validateInvite` (not_found/revoked/expired/exhausted — precedence in that order; `max_uses=0` never exhausts), `getInviteByCode`/`consumeInvite`. **`/api/auth/register`**: an offered code must validate (400 with a reason otherwise); a valid one stamps the invite's **role** onto the new account and consumes one use **after** the INSERT; with **`REQUIRE_INVITE=1`** registration without a code is refused (403) — default stays open-registration (prior behaviour). **`/api/users/invites`** (admin router, registered BEFORE `/:id` so the path never parses as a user id): GET list (creator username joined), POST mint (`role`/`maxUses`/`expiresInDays`), DELETE `/:inviteId` = **revoke flag, not row delete** (audit trail survives). **Client:** `Invite` type + `inviteApi` (in `services/auth.ts`, admin-token helper); `UserManagement` gains a collapsible **邀请成员** panel — mint form (role/uses/expiry), list (code, role, used/∞, expiry, status 有效/已撤销/已过期/已用完, copy-link, revoke); invite links are `origin/?invite=CODE` — `App.tsx` starts on the **register** view when the param is present and `RegisterPage` prefills a new invite-code field (Ticket icon) passed through `authStore.register`. `register.inviteCode*`, `invites.*`, `users.roleAdmin/roleUser` i18n (zh/en). **Tests:** `services/invites.test.ts` (code charset/uniqueness; env parse; validate matrix incl. revoked-beats-expired + unlimited uses; v7 round-trip: consume-until-exhausted, admin-role carry, revoke-is-a-flag) → server **181** (+8). Server `tsc` + client `tsc -b` + `vite build` + eslint (0 err; 1 pre-existing baseline warning) all clean. §10.8 FE-B member invite done. | Claude |
| 2026-07-26 | 0.7.49 | **Phase 5 — history LIMIT (TC2 #2): recent-verbatim + memory-RAG hybrid.** Closes the last unbounded-cost item on the chat path. **Owner decision (2026-07-26, plain-language options presented):** default **20 turns** of verbatim history per request, admin-tunable, `0` = unlimited (old behaviour); anything older is covered by the existing memory-store RAG injection (F-MEM05) — short-term memory = raw text, long-term memory = vector retrieval. **Backend:** schema **migration v8** (`SCHEMA_MIGRATIONS` now `[…, v8 memory-config-history-max-turns]`) adds `memory_config.history_max_turns INTEGER NOT NULL DEFAULT 20` (lives beside the other context knobs like `max_context_memories`; instance-wide single row). `chat.ts` gains pure exported `limitHistory(rows, maxTurns)` (keeps the LAST `maxTurns*2` messages — 1 turn = user+assistant; ≤0/garbage = identity; the just-inserted current user message is always inside the window) + `getHistoryMaxTurns(db)` (live read, negative column falls back to 20). Applied **BEFORE** the v0.7.45 attachment batch load, so dropped turns' attachments are never fetched or extraction-cached at all — the cap is also a perf win, not just a cost cap. Memory auto-save & RAG paths untouched (they see the full message). **Config surface:** GET/PUT `/api/memories/config` carry `historyMaxTurns` (PUT clamps to a non-negative int; admin-only as before). **Client:** `MemoryConfig.historyMaxTurns`; Memory settings panel gains a **对话原文保留轮数** number input (saves on blur/Enter, 0 = 不限制) under the auto-save/context-injection toggles; `memory.historyTurns/historyTurnsDesc` i18n (zh/en). **Tests:** `chat.history.test.ts` (limitHistory: unlimited/garbage identity, window slice keeps newest tail, at/below window passthrough, odd counts, fractional floor; getHistoryMaxTurns: v8 default 20, live 50/0 round-trip, negative→default) + v7/v8 assertions in `migrations.test.ts` → server **189** (+8). Server `tsc` + client `tsc -b` + `vite build` + eslint (0 err; 1 baseline-pattern warning) all clean. §10.8 TC2 #2 done — **Phase 5 remaining: vector-scan bound (TC2 #3), a11y.** | Claude |
| 2026-07-26 | 0.7.50 | **Chore — full-project redundancy/residue audit (owner request: check for leftovers from interrupted/haywire agent sessions).** Swept: stray files, git health (`git fsck` clean; dangling objects are normal amend/rebase leftovers), merge-conflict markers (none), duplicate cross-file functions, unreferenced client files (all 10 hits are `React.lazy` chunks — false positives), i18n key parity/duplicates/usage, client↔server API surface, SQL placeholder/value pairing (memories PUT 11/11 ok), dead dependencies. **Fixed (the one real bug): group-notepad i18n three-way mismatch** — code, `zh`, and `en` disagreed on key names (`notepadRequestSent` existed in NEITHER locale → raw key text rendered in both languages; `notepadTitle` missing from `en` → raw key in English UI). Both locales now carry exactly the 12 keys the code uses (renamed `zh notepadRequestPending`/`en notepadRequested` → `notepadRequestSent`; `en notepad` → `notepadTitle` 'Work log'); dropped never-referenced `notepadSaved/notepadEditors/notepadRevoke/notepadUpdatedBy/notepadSaveFailed` (grep-verified: no dynamic notepad key construction). **Documented debt (deliberately NOT touched — report only):** (1) dead deps: server `dotenv` + `node-fetch` (Node 22 global fetch), client `react-router-dom` + `react-textarea-autosize` (never imported; app navigates by state) — removal needs a lockfile regen, deferred to a networked session; (2) `getStationsForModel` near-duplicate in `chat.ts` vs `services/modelInvocation.ts` (chat's copy skips roundRobin + decrypts inline) — merging means touching the live streaming path, do it with tests when TC2 #5's `resolveModel` double-scan (line ~268 early-503 + ~421 recompute; already logged) is fixed; (3) ~50 'unused' i18n keys are mostly dynamic-usage false positives (`guide.stepN*` via `titleKey`), a true-dead subset needs case-by-case review; (4) local-only clutter (`.DS_Store`, `截图/`, `_to_delete/` git-lock scraps, ~94 `.git/objects/tmp_obj_*` from the no-unlink mount) is all gitignored/untracked — owner can delete `_to_delete/` + tmp_obj files by hand. `rooms.ts reconcileOccupancy` is an intentional impure wrapper over the pure FSM, not duplication. Client i18n zh/en now **592=592 keys, zero diff**. Verified after fix: server 189 tests, `tsc` ×2, `vite build`, eslint 0 err. | Claude |
| 2026-07-26 | 0.7.51 | **Chore — i18n dead-key purge (closes v0.7.50 audit item #3).** Methodology (owner asked whether this needed human judgement — it doesn't, it needs exhaustive mechanical verification): enumerate ALL non-literal `t()` call sites project-wide (exactly 3: `GuideOverlay` `t(step.titleKey)`/`t(step.descKey)` over a 6-step array → `guide.step1-6Title/Desc`; `SettingsPage` `t(\`settings.howItWorksStep${i}\`)` over `[1..6]` → `howItWorksStep1-6`), mark those 18 keys dynamic-used; re-check the 6 apparent 'still referenced' suspects with exact-quoted-match (all were **substring false positives** — e.g. `conversation.visibility` matched inside `conversation.visibilityDesc`); every remaining suspect grep-verified zero-referenced in ANY context (code, index.html, css). Result: **34 dead keys removed from both locales** (incl. `app.name`, the `room.toAi/toHuman/thinking` group from the superseded v0.7.25 single-timeline design, `settings.exposeAll/hideAll` from the dropped bulk-toggle UI, `memory.maxContext*` — the knob v0.7.49 deliberately did NOT reuse). zh = en = **554 keys**, still zero diff; verified no code-required key missing. Client `tsc -b` + `vite build` + eslint clean; server 189 tests untouched. | Claude |

---

## 13. Notes & Open Questions

- [x] Should we support WebSocket in addition to SSE for bidirectional communication?
  - **Update 2026-07-11**: Collaborative human chat (§10.6) **expects** a bidirectional channel (WebSocket or equivalent) for occupancy/countdown and human messages; AI stream may remain SSE fan-out.
  - **Update 2026-07-17 (v0.7.7)**: WebSocket hub shipped for §10.6 rooms (`/ws/rooms`). Private chat remains SSE for AI streaming; rooms use WS push + whole-chunk AI answers with a typing indicator (token streaming deferred).
  - **Update 2026-07-18 (v0.7.20)**: Room AI token streaming over WS (`streamInvokeModel` + `status:streaming` events). Private chat still SSE.
- [x] Multi-user support or single-user local deployment?
  - Multi-user (admin / user / guest) already in product; group chat extends this.
- [x] Schema migrations & backups for a shared team DB? (raised in §10.8 "Data safety")
  - **Resolved 2026-07-21 (v0.7.36, Phase 2)**: versioned `schema_migrations` ledger + transactional `runMigrations` (v1 baseline = the existing idempotent schema, so it absorbs pre-ledger production DBs; new changes append as v2+, one transaction each, fail-loud). Online `db.backup()` snapshots with keep-N rotation, an `unref`'d scheduled job (`BACKUP_*` env), and an admin `GET`/`POST /api/backups` route. **Deferred:** down-migrations (SQLite drop-column pain — `Migration` can carry an optional `down` when first needed); offsite copy / long-term retention of snapshots (ops concern, e.g. litestream or syncing `data/backups/` off the box).
- [ ] Should model capabilities be auto-detected or manually configured?
- [ ] Database migration strategy if schema evolves?
- [x] Support for custom system prompts per conversation?
  - **Done 2026-07-20 (v0.7.33)**: per-conversation persona stored in `conversations.system_prompt`, injected as the **leading** `role:system` message (before file/memory RAG) in `routes/chat.ts`. Edited via the 人设 / Persona button in the chat header (`SystemPromptModal`); `undefined`=keep, empty→clear; carried through export v2 / import. Group chat (rooms) not included. See §12 (v0.7.33).
- [ ] Occupancy renew max (product currently: unlimited 2‑minute renewals)?
- [ ] Safety keyword list UX for platform admins?

---

> **Reminder**: This document is the single source of truth. Every development step must be reflected here. Never delete content — only comment it out with `<!-- ... -->` when superseded.
