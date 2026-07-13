# Multi-Model AI Integration Platform — Framework Document

<!-- > **Version**: 0.7.1 -->
<!-- > **Last Updated**: 2026-07-11 (v0.7.1 — cleanup: trash/ archive + comment deprecated multi_prompt strings; §10.6 still not implemented) -->
> **Version**: 0.7.2
> **Created**: 2026-06-15
> **Last Updated**: 2026-07-12 (v0.7.2 — bug/breakpoint sweep across shipped work; wired the already-built group-chat UI (§10.6) into the app; fixed 4 real bugs; see §12 change log)
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

| # | Concern | Mitigation |
|---|---------|------------|
| 1 | API keys stored locally | Encrypt at rest using AES-256; never expose in frontend |
| 2 | File upload risks | Validate file type, limit size (50MB), scan for malware |
| 3 | Prompt injection | Sanitize file content before sending to model |
| 4 | Rate limiting | Implement per-model and per-station rate limits |
| 5 | CORS | Restrict to frontend origin only |

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
- [ ] Dark/Light theme toggle
- [ ] Responsive mobile design — desktop-first; group-chat pane slide done (§10.6), rest still desktop-first
- [ ] Export/import conversations
- [x] Group chat / Group AI (§10.6) — wired into app 2026-07-12 (RoomsPage + Sidebar entry); realtime still poll-based, WebSocket deferred

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
- [ ] Performance optimization — client bundle is one 660 KB chunk; consider route-level code-splitting
- [ ] Comprehensive error messages
- [ ] Documentation
- [ ] Testing (unit + integration) — **no test files exist yet**; root `npm test` is still the placeholder
- [ ] Type-safety cleanup — remove ~80 `any` (mostly `catch (err: any)`; a few `as any` casts). See §10.7 for priority. Not a runtime bug; reduces future-proofing.

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
> **Status**: **Implemented (V1)** as of 2026-07-12. Backend (`server/src/routes/rooms.ts`, 17 endpoints), `roomStore`, `roomApi`, and `GroupChatLayout` were built earlier but left unwired; now reachable via Sidebar → "Group Chats" → `RoomsPage` (list + create + open). WebSocket realtime is still deferred — human/AI tracks poll every 3s (see `roomStore.openRoom`). i18n `room.*` keys added for zh/en.  
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
| Export / import conversations | Memory has export/import; **conversations do not**. |
| Dark / Light theme toggle | No theme system yet. |
| Responsive mobile design | Desktop-first everywhere except the group-chat pane slide (§10.6). |
| Group chat realtime | Currently 3s polling (`roomStore.openRoom`). WebSocket for occupancy/countdown + AI stream fan-out is deferred (§13). |

### P2 — Code quality / hardening (no runtime impact)

| Item | Note |
|------|------|
| Remove ~80 `any` | Overwhelmingly `catch (err: any)` (define a small `errMessage(e: unknown)` helper and reuse) plus a few `as any` casts that each need a real type. Improves future-proofing, not behaviour. |
| Test suite (unit + integration) | **Zero tests today.** Highest-value targets: `normalizeModelName` dedup, station failover/RR, memory search, room occupancy state machine. |
| Bundle code-splitting | Client is a single ~660 KB JS chunk; route-level `import()` would cut first-load. |
| Comprehensive error messages + docs | Phase 6 polish. |

### Done in the 2026-07-12 sweep (for reference)

- Fixed 4 real bugs: RegexManager form remount/focus-loss, empty group-chat model dropdowns (wrong catalog key), ChatInput object-URL leak, GroupChatLayout impure `Date.now()` in render.
- Wired the already-built §10.6 group chat into the app; added missing `room.*` i18n (zh/en).
- ESLint: `set-state-in-effect` → warn (was error-spamming 10 files); honoured `^_` unused-var convention.
- Local env: rebuilt `better-sqlite3`, installed linux-arm64 rolldown binding (node_modules was macOS-built).

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
| 2026-07-13 | 0.7.3 | P0 reliability closeout. (1) Health-check background job: new `server/src/services/healthCheck.ts` (`checkStationHealth()` pings `/models` and writes status; `runHealthCheckSweep()` walks all enabled stations in parallel on a timer, `HEALTH_CHECK_INTERVAL_MS` override, `unref()`ed), started in `index.ts` on listen and stopped on SIGINT/SIGTERM; manual health-check endpoint refactored to reuse `checkStationHealth()` (response shape unchanged). (2) Whole-app failure retry: `chatStore` gains `lastFailedSend` + `retryLastSend`, with a shared `startStream()` helper so the error banner (`ChatArea`) can offer a **Retry** button that reuses the existing user bubble; added `common.retry` i18n (zh/en). (3) Note: round-robin (commit 05c2a97) was already done but the backlog still listed it as open — corrected §8, §10.7, Phase 3. Server `tsc` + client `tsc -b`/`vite build` pass. | Claude |

---

## 13. Notes & Open Questions

- [ ] Should we support WebSocket in addition to SSE for bidirectional communication?
  - **Update 2026-07-11**: Collaborative human chat (§10.6) **expects** a bidirectional channel (WebSocket or equivalent) for occupancy/countdown and human messages; AI stream may remain SSE fan-out.
- [x] Multi-user support or single-user local deployment?
  - Multi-user (admin / user / guest) already in product; group chat extends this.
- [ ] Should model capabilities be auto-detected or manually configured?
- [ ] Database migration strategy if schema evolves?
- [ ] Support for custom system prompts per conversation?
- [ ] Occupancy renew max (product currently: unlimited 2‑minute renewals)?
- [ ] Safety keyword list UX for platform admins?

---

> **Reminder**: This document is the single source of truth. Every development step must be reflected here. Never delete content — only comment it out with `<!-- ... -->` when superseded.
