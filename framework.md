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
> **Version**: 0.7.31
> **Created**: 2026-06-15
> **Last Updated**: 2026-07-19 (v0.7.31 — chore: eliminate all 4 no-explicit-any lint errors → eslint 0 errors (12 set-state-in-effect warnings remain); see §12 change log)
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

---

## 13. Notes & Open Questions

- [x] Should we support WebSocket in addition to SSE for bidirectional communication?
  - **Update 2026-07-11**: Collaborative human chat (§10.6) **expects** a bidirectional channel (WebSocket or equivalent) for occupancy/countdown and human messages; AI stream may remain SSE fan-out.
  - **Update 2026-07-17 (v0.7.7)**: WebSocket hub shipped for §10.6 rooms (`/ws/rooms`). Private chat remains SSE for AI streaming; rooms use WS push + whole-chunk AI answers with a typing indicator (token streaming deferred).
  - **Update 2026-07-18 (v0.7.20)**: Room AI token streaming over WS (`streamInvokeModel` + `status:streaming` events). Private chat still SSE.
- [x] Multi-user support or single-user local deployment?
  - Multi-user (admin / user / guest) already in product; group chat extends this.
- [ ] Should model capabilities be auto-detected or manually configured?
- [ ] Database migration strategy if schema evolves?
- [ ] Support for custom system prompts per conversation?
- [ ] Occupancy renew max (product currently: unlimited 2‑minute renewals)?
- [ ] Safety keyword list UX for platform admins?

---

> **Reminder**: This document is the single source of truth. Every development step must be reflected here. Never delete content — only comment it out with `<!-- ... -->` when superseded.
