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
<!-- > **Version**: 0.7.51 -->
<!-- > **Version**: 0.7.52 -->
<!-- > **Version**: 0.7.53 -->
<!-- > **Version**: 0.7.54 -->
<!-- > **Version**: 0.7.55 -->
<!-- > **Version**: 0.7.56 -->
<!-- > **Version**: 0.7.57 -->
<!-- > **Version**: 0.7.58 -->
<!-- > **Version**: 0.7.59 -->
<!-- > **Version**: 0.7.60 -->
<!-- > **Version**: 0.7.61 -->
<!-- > **Version**: 0.7.62 -->
<!-- > **Version**: 0.7.63 -->
<!-- > **Version**: 0.7.64 -->
<!-- > **Version**: 0.7.65 -->
<!-- > **Version**: 0.7.66 -->
<!-- > **Version**: 0.7.67 -->
<!-- > **Version**: 0.7.68 -->
<!-- > **Version**: 0.7.69 -->
<!-- > **Version**: 0.7.70 -->
<!-- > **Version**: 0.7.71 -->
<!-- > **Version**: 0.7.72 -->
<!-- > **Version**: 0.7.73 -->
<!-- > **Version**: 0.7.74 -->
<!-- > **Version**: 0.7.75 -->
<!-- > **Version**: 0.7.76 -->
<!-- > **Version**: 0.7.77 -->
<!-- > **Version**: 0.7.78 -->
<!-- > **Version**: 0.7.79 -->
<!-- > **Version**: 0.7.80 -->
<!-- > **Version**: 0.7.81 -->
<!-- > **Version**: 0.7.82 -->
<!-- > **Version**: 0.7.83 -->
<!-- > **Version**: 0.7.84 -->
<!-- > **Version**: 0.7.85 -->
<!-- > **Version**: 0.7.86 -->
<!-- > **Version**: 0.7.87 -->
<!-- > **Version**: 0.7.88 -->
<!-- > **Version**: 0.7.89 -->
<!-- > **Version**: 0.7.90 -->
<!-- > **Version**: 0.7.91 -->
<!-- > **Version**: 0.7.92 -->
<!-- > **Version**: 0.7.93 -->
<!-- > **Version**: 0.7.94 -->
<!-- > **Version**: 0.7.95 -->
<!-- > **Version**: 0.7.96 -->
<!-- > **Version**: 0.7.97 -->
<!-- > **Version**: 0.7.98 -->
> **Version**: 0.8.0
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
<!-- > **Last Updated**: 2026-07-26 (v0.7.51 — **chore: i18n dead-key purge** — closed the v0.7.50 audit's open item: every 'suspect' key individually verified (3 dynamic t() sites resolved: guide.stepN via titleKey/descKey arrays, settings.howItWorksStepN via [1..6].map; 6 substring false positives re-checked with exact-quote match) → **34 keys confirmed zero-referenced and removed from BOTH locales**, 18 dynamic-covered kept; zh=en=554, no code-required key missing; build/tsc/tests green.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.52 — **Phase 5: vector-scan bound (TC2 #3) + server dead-dep removal** — `vectorSearch` now scans only the most-recent N embedded memories (default 2000, `VECTOR_SCAN_LIMIT` env, 0=unlimited; recency window composes with user scoping); server `dotenv`/`node-fetch` removed from package.json+lockfile (offline regen verified); client dead-dep removal still deferred (offline lockfile regen blocked by an uncached optional wasm dep). +5 tests → server 194. **Phase 5 remaining: a11y only.**) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.53 — **Phase 5 COMPLETE: a11y pass** — 6 unlabeled icon-only back buttons get `aria-label` (screen-reader sweep found exactly these); 3 modals get `role=dialog`/`aria-modal`/`aria-label`; Sidebar menus get `aria-haspopup`/`aria-expanded` + global Escape-to-close. tsc/build/eslint clean. **Phase 5 (and the whole §10.8 team-readiness roadmap Phases 0-5) is now closed**; remaining backlog is optional polish (§10.7 P2 error-copy, $-cost dashboard, client dead-dep removal in a networked session).) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.54 — **$ cost dashboard (closes Phase 3's deferred item)** — migration v9 `model_pricing` (per-1M-token prompt/completion unit prices, currency-agnostic), admin GET/PUT `/api/usage/pricing`, `computeUsageSummary` gains cost columns (per-model / per-user / totals; unpriced models NEVER guessed — null + `costIncomplete` floor-flag), UsageLogsPage gets 费用 columns + a collapsible 模型单价 editor; +6 tests → server 200. Next (owner-picked): deep dedup of getStationsForModel + resolveModel rescan.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.55 — **deep dedup (TC2 #5 tail + v0.7.50 audit item #2)** — chat.ts's local `getStationsForModel`/`resolveModel` copies deleted; the streaming chat path now computes its station pool ONCE via the shared `services/modelInvocation.getStationsForModel` (healthy-preferred + failover order + RR + decryption), killing both the dead `resolveModel` scan and the duplicate loop-time scan; side fix: the early 503 check now respects the admin pool. 200 tests / tsc clean.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.56 — **Claude-style visual restyle (owner request)** — full token-level reskin: warm ivory light theme (#faf9f5 family) + warm charcoal dark (#262624 family), terracotta accent #d97757 replaces the green everywhere (incl. new `--accent-tint-*` + `--color-assistant` vars that absorbed the last 20 hardcoded greens/purples across 11 components), book-serif system stack for headings + assistant markdown prose, warm overlay/border/selection tones, composer as a white card, page title fixed. Pure CSS-token change — zero logic touched; tsc/build/eslint clean.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.57 — **dev-facing UI copy sweep (owner request)** — audited every user-visible string (i18n values, JSX text nodes, alerts, server errors, seeds) for agent/dev self-talk: seeded 'Virtual Placeholder' member now renders localized 虚拟占位成员 in all 3 lists, hardcoded-Chinese 20MB alert + English ErrorBoundary/Loading.../Re-embed/table headers/role options all moved to i18n (+13 keys → zh=en=570); i18n values + server error strings verified clean. tsc/build/eslint back to 11-warning baseline.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.58 — **§10.9 team-rollout backlog recorded + P0 #1: conversations default PRIVATE** — new §10.9 (owner is becoming a team lead; P0/P1/P2 feature order agreed), and the first item shipped: POST /conversations + import now default `visibility='private'` unless explicitly public; client new-chat toggle starts private. Legacy NULL-visibility mapping untouched. Tests/tsc/build green.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.59 — **§10.9 P0 #2: forced password change on first login** — migration v10 `users.must_change_password`; seed flags default-password admins + a boot sweep (`flagDefaultAdminPasswords`) covers pre-v10 DBs; `POST /api/auth/change-password` (pure `applyPasswordChange` core); non-dismissable `ForcePasswordModal` blocks the app until changed. Closes §10.8 TC0 #5 fully. +5 tests → server 205.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.60 — **§10.9 P0 #3: embedding API key encrypted at rest** — the column v0.7.37 deferred: memories config PUT encrypts on write, GET + embeddings call decrypt transparently (legacy plaintext passes through), boot sweep self-heals existing plaintext. **P0 complete — safe to invite the first teammate.** +3 tests → server 208.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.61 — **§10.9 P1 #4: group-chat unread badges + AI-done notification** — per-room lastSeen in localStorage (`roomStore.markRoomSeen`: on open + on every push while open), terracotta unread dot in the rooms list (`updated_at > lastSeen`), and a browser Notification on the streaming→done transition when the tab is hidden (permission asked on first room entry). Client-only; tsc/build/eslint clean.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.62 — **§10.9 P1 #5: onboarding guide refresh — P1 COMPLETE** — all six GuideOverlay steps rewritten (zh+en, keys unchanged so zero component churn) for the team-era product: team framing, personas, pin/folders/search + default-private, file 私有/共享, group chat + unread/notifications, memory privacy + quotas. Replaces copy that still described the solo pre-v0.7.33 product.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.63 — **§10.9 P2 #6: admin announcement banner** — migration v11 single-row `announcement` table, GET (everyone) / PUT (admin) `/api/announcement`, dismissable banner above the chat area (dismissal keyed per `updated_at` version so edits re-surface), admin editor card in Settings. Tests 208 / all checks green.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.64 — **§10.9 P2 #7: friendly error copy — §10.9 P0/P1/P2 ALL COMPLETE** — pure `friendlyErrorKey` maps the six common failure families (no-station / quota / rate-limit / network / timeout / auth) to actionable zh+en messages; the chat error banner shows the friendly text with the raw error preserved in the tooltip; unmatched errors pass through raw. Client tests 9→11; server 208; everything green. Remaining backlog = §10.9 P3 (recorded-only).) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.65 — **Team knowledge base (owner request)** — migration v12 (`file_library` kb/summary/doc_type/ai_keywords/summary_status), auto AI digest after extraction (`services/kbSummarizer`: type+keywords+summary, injectable-invoker tests, usage-logged), KB scope listing with LIKE search over name/summary/keywords/type, reading view from chunks, original-file download, member retry / owner regenerate; client 知识库 tab in FileBrowser (search+type chips+digest cards+reading overlay+查看原文). +7 tests → server 215.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.66 — **token receipt capture (closes v0.7.65 scope cut #1)** — `invokeModel` AND `streamInvokeModel` now catch the OpenAI-compatible `usage` block (new `InvokeModelSuccess.usage`; SSE via pure `extractSseUsage`, any chunk, last wins); KB digests log real prompt/completion/total tokens (→ $-cost dashboard + quota), rooms' chars/4 completion estimate demoted to no-receipt fallback. +1 test → server 216.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.67 — **KB url-import (closes v0.7.65 scope cut #2)** — POST /api/files/kb-url: SSRF-guarded server-side fetch (pure `urlRejectionReason`: http(s)-only, blocks localhost/*.local/private-v4/link-local-metadata/IPv6 literals), dependency-free `htmlToText`+title extraction, 2MB/20s caps, thin-page refusal; imported page becomes a normal KB .md (source line included) through the SAME chunk→embed→digest pipeline; client 从网址导入 input in the KB toolbar. +6 tests → server 222. NOTE: works wherever the deployed server's egress allows — on the offline dev VM the fetch itself will fail by design.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.68 — **chore: one-click macOS dev launcher** — `start-dev.command` (double-click in Finder): PATH fix, Node check, auto-detects a wrong-platform `better-sqlite3` binary and rebuilds it for the local Mac (the dev VM had recompiled it for Linux), starts server+client, opens the browser, Ctrl+C stops both. For the non-programmer owner's local testing.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.69 — **launcher v2 (first-run debugging)** — owner's first double-click showed the client up but the server dead with its error lost in scrollback; the launcher now logs both processes to `dev-logs/` (gitignored), kills stale port 3001/5173 processes, checks Xcode CLT before rebuilding, health-polls `/api/health` for 30s, and on failure prints the last 30 server-log lines with "截图发给 Claude" — turning the next failure into a self-diagnosing screenshot.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.70 — **launcher v3: the rebuild guard actually fires now** — v2's require-probe silently passed on the Mac because better-sqlite3 v11 loads its native binary lazily (only when a DB is opened), so the Linux binary survived and the server died at `getDb` with `ERR_DLOPEN_FAILED (slice is not valid mach-o file)`. The guard is now two real checks: `file` says the binary is Mach-O AND an actual `new Database(':memory:')` succeeds from `server/`; rebuild output goes to `dev-logs/rebuild.log` and is auto-printed on failure, with a `rm -rf node_modules && npm install` fallback line.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.71 — **UI fix: top-right toggle cluster no longer overlaps page headers** — owner's first live session showed the fixed theme/language buttons stacked on the chat header's 人设 button; every top bar with right-edge content now reserves `pr-32` (chat header, file library, usage logs, announcement banner; memory/user-management bumped from pr-28), matching the established reservation pattern.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.72 — **项目世界书 (SillyTavern-style World Info, owner batch #1)** — migration v13 `lorebook_entries`, pure matcher (CJK-safe substring, priority+budget-bounded) injected into chat before persona; team CRUD routes (all read/add, owner/admin edit-delete-toggle); client 世界书 tab in 文件库 with entry cards + editor; +10 pure-function tests → server 232. Next: v0.7.73 auto-distill learning, v0.7.74 in-chat web search.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.73 — **自动蒸馏学习 (owner batch #2)** — migration v14 watermark `conversations.distilled_message_count` + the dormant `auto_summarize`/`summarize_threshold` knobs wired for real: every N messages the chat path fires `distillConversation` (injectable invoke/log/embed) which refines the fresh tail into ≤5 durable facts stored as memory entries (summary=fact so existing RAG retrieves them, tag `distilled`, embeddings, usage-logged); memory settings UI gains the 自动蒸馏 toggle + cadence input — and the audit found the OLD auto_save/context_injection toggles silently did nothing (snake_case keys vs camelCase API) — fixed. +9 tests → server 241.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.75 — **station settings UX (owner live-testing feedback)** — ① existing stations get an inline 编辑 form (name/URL/key; blank key = keep stored, filled = replace+encrypt — the PUT route always supported this, the UI just never exposed it); ② capability/pool badges (文本/管理员选用 etc.) moved from hard-coded dark-theme colors to theme-aware `--badge-*` CSS vars (dark text on light theme, light text on dark), and the model row's `rgba(0,0,0,0.2)` dark-leftover background became `--overlay-4` — the unreadable-chips screenshot case.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.76 — **announcement UX rework + group-chat banner (owner feedback)** — the always-open settings editor became a compact card + button (announcements are occasional): dialog flow 编辑 → 预览（渲染成员实际看到的横幅样式）→ 二次确认发布; published state shows a live-content snippet with 修改 / 撤回 (retract keeps the text for re-publishing); AND the member banner now ALSO renders atop the group-chat (rooms) view — it had only ever been on the chat page.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.77 — **group-chat view polish (owner screenshot)** — ① GroupChatLayout's header (设置/成员 buttons) was the LAST top bar still colliding with the fixed theme/language cluster → `pr-32` like every other page (v0.7.71 audit had missed it because rooms renders inside RoomsPage, not its own top-level page shell); ② the 280px group list is now collapsible on desktop — PanelLeftClose in its header shrinks it to a 44px rail (expand / back / new-group icons); mobile list/detail behaviour untouched.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.78 — **theme/language toggles moved INTO every page header (owner: 强迫症要求水平对齐、间距一致)** — the floating `fixed top-4 right-4` cluster is retired inside the app: `TopRightToggles` gains an `inline` variant rendered in the button row of ALL 9 top bars (chat, files, memory, users, usage, settings, arena, group-chat header + rooms empty-state corner), so alignment/spacing are native flex — and every `pr-32` reservation from v0.7.71/75/77 is removed as obsolete. Fixed variant remains only on login/register.) -->
<!-- > **Last Updated**: 2026-07-26 (v0.7.80 — **arena fullscreen reading mode (owner request after loving the markdown render)** — each candidate card gets a 放大阅读 button (shown once content/error exists): near-fullscreen modal (max-w-4xl × full height) with the model name + latency in its header, scrollable markdown body, closes via ✕ / backdrop / Esc. i18n +2×2, 663=663.) -->
<!-- > **Last Updated**: 2026-08-09 (v0.7.86 — **移动端 P1+P2+P3 收官** — ① **键盘遮挡**：新增 `utils/viewportHeight` 用 VisualViewport API 把真实可见高度写进 `--app-height`（iOS 键盘只缩视觉视口、不动 `100dvh`，这是唯一跟得上的值），根节点高度改为 `@supports (height:100dvh)` 下的 `var(--app-height, 100dvh)`，老浏览器仍走 `height:100%`；② **弹窗限高**：新增共享 `.dialog-panel`（按 `--app-height` 限高），补给 7 个此前完全无限高的弹窗，并把 `SystemPromptModal`/`GroupChatLayout` 原有的 `vh` 写法统一过来，`GuideOverlay` 改成 flex 列（进度条与导航固定、只有正文滚动）——**全站 11 个弹窗现已全部限高**；③ **工具栏折行**：`RegexManager` 5 个硬网格加 `sm:` 断点 + 标签行折行、`KnowledgeBasePanel` 工具栏与网址导入行、`LorebookPanel` 工具栏、`FileBrowser` 顶栏与新建文件夹表单、`McpServerManager` 卡片按钮行；④ **触控目标**：新增 `.touch-target`（仅 `pointer: coarse` 生效，桌面密度不变），给 v0.7.85 刚在触屏上显形的 9 个按钮补到 44px。**证伪一项**：`SettingsPage` 无需改动（无固定宽度、中转站操作行本来就 `flex-wrap`、两处表单各只有 2 个按钮）。client 全绿，server 未动 255。) -->
<!-- > **Last Updated**: 2026-08-13 (v0.7.87 — **桌面端群聊被压在左半屏的布局 bug 修复（owner 反馈）** — `GroupChatLayout` 的根节点 `h-full flex flex-col` 从 v0.7.6 起就是 `RoomsPage` 右栏（当时为了手机「列表/详情」切换把它从 block 改成了 `hidden md:flex`）的一个 **flex item**，而它没有任何 grow 因子 → `flex: 0 1 auto` 让它按**自身内容的 max-content** 定宽，于是整个群聊界面缩成靠左的一条（1440 屏实测只有 ~915px，右边一大片空白），且宽度随消息长短漂移。同一个原因下 `!currentRoom` 的加载态也是在窄条里居中。修法＝两个 return 的根节点都补 `flex-1 min-w-0`。**取证**：用 headless Chromium 实测三种结构——block 父容器(v0.7.6 前)=1160px ✅ / flex 父容器+无 grow(现状)=69px ❌ / flex 父容器+`flex-1`(修复)=1160px ✅；修复后真机渲染 1440/1024/768/500 四档均满宽、两栏均分。**证伪一项**：起初怀疑是 v0.7.82 给状态行加的 `flex-wrap`/`flex-1 truncate` 缩小了固有宽度，A/B 实测 max-content 两者都是 397px，与它无关——这是自 v0.7.6 就存在的潜伏结构 bug，只是宽度取决于内容、以前不容易发觉。**顺带全站排查**：其余 80 处「组件位于 flex 容器内」的命中全是 lucide 图标（本身就有固有尺寸）或误报（`flex-shrink-0`/`flex-1` 子串），`TopRightToggles` 默认变体是 `fixed`（脱离文档流），**只有群聊这一处真中招**。client `tsc -b` + `vite build` + 11 测试 + eslint（0 err / 12 基线警告）全绿；server 未动。)<!-- > **Last Updated**: 2026-08-09 (v0.7.85 — **P0 修复：三块功能在手机上重新可用（悬停门禁改为指针能力门禁）** — v0.7.84 审查发现的最严重问题：消息操作（复制/重新生成/编辑，v0.7.41）、会话置顶·移入文件夹（v0.7.47）、团队人设重命名·删除，三处都用 `opacity-0 group-hover:opacity-100` 藏到悬停，而触屏没有 hover。全站 **8 处**统一改成 Tailwind v4 的 `pointer-fine:` 变体 → 编译成 `@media (pointer:fine)`，**鼠标设备行为完全不变**（仍是悬停才显现），**触屏设备按钮常驻可见**；顺带覆盖了 `FileBrowser`/`MemoryBrowser` 桌面块与 `UserManagement` 配额铅笔——触屏平板（≥768px 走桌面分支）此前同样够不着。级联已验证：`focus-within:opacity-100` 特异度 (0,2,0) 高于 `pointer-fine:opacity-0` (0,1,0)，键盘聚焦仍能显现，无 a11y 回退。client 全绿（tsc/build/11 测试/eslint 0 错 12 基线警告），server 未动 255。) --> -->
<!-- > **Last Updated**: 2026-08-13 (v0.7.88 — **手机端侧边栏会话行只剩一个字（owner 真机反馈）** — 会话行右侧 5 个操作按钮，v0.7.85 让它们在触屏常驻可见、v0.7.86 又给其中 4 个套上 `.touch-target`（44px）——两者叠加后 **实测 263px 的行里按钮吃掉 197px，标题只剩 12px（正好一个汉字）**。修法＝触屏上把 5 个按钮收进**一个 44px 的 ⋯ 菜单**（`hidden pointer-fine:flex` 藏起内联按钮条、`pointer-fine:hidden` 显示 ⋯），菜单项带文字标签（手机没有 hover 提示，纯图标不可读）；鼠标端**完全不变**。删除仍是两下确认。新增 i18n `sidebar.moreActions` 与 `conversation.makePublic/makePrivate`（菜单里「公开」当动作讲要写成「设为公开」）。**验证**：headless + 触摸模拟实测标题 12px→173px、⋯ 为 44×44、菜单 5 项齐全；**并且发现 headless 下 `(pointer:fine)` 永远不匹配（无指针设备，`pointer:none`），`Emulation.setEmulatedMedia` 也不支持 pointer** —— 改用 **Xvfb + headful chromium** 才真正跑到桌面分支，实测 `pointer:fine=true`、5 个按钮回到 21px、⋯ 为 `display:none`，确认鼠标端零变化。)<!-- > **Last Updated**: 2026-08-09 (v0.7.84 — **移动端批次 3 起步 + 移动端深度审查** — `UsageLogsPage` 补齐 v0.7.21 卡片模式（8 列桌面表 `hidden md:block`，手机堆叠卡承载全部 8 列数据；该页其余区块经核查本来就自适应）；§10.9 新增《移动端深度审查结果》——最重要的发现是**三块已上线功能在手机上根本没有入口**（消息操作 v0.7.41 / 会话置顶·文件夹 v0.7.47 / 人设重命名·删除，都用 `opacity-0 group-hover:opacity-100`，触屏无 hover），另有 iOS 键盘遮挡输入框（`height:100%` → 应改 `100dvh`）、根节点 `overflow:hidden` 让所有横向溢出变成**永久裁切**而非滚动、7 个弹窗缺限高内滚、33 个图标按钮不足 44px；同时**证伪并删掉**批次 4 的两项（安全区在默认 `viewport-fit=auto` 下无需处理；竞技场两个子面板实为 `flex-wrap` 可用）。client 全绿，server 未动 255。) --> -->
<!-- > **Last Updated**: 2026-08-14 (v0.7.89 — **「这个模型暂时没有可用的服务节点」改成分情况提示（owner 昨天被这句误导）** — 这句 503 发生在**任何真实 API 调用之前**，却写着「稍等片刻重试」，把 owner 引向「是不是供应商挂了」——实际三种原因没有一种是暂时的，等多久都没用。新增 `diagnoseNoStation()`（纯函数 `diagnoseNoStationFromRows` + 取数壳，沿用本文件 `filterStationsForModel`/`getStationsForModel` 的既有拆法）区分：① 任何站都没有这个模型名 → `model-unknown`；② 有但所有承载站都被关了 → `station-disabled`；③ 有且站是开的 → 只可能是池开关没开 → `model-not-enabled`。**注意 unhealthy 不是原因**（`filterStationsForModel` 会把 unhealthy 当兜底返回，不会返空）。三句英文经 `noStationMessage()` 输出、前端 `friendlyErrorKey` 匹配成三条中文文案（都写成「去哪儿点什么」而不是「稍后重试」），两端各有单测钉住这份文本契约（server 260、client 12）。**真机验证四种状态**：三种分别显示对应中文；对照组（配置正常但供应商地址是假的）显示 `All stations failed`——证明配置类错误与真正的调用失败已经分开。**顺带确认了 owner 的处境**：`ChatInput` 的模型取自 `localStorage['selected_model']`，所以模型列表空着、选择器显示「选择模型」时，消息照样会带着旧模型名发出去——这就是她「拉取成功却聊不了」的完整链路。**未做（已告知 owner）**：`chat.ts` 的 `All stations failed` 丢掉了各站真实报错（如 401），要改得动 failover 循环收集错误，单列一项。)<!-- > **Last Updated**: 2026-08-09 (v0.7.83 — **repo integrity audit after the `.git/index.lock` fight + migration-list tidy** — owner reported a session where the agent battled a week-stale `.git/index.lock` on the macOS fakeowner mount; full sweep found **zero code damage** (server 255/255 + tsc, client tsc/build/11 tests/eslint 0-err, fresh-DB boot smoke with all 16 migrations, i18n 660=660 with every `t()` key resolvable, all 20 routers mounted, `git fsck` clean — its 4 dangling commits are byte-identical duplicates of work already in history). Two real leftovers fixed: `SCHEMA_MIGRATIONS` was out of version order (v9 orphaned at the end below v16, its comment stranded above v10; v11/v12 swapped) → now strictly 1→16 with comments reattached (behaviour-identical, `runMigrations` already sorted); `_to_delete/` (114 zero-byte git lock files from the 2026-07-26 lock storm) removed. Also records v0.7.82 below, which shipped undocumented.) --> -->
<!-- > **Last Updated**: 2026-08-14 (v0.7.90 — **把中转站的真实报错交给用户（owner：「需要看到真实报错」）** — 承接 v0.7.89：配置类原因分清楚之后，下一堵墙是 `All stations failed` ——一句光秃秃的英文，而且 `!response.ok` 分支**根本没读响应体**，供应商说的「key 不对」「模型不存在」全被丢掉。现在：两个失败分支都把 `{站名, HTTP 状态, 响应体}` 收进 `stationFailures`；`classifyUpstreamFailures()` 按**用户要做什么**的严重度挑一个原因（401/403 > 404 > 5xx > 429；429 排最后，因为它是唯一真·暂时的，不该盖住真正的配置错误），映射成 6 条中文文案；`sanitizeUpstreamDetail()` 把站点自己的 key 和任何 `sk-`/`Bearer` 形状的串换成 `***` 并截断到 300 字（有的供应商回整页 HTML）。**逐站明细只给管理员**（会带站名和上游原文，普通成员既看不懂也无从下手，他们那条文案本来就是「找管理员」）；用量日志里则**完整记录**，不分角色。前端 SSE 多带一个 `detail` 字段 → `chatStore.errorDetail` → 报错条里一个默认收起的 `<details>`（展开时 `scrollIntoView`，否则它长在滚动区下面、正好看不见；用真元素而不是 `title=` 提示，因为手机没法 hover）。**真机验证 5 种上游状态**（自建假上游 :9999 返回 401/404/429/500 + 一个连不上的地址）：文案各自正确，明细里上游回显的真 key 确实变成了 `***`；另用一个普通成员账号验证返回体里**没有 `detail` 字段**。server 268（+8）、client 13（+1）。)<!-- > **Last Updated**: 2026-07-26 (v0.7.82 — **mobile adaptation batches 1-2 (§10.9 追加批次)** — batch 1 group chat: `GroupChatLayout`'s hard two-pane layout becomes single-pane on phones with a 群聊/AI回复 tab switch, `NotepadBar` collapsed in; batch 2 chat page: `ChatArea` header + `ChatInput` status row + `ModelSelector` + `FileSelector` portrait fixes. 9 files, +114/-32; committed `6190622` but never recorded here at the time — see v0.7.83.) --> -->
<!-- > **Last Updated**: 2026-08-14 (v0.7.91 — **顶部模型选择器一直是个摆设：真正发出去的是「每日模型」里存的那个（owner 报「选生图模型报找不到，换 grok4.6 一样」）** — `ChatInput` 里 `const model = prefsChat || selectedModel || models[0]` 一行里叠了三个坑：① **`prefs.chatModel`（每日模型弹窗存的）优先级高于选择器**，所以在头部换模型对发送毫无影响；② `selectedModel` 是 `useState(() => localStorage.getItem(...))` **只在挂载时读一次**（`_setSelectedModel` 从未被调用），后来改的选择器根本传不进来；③ 两个候选都**不校验是否还存在**。→ owner 的每日模型里存着一个早已不存在的名字，于是**选什么都报「找不到这个模型」**。修法＝**发送时**解析、按「显式选择 > 每日默认 > 列表第一个」取**第一个真实存在于 `models` 里的**（列表还没加载完则不阻塞发送，退回原行为）；删掉那个永远过期的 state；`DailyModelModal` 存盘时同步写 `localStorage['selected_model']`，让两个视图不再各说各话。**另外报错现在会点名模型**（服务端本来就在英文串里引了模型名，本地化文案把它丢了）——就是这个缺失让今天这个问题查了很久。**本地复现+验证**：把 `user_model_prefs.chat_model` 设成 `ghost-model-v9`、选择器选有效的 gpt-4o——修复前报「找不到这个模型」，修复后正常带 gpt-4o 打到中转站、报的是真实的上游 401。**还发现但没做**：`showDailyModal` 只由服务端 `needsDailyModal` 驱动，**全站没有手动打开每日模型弹窗的入口**，也就是说这个决定了发送模型的设置一旦关掉当天就改不了——已告知 owner，待她定。)<!-- > **Last Updated**: 2026-07-26 (v0.7.81 — **test-server auto-deploy (owner's Oracle VM + Cloudflare + NPM)** — `deploy.sh` (idempotent: first run generates JWT/encryption secrets into `~/.multi-model-ai.env` outside git, installs pm2, boots; every run = pull → npm ci → tsc + vite build → pm2 restart; port 8500 inside the VM's open 8000-9000 range), `.github/workflows/deploy.yml` (push to main → SSH → deploy.sh, plain ssh with 3 repo secrets, manual dispatch supported), and `DEPLOY.md` — a zh handbook of the one-time setup (CF DNS `official` subdomain, VM init, Deploy Key + Actions secrets, NPM proxy host with the Websockets checkbox called out) + daily ops/排障 table. No app code touched.) --> -->
<!-- > **Last Updated**: 2026-08-15 (v0.7.97 — **测活两个定时任务默认关闭（owner 被中转站封号：「有个站把我封了说我测活」）+ 流式输出时终于能往上滚** —— ① **流量画像才是重点**：`healthCheck` 每 **60 秒**扫一遍所有启用的站（打 `/models`）＝**每站每天 1440 次**主动请求，而真实聊天可能一天几十条；`deepProbe` 每天还额外发一条**真实 chat completion**。对中转站来说这就是探测特征，被判滥用不奇怪。**关掉它们不会让系统变瞎**——真实请求本来就会 `markStationHealth`（`invokeModel`/`streamInvokeModel`/`routes/chat` 三处失败分支都会标记），而 `filterStationsForModel` 把 `unknown` 当可路由、把 `unhealthy` 当兜底，所以最坏情况也只是「坏站等到有人用时才被发现」。实现＝新增纯函数 `isProbeJobEnabled`（沿用 `parseBackupOptions` 的解析形状，**默认反过来**），两个 `start*Job` 未显式开启就直接返回并打印一行说明；`HEALTH_CHECK_ENABLED` / `DEEP_PROBE_ENABLED` 可以随时开回来。**手动的 `POST /api/stations/:id/health-check` 原样保留**——人主动点的一次请求，和没人看见的定时器是两回事。顺手核了其余三个定时器都不出网（`retention` 清库、`roomHub` 给浏览器发心跳、`backup` 快照）。启动日志实测两条都是 disabled。② **流式输出时无法滚动**（owner 电脑端）：`ChatArea` 那个 effect 依赖 `[messages, streamingContent]`，而 `streamingContent` **每个 token 都变**，于是每个 token 都无条件 `scrollIntoView`——往上滑立刻被拽回去；更糟的是 `behavior: smooth`，每秒几十次平滑动画叠在一起，视图是在跟滚轮**较劲**而不是忽略它。改成经典的 stick-to-bottom：容器加 `onScroll` 记录「是否贴底」（**留 40px 余量**，贴底时常差零点几像素、手机回弹也落不准），不贴底就不跟随；自己发消息会重新进入跟随（新增的最后一条是 user 角色）；切换会话重置为跟随。另外 **token 更新用 `auto` 瞬时、整条新消息才用 `smooth`**，避免动画排队。server 277（+3，`isProbeJobEnabled` 的默认关闭契约）、client 13、tsc/build 净、eslint 0 错 11 警。**owner 报的「手机端选择文件点了没反应」本次未复现**：390×844 实测面板 `x=16..336` 完整在屏幕内、`documentElement` 无溢出，原先怀疑的「w-80 被 `overflow:hidden` 裁掉」不成立，待更多线索。) -->
<!-- > **Last Updated**: 2026-08-21 (v0.7.98 — **全量代码审计（§10.11）+ 审计中挖出并修掉一个真实安全漏洞**。① 审计结论：**不是屎山** —— 34,268 行自有代码里只有 16 个 `any`、1 个 `@ts-ignore`、0 个 TODO、1 行注释掉的死代码，19 处空 catch **全部写了原因**；问题不在「乱」而在「长」和「重复」（97 个函数 >60 行，30 个 >150 行；`chat.ts` 单个处理函数 697 行 / 64 个 if 分支）。② 🔴🔴 **安全漏洞（已修 + 实测验证）**：管理员删掉一个成员 → 外键 `ON DELETE SET NULL` 把他全部会话的 `user_id` 置空 → 旧规则把「无主」当作「所有人可读可改」→ **未登录即可读到该成员的私密对话，并可调 truncate 把消息删光**（本地演示实例实测：删用户前 404，删完 200 且内容完整可读，truncate 返回 200 消息清零）。根因是同一条归属权判断散在三处、语义还不一致。修法＝新增 `services/conversationAccess.ts` 作为**唯一一份**规则，无主会话统一收紧为「仅管理员」（读写皆是，且不因 `visibility=public` 而放行——那个值是被孤儿化之前留下的），列表 SQL 里的 `OR user_id IS NULL` 只留给管理员。**刻意不销毁数据**，孤儿会话收归管理员处置。修后实测：未登录读 404、未登录 truncate 403、其他成员读 404、管理员读 200。13 个用例锁不变量（含穷举 user × visibility 全组合）。③ 客户端测试 13 → 47（2 → 5 个文件），过程中修掉两个真 bug：**英文界面字面显示 `3 script{s}`**（`{s}` 复数占位符六个调用点里四个没传，另一处传成 `count > 1` 导致 `0 station available`）改为在 `t()` 里从 `count` 统一推导；**群聊也有「AI 输出时无法滚动」**（`GroupChatLayout` 两个 effect 无条件 `scrollIntoView`，与 ChatArea v0.7.97 同类），判定抽成 `utils/scrollFollow.ts` 纯函数供两处共用。server 290（+13）、client 47（+34）、tsc/build 净、eslint 0 错 12 警。④ **同日续做 ②③④⑤**：② 抽出 `services/chatContent.ts`（消息正文+附件→上游 content，原先本轮消息与历史消息各写一份完全相同的推演）与 `services/toolCallStream.ts`（流式 tool_calls 按 index 累加/排序），处理函数 697 → 668 行、新增 22 个用例覆盖原先零测试的逻辑；**剩余 668 行是节点故障转移+SSE+工具往返的深度 I/O 耦合，拆它需要引入依赖注入，属独立的重新设计，本轮明确未做**。③ 补齐 6 处「服务端实际返回却没写进自己类型」的字段（`ModelCapability` 补 `tts`/`embedding`、`UserPublic.isVirtual`、`StationModel.adminEnabled`/`publicEnabled`、`McpServer.toolCount`、`RegexScript`/`RegexPreset.ownerUsername`），客户端 `capabilities` 由 `ModelCapability[] | string[]` 收紧、两处 `ownerUsername` 补 null；**不抽 shared 包**（要动两边 tsconfig/Vite 解析/部署脚本，风险大于收益），改为新增 `typeParity.test.ts` 立闸：同名类型必须逐字段一致，故意的差异写进白名单并说明理由，另有一条断言防白名单膨胀 —— 闸门**已验证真的会失败**（故意给 `Station` 加字段后立刻报出该字段，随后还原）。④ 三份 `UserPublic` 行映射合成 `services/userPublic.ts`，连 `GET /:id` 少 SELECT 一列一起修，7 个用例（含真库查询验证列清单完整）。⑤ 删掉 `LanguageToggle`/`ThemeToggle`（60 行，v0.7.78 已被 `TopRightToggles` 取代且无人 import）、`requireAdmin`、三个从未使用的类型。**⑤ 内含一处审计修正：`try { ALTER TABLE } catch {}` 不是债** —— 数量是 11 处不是 3 处（原 grep 漏了多行写法），且它们**必须存在**：`SCHEMA_MIGRATIONS` 的 v1 就是 `initTables` 本身，职责是重演账本诞生前的建表历史（`CREATE TABLE conversations` 故意不含 `user_id`，靠后面的 ALTER 补），删掉会让新建库直接缺列起不来；try/catch 是这次重演对任意中间 schema 状态的幂等性来源。测试合计 290 → **370**（server 323 / client 47），tsc 两端净、构建净、eslint 0 错 12 警。) -->
<!-- > **Last Updated**: 2026-08-22 (v0.7.99 — **手机输入法卡顿 + ② 上下文注入段**。① owner 真机反馈「输入法弹出时输入框向上会卡一下，不影响使用只是不流畅」（8-15 报的另两个手机 bug——选择文件无反应、iOS 粘贴——owner 已确认修好）。怀疑是 `utils/viewportHeight.ts` 在 `visualViewport` 每次 resize 都直接写 `--app-height`，而输入法弹出是一段动画、这期间 resize 连续触发，同一帧内多次改样式＝重排抖动。改用 `requestAnimationFrame` 合并，一帧最多写一次；无 rAF 的环境退回同步。测试 6 → 11，新增一组专测合并（同帧连来 5 次只写 1 次、写的是最后一次的值、跨帧不合并、清理时取消未执行的帧、无 rAF 时同步）。⚠️ **体感是否改善本地验证不了**（iOS 输入法引起的 visualViewport 变化是 iOS 独有行为，无头浏览器模拟不出来），待 owner 真机确认，无效则改防抖。② 上下文注入段：**先纠正一处判断**——五段注入里已经有两段（世界书 `buildLorebookContext`、联网 `buildWebSearchContext`）是按「抽纯函数」样板做的，所以不是五段全要重写，只需让文件库 RAG 与记忆库跟上。**真正脆的是顺序**：五段各自 `apiMessages.unshift()`，最后 unshift 的排到最前，最终顺序（人设→联网→世界书→记忆→文件库）完全由调用次序倒推，而这个约定**只写在一句注释里、零测试**——谁挪动先后，提示词层次就悄悄变了且不会报错。新增 `services/chatContext.ts`：`SYSTEM_CONTEXT_ORDER` 常量 + `orderSystemContext()` + 两个格式化函数，15 个用例（含一条把旧的五次 unshift 手动跑一遍、与新实现逐项比对的等价性断言）。五次 unshift 换成一次 `unshift(...orderSystemContext(ctx).map(...))`，返回顺序即模型看到的顺序，不用再在脑子里倒推。**端到端实证**：本地验证实例 + 会记录请求体的模拟上游，造一轮人设与记忆都命中的对话，上游实际收到 `[system 人设][system 记忆][user][assistant][user]` —— 与重构前一致。处理函数 668 → **656 行**。③ **C 段：自审一遍**。这段的返回值会**整条替换**用户已经看到的回答，判松了会把答案抹成空白，而它原先零测试。抽出 `services/selfReview.ts`（拼提示词 + 解析响应，中间那次网络请求留在路由里），10 个用例，含专锁「只有空白算失败」与「返回未 trim 的原文」。顺手修掉一处字符串往返：自审原先靠把 `"模型 @ 节点名"` 这个给人看的字符串 `split(' @ ')[0]` 拆开再回头找节点（节点名里含 ` @ ` 就会找错），改为选中时一并记下 `winningStation` 对象直接用。**端到端实证**：开自审的会话上游收到 2 次请求（流式正文 + 带 `---BEGIN AI RESPONSE---` 的非流式自审），SSE 与落库都是修订版；关自审只 1 次，8 条断言全过。处理函数 656 → **653 行**；② 累计 697 → 653，抽出 4 个纯模块共 47 个用例。④ ⚠️ **抽自审时挖出：用量统计系统性少算（未修，待定夺）** —— `chat.ts` 只按用户那一句话估 token，人设/世界书/联网/记忆/文件库/全部历史都没算，且它压根不取上游的 `usage`（群聊的 `rooms.ts` 反而取了真实值），自审那次调用完全没记账；净效果是配额和成本看板都少算、用户上下文越多少算越多。修它会让配额真的开始生效、看板数字跳升，属产品可见变化，故先报不改。测试总量 370 → **400**（server 348 / client 52），tsc 两端净、构建净。) -->
> **Last Updated**: 2026-08-22 (v0.8.0 — **用量统计系统性少算，已修（§10.12）**。抽自审时挖出：`chat.ts` 记账用的是 `Math.ceil(String(message).length / 4)` —— **只数了用户那一句话**，人设/世界书/联网/记忆/文件库/全部历史统统没算；而且它压根不去看上游回执（为支持工具调用自己做流式解析，绕开了 `streamInvokeModel`，而群聊的 `rooms.ts` 反而用了真实的 `result.usage`）；**自审那次上游调用完全不在账上**（真花了钱却看不见）；**多轮工具调用每轮都是一次独立上游调用，账上只按一次算**；`station_id`/`station_name` 两列 chat 路径一直写 null。**先查影响面**（真库只读）：没有任何用户设了配额（`monthly_token_limit` 全 0 = 不限）、历史 `kind=chat` 用量只有 1 行 0 token —— 所以这次修**不会卡到任何人、也不会让看板已有数字跳变**，只是从现在起记的是对的。修法＝新增 `services/usageAccounting.ts`（21 个用例）：`estimateMessagesTokens()` 数**整个** messages（兼容多模态 content，图片估不出就不假装能估）、`extractUsageReceipt()` 从流式 chunk 或非流式响应取 `usage`（**缺项不作废整张回执**，不少站只回 total；三项全缺才算没回执）、`addReceipts()` 逐轮累加（某轮没回执不抹掉另一轮的真数字，也不替它编）、`resolveUsage()` **逐字段**取真实回执、缺的用估算补，`total` 缺失时按定稿后两项求和（配额是 `SUM(total_tokens)`，这列不能空）。`chat.ts` 侧：流式解析顺手收 `usage`、按每轮实际发出的 messages 估兜底、补上节点 id/name、**自审单独记一行**（`kind: chat`，与 rooms.ts 同口径「一次调用一行」，且记在解析结果之前 —— 钱在响应回来时就花掉了，哪怕修订没用上）。**刻意不加 `stream_options: {include_usage: true}`**：那是改我们发出去的请求体，中转站良莠不齐、遇到不认识的字段直接 400 的是有的，「聊天挂掉」比「数字不够准」严重得多 —— 现在是**只读不求**。**端到端实证**（验证实例 + 模拟上游，跑两趟）：A 上游回执 → 账上 prompt=128 用真数字；B 上游不回回执（`MOCK_NO_USAGE=1`）→ 走兜底，prompt=171 **≫ 旧口径的 3**（人设终于算进去了）；两趟都是 2 行（正文 + 自审）、`total = prompt + completion`、节点名不再为 null。测试总量 400 → **421**（server 369 / client 52），tsc 两端净、构建净。**② 核对了一份外部 AI 审核意见（§10.13）**：owner 拿来一份第三方 AI（署名 Cline）的《严格生产化审核结论》，结论「可发布」+ 6 条待修项。逐条回代码核：**③ zustand persist 缺失**（❌ 不是缺陷 —— 需要持久化的三处都是手写 localStorage 且带隐私模式兜底，其余 10 个 store 是纯服务端状态，持久化只会缓存脏数据）、**⑥ 静态缓存需优化**（❌ 已经是对的 —— 指纹 assets `maxAge:1y+immutable`、index.html 单独 no-cache）、**⑤ 响应类型不一致**（⚠️ 没给具体点，落不了地；166 处都是 `{success,data}`，例外是文件下载与 SSE，本就不该包装）、**② require 循环依赖**（⚠️ 它看到的正是注释里已写明的处理：`refreshModelCapabilities` 必须每次启动重跑所以不能进版本化迁移，try/catch 已注明首次加载循环即无害空转）、**④ `.env.example` 缺失**（✅ 真的，已补）、**① 108 处 console 未换 logger**（✅ 数字准确，但属规模问题不是缺陷，记作独立待办）。**这份报告漏掉了 §10.11 那个 🔴 权限漏洞**（删成员→会话无主→未登录可读私密对话、可 truncate 清空），却同时写「安全中间件启用、可发布」；也没提 §10.12 的用量少算；且**声称「已写入项目根目录」实际没落盘**（全盘搜不到、git 无未跟踪项）。结论：外部 AI 审核可当**线索来源**、不能当**结论来源**，每条都要回代码核。**③ 新增 `server/.env.example`**：模板文件、无真实密钥、可进 git；脚本双向校验过（代码读到的变量样例全有、样例里的变量代码全在用，零遗漏）。顺带写进三条报告没提但真实存在的风险：**`ENCRYPTION_KEY` 丢失 = 已加密的中转站 key 再也解不开**（本轮端到端验证时真撞上了，换 key 后 `filterStationsForModel` 直接抛）、**`BACKUP_DIR` 默认落在 git 检出目录内**（一次 `git clean -fdx` 连库带 7 份快照一起清掉，样例给了指到仓库外的写法）、**探测开关保持关闭**（曾有中转站因周期性探测封号，v0.7.97）。)
<!-- > **Last Updated**: 2026-08-15 (v0.7.96 — **电脑端侧边栏会话标题被压成一个字**（owner 截图，v0.7.94 把侧边栏 260→190px 之后出现）—— **不是标题内容的问题**（`chatStore.sendMessage` 用 `message.substring(0, 50)` 起标题，本该有 50 字），也不是普通的截断：罪魁是 v0.7.85 那条 `pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100` 的悬停操作条——**`opacity:0` 只是看不见，`display:flex` 让它一直占着约 110px 的宽**。260px 时勉强够，190px 的行里标题就只剩一个字。截图里「帮」后面那片空白其实就是这几个透明按钮。修法＝把操作条**移出文档流**（`absolute right-2 top-1/2 -translate-y-1/2` + 跟随行两种状态的背景色，避免与行底色出现接缝）。**没有选「悬停时才 `display:flex`」**：那样标题会在鼠标划过每一行时重新截断、来回跳。**实测（headless 里 `pointer:fine` 永远不匹配，所以改成手动把操作条 `display` 强制打开来量，`absolute` 本身是无条件工具类）**：操作条隐藏/显示两种情况下标题框都是 103px（证明确实不再占位）；再把只给触屏的 ⋯ 按钮（`pointer-fine:hidden`，headless 下反而是显示的）也隐藏掉，还原真实桌面 → **标题框 131px，约 10 个汉字**。**顺带一提这比修复前的 260px 还宽**：老代码里那条一直占位的按钮条会吃掉约 110px，260px 的行里标题实际只有 80–100px。client 13、tsc/build 净、eslint 0 错 11 警。**owner 的粘贴问题补充了两条线索**：长按时 iOS 的 Paste 按钮**根本不出现**，且复制的是上一条发给 AI 的消息（用的是站内复制按钮）。`MessageBubble.handleCopy` 里 `navigator.clipboard.writeText` 就在点击回调第一行、没有丢失用户手势，理应可用；但它的 `catch` 是**静默吞掉**的，所以复制失败时用户毫无感知——而剪贴板为空时 iOS 本来就不会给 Paste 按钮。仍怀疑 v0.7.95 的放大是主因，待 owner 用修复版复测。) -->
<!-- > **Last Updated**: 2026-08-15 (v0.7.95 — **iPhone 真机：整页比屏幕大、缩放后一点按钮又变回去；键盘收起后输入框卡在屏幕三分之二处、下面一片空白**（owner iPhone 13 Pro 实测报的两个问题，**其实是同一个根因**）—— ① **不是布局宽**：390×844 下实测 `documentElement.scrollWidth` 正好 390、**零个元素溢出**，viewport meta 也是标准的 `width=device-width, initial-scale=1.0`。真凶是 **iOS Safari 在聚焦字号 <16px 的 input/textarea/select 时会放大整个页面，而且永不自动缩回**——本站控件为了桌面密度普遍是 13–15px（输入框 15px），所以**第一次点输入框就触发**，之后每点一个控件又触发一次，正好对上「缩放一下正常、点别的又回去」。**`maximum-scale=1` / `user-scalable=no` 不是解法**：iOS 从 10 起就故意忽略这两个（会剥夺需要放大的人的能力）。唯一有效的杠杆是把字号提到 16px → `index.css` 加 `@media (pointer:coarse){input,textarea,select{font-size:16px}}`。**能盖过 Tailwind 的 `text-[15px]` 靠的是层叠而不是特异性**：`index.css` 里的自定义规则是**未分层**的，而 `@import "tailwindcss"` 把工具类放进 `@layer utilities`，未分层样式整体优先于分层样式（元素选择器 0,0,1 本来是打不过类 0,1,0 的）。全站没有任何控件要求 >16px，所以这条只会往上抬、不会压小。② **第二个问题是第一个的连带伤**：`utils/viewportHeight` 里 `if (vv.scale !== 1) return;` 想的是「别在用户捏合时跟他抢」，但**跳过写入＝把上一次的值永久冻住**；iOS 上的放大既非用户本意、又不会自己解除，于是键盘弹起时写进去的那个小高度在键盘收起后再也没被刷新 → 外壳一直是键盘高度，输入框停在三分之二处、下方空白，**刷新才恢复**（owner 原话）。改成 `scale !== 1` 时**删掉 `--app-height`**、交回 `100dvh` 兜底——永远不会是陈旧值。**Chromium 实测（关键：`Emulation.*` 覆盖是按 CDP 会话生效的，换个连接去量会读到 `pointer:none`，必须同一会话里模拟+测量）**：`pointer:coarse=true`、聊天页与设置页所有控件 16px、横竖溢出都是 0。client 13 测试、tsc/build 净、eslint 0 错 11 警。**owner 报的第三个问题（输入框无法粘贴文字）暂未定位**：`handlePaste` 只在剪贴板含图片时 `preventDefault`，纯文本会正常放行；全站也没有 `user-select:none` / 全局按键拦截。怀疑是①的放大把长按选择菜单顶歪了，待 owner 用修复版复测后再判断。) -->
<!-- > **Last Updated**: 2026-08-15 (v0.7.94 — **侧边栏底部六个入口搬进设置页，侧边栏 260px→190px**（owner 测试时提的：「记忆库、文件库这些放进设置里，侧边栏再缩小一半」）—— 搬哪些是问过 owner 拍板的：**只搬管理/工具类 6 项**（记忆库、文件库、导出对话、导入对话、用户管理、用量日志），**我的群聊和模型竞技场留在侧边栏**——它俩是天天点的主功能，埋进设置页等于每次多两下。新增 `settings/ToolsSection`（放在「默认模型」下面，同属「人人可见」那一档，在管理员专属区块之上），一个 `grid-cols-1 sm:grid-cols-2` 的入口卡，可见性规则原样搬过来（非访客看 4 项、管理员多看 2 项、访客整张卡消失）。**导出/导入是连逻辑一起搬的**——它们是文件选择流程不是导航，侧边栏里也没别处用。**宽度只砍到 190px 不是字面的一半（130px）**：给 owner 算过账，130px 下会话标题只剩约 8 个汉字，而 v0.7.88 才刚修过「标题被按钮挤到只剩 12px」，不想再往那个方向走；190px 下标题约 12 字，owner 选了这个。**手机抽屉仍是 280px**（它是盖在聊天上的浮层，不跟正文抢宽度）。**导航连带改了一处**：这四个页面现在**只能从设置页进**，所以 `Layout` 把它们的返回从 `'chat'` 改成 `'settings'`——退回一个你根本没来过的地方，比省下的那一下点击更糟。**踩到两个坑**：① 注释写进了 `{sidebarOpen && (` 和 `<div>` 之间，那是 JSX 表达式位置、`{/* */}` 不合法，编译直接炸；② `ToolsSection` 里入口表是 render 期构建的，行里挂一个会读 `ref.current` 的函数会被 react-hooks 判 **"Cannot access refs during render"**（哪怕只在点击时读）——改成**点击时临时 `document.createElement('input')`**，连隐藏 input 和 ref 一起去掉，顺带省了「重选同一文件不触发 change」要手动清 value 的老问题。**Chromium 实测**：侧边栏量到 190px；侧边栏只剩 我的群聊/竞技场/设置；设置页「工具与数据」6 个入口齐；点记忆库进去再返回，落回**设置页**。client 13 测试、tsc/build 净、eslint 0 错 11 警（持平），i18n 673=673。) -->
<!-- > **Last Updated**: 2026-08-15 (v0.7.93 — **群聊 @AI 的模型解析与报错，对齐私聊那一套**（owner 测试时报「私聊能用的 deepseek-chat，群聊里 @AI 报 `No enabled station serves model`」）—— ① 根因：`routes/rooms.ts` 调 `streamInvokeModel` 时**没传 `adminPool`**，于是群聊只看得见**公开池**（`sm.enabled=1`），而私聊 `routes/chat.ts:284` 传的是 `{adminPool: isAdmin}`（管理员池 `COALESCE(admin_enabled,1)=1`）；两条路径其余条件（模型名归一化、站点启用、unhealthy 兜底）完全一致，所以「私聊能用、群聊不能用」只可能是这一个差异。按**提问者**取池，不是按房间配置——`PUT /:id/models` 只校验 `isMember`，任何成员都能改房间模型，若按房间放行等于让成员蹭到管理员刻意没公开的模型。检查放在 `beginAiTask` 之前，配置错不占用占位锁、不留孤儿 thinking 气泡。② 空池时改走 v0.7.89 的 `diagnoseNoStation` + `noStationMessage` 契约串，客户端 `GroupChatLayout` 补上从来没接过的 `friendlyErrorKey`（`localizeError` 同时给两个报错面：store 横幅 + 失败气泡，并按 ChatArea 的做法把模型名附在后面）。③ **顺带堵了个泄漏**：`streamInvokeModel` 失败时返回 `errors.join(' | ')`——站点名 + HTTP 状态 + **上游响应体原文**——被 `broadcastStream('error')` 广播给**房间全体成员**并写进共享行，而有的供应商会把你送上去的 key 原样回显。私聊在 v0.7.90 已用 `sanitizeUpstreamDetail` + 明细仅管理员解决，群聊这条完全没有。现在 `invokeModel`/`streamInvokeModel` 都额外收集**结构化**的 `stationFailures`（状态与脱敏后的 body 分开存，`error` 字段保持原样不动，arena/media/deepProbe 行为不变），rooms 用 `classifyUpstreamFailures` 只广播**一条原因**，逐站明细进用量日志（本来就只有管理员看得到）——共享行没有「只给管理员」的缝，所以不像私聊那样内联展开。空 `stationFailures` 只可能是池子在预检之后空掉，那种情况回落到 diagnose 而不是英文原串。**另外按 owner 要求把群聊页三栏改成 1:2:3**（AI 回复栏原来 1:1 太窄读不了长回答）：比例的决定权在 `RoomsPage`——群组列表和 `GroupChatLayout` 外壳是**兄弟节点**，所以外壳给 `md:flex-[5]`（=2+3）、列表 `md:flex-[1]`（夹在 200–320px，笔记本上不挤压群名、超宽屏上不浪费），栏内再 2:3；照旧只在 `md:` 以上生效，手机仍是 tab 单栏。**这正是 v0.7.87 那个「兄弟上下文」陷阱**：只在 `GroupChatLayout` 内部写 2:3、外壳留 `flex-1`，页面会先 1:1 再在右半边分 2:3。**Chromium 实测四档宽度**：1440 → 241:480:719（正好 1:2:3）、1024 → 200:330:494（左栏触底夹逼）、1920/2560 → 320:641:959 / 320:897:1343（左栏触顶）。server 274（+6，`stationFailures` 的状态/脱敏/空池契约）、client 13、tsc/build 净、eslint 0 错 11 警（持平基线）。**记两笔没修的**：群聊的模型选择入口 owner 连着两次没找到（藏在头部一个无文字图标里）；那句 `No enabled station serves model` 把人往「中转站坏了」引，实际是池子权限。) -->
<!-- > **Last Updated**: 2026-08-14 (v0.7.92 — **删掉「每日模型」弹窗，三个模型槽位搬进设置页（owner 明确：想像 Cherry Studio 那样随时切）** — 那个弹窗是 `99c9f90` 跟竞技场/生图/TTS 一起加的，设计前提是「每天开工定一次今天用什么」，所以它才敢让 `prefs.chatModel` 压过顶部选择器——**和 owner 想要的正相反**，也正是 v0.7.91 那个 bug 的土壤。新增 `settings/ModelPrefsSection`（放在设置页最上方，所有人可见）：对话/生图/朗读三个下拉，用现成的 `/api/prefs/catalog`（本来就按能力分好类），**改完即存**，右上角「✓ 已保存」。分工写进 UI 文案：**对话槽位只是「打开应用时的默认值」，顶部选择器随时覆盖**；生图/朗读没有逐条选择器，所以那两个才是真设置。选对话模型时同步写 `localStorage['selected_model']`，两个视图不再打架。**顺手补了个陷阱**：`autoTts` 此前**只被弹窗写死成 true、全站没有开关**——选了 TTS 模型就等于每条回复都自动朗读且关不掉；现在选了朗读模型才出现的复选框可以关。删除 `DailyModelModal.tsx` + Layout 挂载 + store 的 `showDailyModal/closeDailyModal`；服务端 `needsDailyModal/markModalSeen/skipDailyModal` 这些记账字段从 API 拿掉（**两个 DB 列保留**——SQLite 删列要重建表，不值当，改成没人再写）；清掉 9 个只属于弹窗的 i18n key，另修一句指向已删弹窗的错误文案（「请先在每日弹窗里选生图模型」→ 指向设置页）。**真机验证**：桌面 + 390px 手机各跑一遍——弹窗确认不再出现、设置页三个下拉正常（手机自动竖排）、选完 `localStorage` 同步。client 13 测试、server 268、eslint 警告 12→11（删弹窗顺带消掉一个历史 set-state-in-effect）。)<!-- (v0.7.79) — **daily deep probe + arena rendering (owner arena screenshot)** — ① migration v16 + `services/deepProbe`: once a day at a RANDOM time per station, a REAL question (8-question pool, never hello-pings) goes to a random enabled model of that station DIRECTLY (no failover masking); success/failure flips health_status and is usage-logged, `last_deep_probe` prevents restart double-fires; ② arena answers now render as Markdown (`MarkdownMessage`, no more raw ** symbols) and the candidate grid is `items-start` so an error card no longer stretches to match a long answer. +7 tests → server 255.) --> -->
<!-- (v0.7.74) — **聊天内联网搜索 (owner batch #3 — SillyTavern trio COMPLETE)** — migration v15 `web_search_config` (Tavily key encrypted at rest), `services/webSearch` (pure parse/context-build + injectable-fetch `searchWeb`), chat path injects snippets+sources with a cite-instruction when the member flips the new 联网 composer chip (shown only when the admin configured a key in the new Settings card; failures degrade to a normal answer); works once deployed — the offline dev VM can only test the plumbing. +7 tests → server 248.) -->
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
| 5 | **Hardcoded fallback JWT secret + default admin creds** | `middleware/auth.ts:6`; `database.ts` seed (~`:689`) | `JWT_SECRET` falls back to a known literal → forgeable admin tokens; seeded `admin`/`admin123`. Refuse to boot in prod without a real `JWT_SECRET`; force admin password change on first login. **🟡 Partial v0.7.35** — boot-time guards done (`assertAuthSecurity` refuses prod on default secret; `ADMIN_PASSWORD` env + prod refusal). **✅ Done v0.7.59** — forced-change flow shipped (migration v10 flag + boot sweep + non-dismissable dialog). |

### TC1 — §9 security items specified but never implemented (see §9 status table)

| # | Item | §9 ref | Note |
|---|------|--------|------|
| 1 | CORS restrict to origin | §9#5 | `cors({origin:'*'})` → set to deployed frontend origin(s). **✅ Done v0.7.34** — `CORS_ORIGIN` env (comma-separated; default still open). |
| 2 | Rate limiting | §9#4 | none → `express-rate-limit` on `/api/chat` + arena; optional per-user daily token cap vs `api_usage_logs`. **✅ Done v0.7.35** — dependency-free `rateLimit` middleware on chat (60/min) + arena (120/min), per-user/IP, env-tunable. (Per-user *token/day cap* still todo → Phase 3.) |
| 3 | API key encryption at rest | §9#1, §4.1 | plaintext → encrypt station `apiKey` (e.g. AES-256-GCM, key from env). **✅ Done v0.7.37** — `utils/crypto.ts` AES-256-GCM (`enc:v1:iv:tag:ct` envelope), opt-in via `ENCRYPTION_KEY` (unset ⇒ plaintext passthrough = prior behaviour; legacy plaintext auto-detected & passed through on read; encrypted-value-with-no-key throws loud). Encrypt on write (create/update/seed), transparent `decryptSecret` at all station-key read sites (both `getStationsForModel` mappers, `rowToStation`, station health route, `embeddings`, `healthCheck`); boot sweep re-encrypts existing plaintext in place. *(memory_config `embedding_api_key` **✅ covered v0.7.60** — write-encrypt in memories PUT, transparent decrypt at GET + the embeddings call, boot sweep self-heals legacy plaintext.)* |
| 4 | File upload hardening | §9#2 | 20MB limit only → add type allowlist; malware scan optional. |
| 5 | Memory retention purge | §4.8 `retentionDays`, F-MEM10 | config stored + surfaced in UI but **never enforced** → periodic purge job (`0` = keep forever). **✅ Done v0.7.46** — `services/retention.ts` scheduled sweep (boot + every 6h) deletes `memory_entries` older than the configured window; 0/negative = keep forever; policy read live from `memory_config` each sweep. |

### TC2 — Performance / hardening (new scope; not in original spec)

| # | Item | Where | Note |
|---|------|-------|------|
| 1 | **chat history N+1 + re-parses historical PDFs every turn** | `chat.ts:52-116, 224-227` | Per-history-msg attachment query (N+1) **and** `extractFileText` re-decodes every historical PDF (`pdf-parse`, CPU-blocking) on every turn. Batch attachments once; only extract the NEW message. Biggest pure-perf win; worse under team load. **✅ Done v0.7.45** — attachments now batch-loaded in one `WHERE message_id IN (...)` query grouped by message; migration v5 adds `attachments.extracted_text` cache so a historical PDF/text file is parsed **once** (result persisted, incl. `''` for empty) and read from the column thereafter; the new message's extraction is also written to the cache for next turn. |
| 2 | Full history sent to model, no `LIMIT` | `chat.ts:168-170` | Unbounded prompt size / cost / latency as threads grow. Cap to last N turns — weigh vs §3.3 "maintain context". **✅ Done v0.7.49** — owner decision (2026-07-26): last 20 turns verbatim by default, admin-tunable (`memory_config.history_max_turns`, 0=unlimited), memory-RAG covers older context; sliced before the attachment batch load so dropped turns cost nothing. |
| 3 | Vector search = unbounded full scan + `JSON.parse` per row | `embeddings.ts:249` | Bound by recency/importance as `memory_entries` grows across all users. **✅ Done v0.7.52** — recency-bounded: `ORDER BY created_at DESC LIMIT scanLimit` (default 2000, `VECTOR_SCAN_LIMIT`, 0=unlimited); user scoping applies BEFORE the window so another member's newer rows can't evict yours. |
| 4 | No `busy_timeout` pragma | `database.ts:12` (getDb) | `db.pragma('busy_timeout = 5000')` — cheap insurance vs `SQLITE_BUSY` (backup / 2nd process). **✅ Done v0.7.34.** |
| 5 | Redundant per-turn embeddings | `chat.ts:271, 739` (+ 2 auto-save) | Same query embedded 2–4× per turn; dedupe the query embedding. Also `resolveModel` (`:173`) does a station scan whose result is unused (recomputed at `:311`). **🟡 Partial v0.7.45** — the query-side double-embed is gone: the file-RAG search and the memory vector search now share ONE `generateEmbedding(message)` (threaded via a new optional `precomputedEmbedding` param on `retrieveRelevantMemories`). **✅ resolveModel scan gone (v0.7.55)** — chat.ts computes its station pool once via the shared `modelInvocation.getStationsForModel`; the local near-duplicate implementations are deleted. Still open (by design): the 2 auto-save embeddings — each turn's user+assistant messages genuinely need their own embeddings to be stored. |

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
| Admin usage & **cost** dashboard | `admin/UsageLogsPage.tsx` + API agg | M | high | Per-user / per-model aggregation + $ cost. Data already in `api_usage_logs`. Top team concern. **🟡 Token usage done (v0.7.38)**; **✅ $ cost done (v0.7.54)** — owner picked the admin-editable per-model unit-price table (migration v9 `model_pricing`, per 1M tokens, currency-agnostic); cost columns on all three aggregates with an explicit never-guess rule for unpriced models (`null` + `costIncomplete` floor marker). |
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
- **Phase 5 — polish:** TC2 perf (chat N+1 + historical re-parse, history `LIMIT`, vector-scan bound, dedupe embeddings), retention purge (TC1 #5), member invite/onboarding (FE-B), chat organize/pin/folders (FE-A), a11y/keyboard/ARIA. Effort: many small. **🟡 In progress:** chat-path perf **✅ done (v0.7.45)** — batched attachment load (killed the N+1), `attachments.extracted_text` cache (migration v5) so historical PDFs/text files parse once not every turn, and one shared query embedding across file-RAG + memory search. Retention purge (TC1 #5) **✅ done (v0.7.46)** — `services/retention.ts` scheduled sweep enforcing `memory_config.retention_days`. Chat organize (pin/folders, FE-A) **✅ done (v0.7.47)**. Member invite/onboarding (FE-B) **✅ done (v0.7.48)**. History `LIMIT` (TC2 #2) **✅ done (v0.7.49)** — the product call was made: recent-verbatim + memory-RAG hybrid, default 20 turns. Vector-scan bound (TC2 #3) **✅ done (v0.7.52)**. A11y **✅ done (v0.7.53)**. **Phase 5 COMPLETE — the 2026-07-20 team-readiness roadmap (Phases 0-5) is closed.**

---

## 10.9 Team rollout backlog — owner's priorities (2026-07-26)

> **Context:** the owner is being promoted to lead a 4-5 person team and will deploy this
> instance on a company server (deployment itself is out of scope here — tracked by ops).
> This section is the agreed feature order for making the product team-ready, sequenced by
> "when it would bite": P0 = before the first invite goes out, P1 = first week of team use,
> P2 = first month, P3 = recorded but deliberately not started.

### P0 — before inviting the first teammate

| # | Item | Why | Status |
|---|------|-----|--------|
| 1 | New conversations default to **private** | Team context flips the calculus: default-public chats between colleagues is a privacy landmine; sharing becomes the deliberate act. | **✅ v0.7.58** |
| 2 | **Forced password change on first login** | The seeded admin credential (`admin`/`admin123`) is public knowledge; the boot-time guard (v0.7.35) warns but doesn't force. Closes §10.8 TC0 #5's remaining half. | **✅ v0.7.59** |
| 3 | **Encrypt `memory_config.embedding_api_key` at rest** | The v0.7.37 crypto covered station keys but explicitly deferred this column; a plaintext API key on a company server is an audit flag. | **✅ v0.7.60** |

### P1 — first week of team use

| # | Item | Why | Status |
|---|------|-----|--------|
| 4 | **Group-chat unread badges + AI-done notification** | Rooms have no unread markers and long AI runs finish silently — collaboration tools without a red dot lose half their pull. Highest-value NEW feature for a team. | **✅ v0.7.61** |
| 5 | **Onboarding guide refresh** | `GuideOverlay` still describes the pre-team product; pin/folders, persona library, file visibility, group chat and invites are absent. First-login impression decides adoption. | **✅ v0.7.62** |

### P2 — first month

| # | Item | Why | Status |
|---|------|-----|--------|
| 6 | **Admin announcement banner** | The lead needs a broadcast channel ("maintenance tonight", "new model added") that isn't a group-chat ping. Admin-editable, member-dismissable. | **✅ v0.7.63** |
| 7 | **Friendly error copy** | Raw errors ("HTTP 503") route every failure to the lead's DMs; mapping the common failures to plain-language messages with a suggested action deflects most of them. | **✅ v0.7.64** |
| 8 | **Team knowledge base** *(owner addition 2026-07-26)* | Everyone can view/upload (delete stays uploader/admin); uploads are team-visible, auto-digested by AI (type + keywords + summary), readable as markdown with a 查看原文 door to the original bytes; keyword search surfaces every related document. | **✅ v0.7.65** |

### P3 — recorded, deliberately not started

- Mobile PWA wrapper; model-capability auto-detection (§13); operation audit log (who deleted which file); client dead-dep removal (needs a networked session, see v0.7.52); offsite backup sync + restore drill (ops, alongside deployment); deployment env checklist (`JWT_SECRET`/`ENCRYPTION_KEY`/`CORS_ORIGIN`/`REQUIRE_INVITE=1` — ops).

### 追加批次（owner 2026-07-26，SillyTavern-inspired「越来越懂项目的 AI」）

Owner 愿景：一个随项目进程越来越了解项目的 AI——既能联网给新灵感，又随聊天记录不断学习。参照 SillyTavern 的 World Info / Data Bank / 联网扩展设计，选定三块（人设卡结构化升级暂缓）：

1. **项目世界书**（v0.7.72 ✅）— 关键词触发的团队共享设定词条，聊到即自动注入；文件库新增「世界书」标签页。
2. **自动蒸馏学习**（v0.7.73 ✅）— 每 N 条消息 AI 自动提炼结论/决定/偏好存入记忆库（distilled 标签，带向量，被现有 RAG 注入自动召回）；复用 kbSummarizer 的内部调用基建；记忆设置里可开关/调频率。
3. **聊天内联网搜索**（v0.7.74 ✅）— 管理员在设置页配置 Tavily API key（加密存储），成员在输入框开启「联网」chip（未配置时不显示），检索结果+来源注入上下文并要求回答附「参考来源」；搜索失败自动退化为普通回答；离线开发机只能测流程，部署后生效。

### 移动端适配计划（owner 手机实测反馈 2026-07-26 · 批次 1-4 全部完成 v0.7.82→86 · **待 owner 真机验收**）

**现状盘点**（2026-07-26 代码扫描）：viewport meta ✓；Tailwind 断点体系（md=768px）✓；已有三个可复用的成熟先例——主侧边栏手机抽屉（Layout）、群聊列表↔详情切换（RoomsPage）、表格卡片化（v0.7.21 给 Memory/Files/Users 做过）。但 37 个组件文件中 **24 个零响应式类**，整体约一半界面未适配。owner 手机实测确认观感差。方法论：把既有模式复制到未适配页面，分小批版本推进，每批 tests+build 绿 → push 自动部署 → owner 手机刷新验收。

**批次 1 · P0 群聊页（最重灾区）✅ v0.7.82**：`GroupChatLayout` 是「人类聊天 | AI 回复」左右双栏硬布局（仅 1 处响应式类），手机上两栏挤压成条 → 手机改单栏 + 顶部「群聊 / AI 回复」标签切换；`NotepadBar`（工作记录条）一并收纳；两栏各自的输入/导出控件按窄屏重排。

**批次 2 · P0 聊天主页 ✅ v0.7.82**：`ChatArea` 顶栏（模型选择 + 人设 + 主题/语言 inline 集群）小屏溢出 → 图标化压缩或允许折行；`ChatInput` 上方状态行（公开/自我审查/联网/选择文件）小屏溢出 → 改横向滚动；`MessageBubble`/`MarkdownMessage` 宽表格与代码块横滚校验；`ModelSelector` 下拉在窄屏的宽度与触控。

**批次 3 · P1 表格页与面板 ✅ v0.7.84（用量日志）+ v0.7.86（其余）**：`UsageLogsPage` 纯桌面表格（0 响应式）→ 复用 v0.7.21 堆叠卡片模式（**已写、未提交**：桌面表加 `hidden md:block`，手机走新的堆叠卡列表）；`SettingsPage` 中转站卡片按钮群、公告/联网搜索卡、管理模型列表补断点；`KnowledgeBasePanel` / `LorebookPanel` 半适配 → 卡片栅格、工具栏（搜索+类型 chips+上传+URL导入）窄屏重排；`FileBrowser` 顶栏按钮群折行。

**批次 4 · P2 弹窗与细节打磨 ✅ v0.7.86**（安全区与竞技场两个子面板经审查证伪、已移出范围，见下节）：全站弹窗统一「手机留边距 + max-h 限高内滚」（SystemPromptModal、AnnouncementManager 向导、ForcePasswordModal、DailyModelModal、ImageConfirmModal、竞技场放大阅读、RegexManager、McpServerManager）；触控目标 ≥44px；iPhone 刘海安全区 `env(safe-area-inset-*)`；键盘弹起遮挡输入框（100vh → dvh）；`BenchmarkPanel`/`PromptLabPanel`（竞技场子页，0 响应式）。

**待办输入**：owner 手机测试中发现的其他 bug 清单（待汇总，届时与适配批次合并排班）。

### 移动端深度审查结果（2026-08-09，v0.7.84 — owner 要求「其他地方还有没有问题」）

上一次盘点只数了「有多少组件带响应式类」，这次是**逐个找具体故障**。关键背景：`index.css` 给 `html, body, #root` 设了 `overflow: hidden` —— **溢出的内容不会变成横向滚动，而是被直接裁掉、永远够不着**，所以下面的「溢出」都比一般网站更严重。

**P0 — 功能在手机上完全不可用（不是难看，是没有入口）✅ 已于 v0.7.85 修复**：三处操作按钮用 `opacity-0 group-hover:opacity-100` 做「悬停才显现」，而触屏没有 hover：
1. `MessageBubble:160` — 消息操作栏（复制 / 重新生成 / 编辑重发）。**v0.7.41 整块功能在手机上等于不存在**，且这是主聊天页、每条消息都受影响。
2. `Sidebar:353` — 会话的置顶 / 移入文件夹按钮。**v0.7.47 整块功能手机不可用**。
3. `SystemPromptModal:286,295` — 团队人设的重命名 / 删除。成员在手机上管不了自己建的人设。
   **修法（v0.7.85）**：全站 8 处统一换成 Tailwind v4 的 `pointer-fine:` 变体，编译成 `@media (pointer:fine)` —— 鼠标设备行为一模一样，触屏设备按钮常驻。没用项目惯用的 `md:` 断点，是因为**触屏平板在 ≥768px 走的是桌面分支**，用 `md:` 修不到它；同理顺带把 `FileBrowser`×2、`MemoryBrowser`、`UserManagement` 配额铅笔（都在 `hidden md:block` 桌面块里）一并覆盖。
   （下列为已核查的**误报**，手机上本来就没问题：`FileBrowser:741,816` 与 `MemoryBrowser:648` 的悬停按钮都在 `hidden md:block` 桌面块里，手机走的是 v0.7.21 卡片分支；`UserManagement:94` 的铅笔只是提示图标，整行本身是 `<button>`，手机仍可点，只是发现性差。）

**P1 — 单行横排被裁掉**（都缺 `flex-wrap` / 断点）✅ **已于 v0.7.86 修复**（`SettingsPage` 经复查无需改动）：`RegexManager:183` 的 `grid-cols-2` 与 `:205` 的 `grid-cols-3` 硬网格（正则表单在手机上挤成条）+ `:255` 标签行无 wrap；`KnowledgeBasePanel:119` 工具栏（搜索框 + 从网址导入 + 上传三件一行）；`FileBrowser:311` 顶栏 3 个按钮 + 面包屑；`LorebookPanel:121` 工具栏；`SettingsPage`（718 行仅 1 处响应式）的中转站卡片按钮群；`McpServerManager` 服务器卡片的 4 按钮行。

**P2 — 弹窗无限高**（缺 `max-h` + 内滚，内容一长就顶出屏幕且滑不动）✅ **已于 v0.7.86 修复（全站 11 个弹窗现已全部限高）**：`GuideOverlay:56`（最糟——还带 `overflow-hidden`，超出部分直接消失）、`ForcePasswordModal:46`（新成员首次登录**必过且不可关闭**，最该修）、`DailyModelModal:68`、`ImageConfirmModal:69`、`AnnouncementManager:114`、`RoomsPage:199` 新建群组、`GroupChatLayout:721`。
✅ **已经做对、不用动的**：`SystemPromptModal`(max-h-[85vh]+内滚)、`KnowledgeBasePanel:267` 阅读overlay、`ArenaLayout:360` 放大阅读、`GroupChatLayout:609`。

**P3 — 全局** ✅ **已于 v0.7.86 修复**：① **键盘遮挡是真问题** —— `html, body, #root { height: 100% }`，iOS 上 100% 解析成大视口，键盘弹起时输入框被盖住；改用 `100dvh` 即可。② 触控目标：全站 **33 个** `p-1`/`p-1.5` 图标按钮不足 44px（`UserManagement` 11 个、`RegexManager` 8 个最密集）。

**❌ 从批次 4 里划掉的两项（审查证明不是问题，省掉的工作量）**：
- **安全区 `env(safe-area-inset-*)`**：viewport meta 是默认的 `viewport-fit=auto`（没有 `cover`），iOS 本来就把页面限制在安全区内、不会被刘海或底部横条遮挡。除非将来主动做沉浸式全屏，否则**无需处理**。
- **`BenchmarkPanel` / `PromptLabPanel`**：原盘点标成「0 响应式」，但实测两者用的是 `flex-wrap`（BenchmarkPanel 3 处、PromptLabPanel 1 处）加 `grid-cols-1 md:grid-cols-2` / `sm:grid-cols-2`，窄屏会自然折行，**基本可用**，优先级应降到最后。

---

## 10.10 运维成熟度 backlog — 「能不能不用天天盯着」（2026-08-15，owner 问「这个项目算成熟了吗、什么状态算能上线」）

**先立标尺。** 软件没有「成熟 / 不成熟」的分界线。真正的标准是：**有多少人依赖它、坏了有多糟、以及能不能知道它坏了。** 同一份代码，一个人自用是成熟的，给 20 人团队用可能就不是。本节按当前目标 —— **3–10 人内部团队** —— 校准。

**当前结论（2026-08-15）**：给这个规模的团队用**已经可以**，而且已经在线上跑了；但**还不能不盯着**，差下面 ① ②。

### 已经有的（这些最贵、最难事后补，所以值得记一笔）

| 能力 | 落地位置 |
|---|---|
| 编号迁移 + 事务 + 账本 | `migrations.ts` / `SCHEMA_MIGRATIONS`（v0.7.36） |
| 每日备份 + 保留 N 份轮转 | `services/backup.ts`（v0.7.36） |
| API key 静态加密（AES-256-GCM） | `utils/crypto.ts`（v0.7.37） |
| 按用户隔离：会话 / 文件 / 记忆 / RAG 注入 | Phase 1 v0.7.35 + 文件可见性 v0.7.44 |
| 限流、每人月度配额、用量看板 | v0.7.35 / v0.7.39-40 / v0.7.38 |
| 后端自动测试 277 | `server/src/**/*.test.ts` |
| 决策与「为什么」的完整记录 | 本文件 §12 + 各版本条目 |

### 还缺的 —— 按重要性排序

**① 备份从来没有真正恢复过一次** ⚠️ 唯一一个「不做就可能出大事」的
备份文件存在 ≠ 能恢复。这是行业里最经典的坑：出事那天才发现备份是空的、或者格式对不上、或者少了 attachments。
**做法**：取一份 `data/backups/app-*.db`，用 `DB_PATH` 指向它在旁边端口起一个服务，确认表数、会话数、消息数、附件都在。**约 30 分钟，一次性。** 做完在这里记下当次的数字，以后每次大改 schema 后重跑一遍。

**② 坏了没人知道**
现在同事半夜用出错，只能等他来告诉 owner。`api_usage_logs` 里有完整记录（v0.7.90 起连上游原文都存了），但**没有任何东西会主动看它**。
**做法**：一个定时任务扫最近 N 分钟 `status='error'` 的行，超过阈值就发通知（邮件 / Server 酱 / Telegram 均可）。**约半天。** 注意别做成新的滥用特征 —— 只读本地 DB，不碰中转站（见 v0.7.97 被封号那次）。

**③ 推代码直接上线，没有缓冲**
`push 到 main → GitHub Actions → 生产`。2026-08-15 一天内往生产推了 5 次，而 owner 同时在用。只有一个人用时没事，人多了**每次部署都是拿全团队做实验**。
**做法**（由轻到重）：至少养成「部署后自己先冒烟测一遍」的习惯 → 或加一个 staging 环境 → 或给 deploy.sh 加自动回滚。

**④ 前端没有自动测试**（后端 277，前端 13）
**2026-08-15 owner 报的每一个 bug 都是前端的**（iOS 缩放、键盘高度、侧边栏标题、三栏比例、流式滚动、文件选择器）—— 这不是巧合，**没有测试的那一层就是 bug 藏身的地方**。
不必马上补，但要认清代价：**前端的问题只能靠人肉发现，也就是靠 owner**。真要补，优先级是纯函数（`utils/errors`、store 的 reducer 类逻辑）> 组件渲染 > 端到端。

### 给 owner 的自查信号（不用懂代码）

看**测出来的 bug 属于哪一类**：

- 💚 **长得不对**（比例、截断、滚动）→ 地基是好的，在打磨
- 🟡 **用不了**（报错、点了没反应）→ 功能有洞，但不伤数据
- 🔴 **数据出事**（看到别人的对话、消息丢失、改一个删一堆）→ **别上线，先修**

2026-08-15 全天报的 bug **全部是前两类，零红色**。

---

## 10.11 全量代码审计 —— 「有没有屎山代码」（2026-08-21，owner 要求先查一轮再修）

覆盖 `client/src` + `server/src` 全部 120 个文件 / 34,268 行自有代码（不含依赖与测试）。
用自写脚本量化：坏味道计数、花括号配对的函数长度、缩进深度、8 行以上重复块、
同名类型跨端比对、未被引用的导出与孤儿文件。

### 结论：不是屎山

| 指标 | 实测 | 判读 |
|---|---|---|
| `any` 类型 | 16 / 34,268 行 | 「几乎没有」的水平 |
| `@ts-ignore` | 1 | 屎山项目通常几十上百 |
| TODO / FIXME / HACK | **0** | 没有欠条 |
| 注释掉的死代码 | 1 行 | 屎山标志性特征，基本没有 |
| 空 `catch` | 19 处，**全部写了原因** | `/* private mode */`、`/* non-fatal */` — 是好实践 |
| 服务端测试 | 35 文件 / 277 用例，全绿 | |
| `tsc -b` | 0 错误 | |

真正的屎山是「满屏 any + 到处 ts-ignore + 大段注释掉的死代码 + catch 里啥也不写」。本项目都不沾。
**问题不在「乱」，在「长」和「重复」。**

### 五处结构性债务（按严重程度，即 owner 指定的修复顺序）

**① 🔴 客户端几乎没有测试 —— 唯一被现实验证过的风险**

```
服务端  16,095 行 → 35 个测试文件 / 277 用例
客户端  18,616 行 →  2 个测试文件 /  13 用例
```

那 2 个文件测的还是 `utils/errors.ts`(53 行) 和 `utils/markdown.ts`(128 行) —— **两个最小的工具文件**。
18,000 行界面代码零测试。

不是抽象风险：2026-08-15 owner 真机测出的 5 个 bug（手机超屏 / 输入框卡 2/3 / 粘贴失败 /
侧边栏只剩一字 / 流式时不能滚）**全部在客户端**。§10.10 里那句「前端的问题只能靠人肉发现」
已经应验。补测试优先级：纯函数 > store 逻辑 > 组件渲染。

**② 🔴 三个巨型函数 / 组件**

- `server/src/routes/chat.ts:154` 的 `POST /` 处理函数：**697 行 · 64 个 if 分支**，
  一个函数里串了鉴权→配额→存消息→正则变换→附件→历史加载→提取缓存→节点选择→
  SSE→多模态拼装→文件 RAG→记忆注入，共 12 件事
- 客户端单函数行数 / useState 数：`FileBrowser` 829/9、`GroupChatLayout` 789/17、
  `MemoryBrowser` 704/13、`UserManagement` 713/**20**、`SettingsPage` 684/**18**
- 全项目 **97 个函数 > 60 行，30 个 > 150 行**；最大缩进深度 22 层（`SettingsPage`）

注：这些代码注释写得好、读得懂。代价不是「看不明白」，是**没法单独测试、改动时波及面不可控**。

**③ 🟡 前后端类型各写一份，30 个同名、8 个已漂移**

`server/src/types.ts`(35 个) 与 `client/src/types/index.ts`(66 个) 有 30 个同名定义，
其中 22 个完全一致（纯重复维护成本），8 个已经不一致。两个值得警惕：

| 类型 | 漂移 | 实证 |
|---|---|---|
| `ModelCapability` | 服务端缺 `'tts' \| 'embedding'` | 但 `routes/prefs.ts:184` 实际就在用 `'tts'` — 服务端类型是错的 |
| `StationModel` | 服务端类型无 `adminEnabled` | 但 `routes/stations.ts:31` 实际返回了该字段 |

其余 6 个：`UserPublic`(+isVirtual)、`Message`(+toolCalls)、`Attachment`(messageId 必填/可选不一致)、
`McpServer`(+toolCount)、`RegexScript`/`RegexPreset`(+ownerUsername) —— 均为客户端多字段。

**④ 🟡 `routes/users.ts` 同一段行映射写了 3 遍，且已抄漏**

第 116 / 239 / 324 行是同一个「DB 行 → `UserPublic`」映射，第二份**漏了 `monthlyTokenLimit`**：

```
GET  /api/users/      ✅ 含配额字段
GET  /api/users/:id   ❌ 漏
PUT  /api/users/:id   ✅ 含
```

**目前客户端只调 `list`/`update`，从不调 `GET /:id`，所以是埋着的坑而非活的 bug。**
但下一个用到该接口的人会拿到静默的 `undefined` → `?? 0` → 界面显示「不限制」，不报错、只是数字错。

**⑤ 🟢 少量死代码**

- `client/src/components/layout/LanguageToggle.tsx` + `ThemeToggle.tsx`（共 60 行）：
  已被 `TopRightToggles.tsx` 重写取代，**无任何文件 import**（v0.7.78 改造的遗留）
- `middleware/auth.ts:136` 的 `requireAdmin`：定义后一次未用（各路由都内联写 `requireAuth, requireRole('admin')`）
- `server/src/types.ts` 的 `MemoryTag` / `FileChunk` / `PresetScript`：定义后从未使用
- `database.ts:625-627` 残留 3 个 `try { ALTER TABLE } catch {}`：绕过了自建的迁移账本
  （`SCHEMA_MIGRATIONS` 已有 16 条正式迁移），正是 `migrations.ts` 头注释里说要取代的那套写法

### 修复顺序上的硬约束

**① 必须在 ② 之前。** 没有测试就去拆 697 行的函数，等于闭眼做手术 —— 那才是真会出事的操作。
③④⑤ 之间无依赖，可穿插进行。

---

### 🔴🔴 审计过程中发现的真实安全漏洞（2026-08-21，已修复并实测验证）

**这一条不在上面五项里 —— 它是顺着 ④「归属权规则重复」这条线索挖出来的，
严重程度远高于其余全部，属于 §10.10 自查信号里的「🔴 数据出事」类。**

#### 漏洞链条

```
管理员在「用户管理」里删掉一个成员
  → DELETE FROM users WHERE id = ?            （users.ts:358，只删这一行，没别的处理）
  → 外键 ON DELETE SET NULL 触发               （database.ts:524，foreign_keys 在 :267 是开着的）
  → 该成员全部会话的 user_id 变成 NULL          （即「无主会话」）
  → canReadConv 判定 user_id == null 为「所有人可读」
  → GET /api/conversations/:id/messages 对未登录请求返回 200，私密内容完整可读
  → POST /api/conversations/:id/truncate 的内联规则同样放行，未登录即可把消息全部删除
```

**不是只影响「历史遗留数据」**：`conversations.user_id` 是后加的列且未回填，
所以早期会话本来就是无主的；而 `ON DELETE SET NULL` 让「删用户」成为一个
**持续产生**孤儿会话的机制。删一个人 = 把他的全部私密对话对公网开放。

#### 实测复现（本地演示实例，未触碰真实数据）

```
删用户前：未登录读该私密会话  → HTTP 404   ✅
管理员删除该用户              → HTTP 200
删用户后：未登录读该私密会话  → HTTP 200   🔴 完整读到私密内容
         未登录调 truncate    → HTTP 200   🔴 消息被清空，剩 0 条
```

#### 修复

新增 `server/src/services/conversationAccess.ts` —— **规则唯一的一份**，
把原先散在三处、语义还不一致的判断统一起来（顺带解决了 ④ 的一部分）：

| 位置 | 修复前 | 修复后 |
|---|---|---|
| `conversations.ts` `canReadConv` | 无主 → 所有人可读 | 无主 → **仅管理员** |
| `conversations.ts` truncate 内联规则 | 无主 → 所有人可改 | 改用 `canModifyConv` |
| `chat.ts:173` 内联规则 | 无主 → 所有人可发消息 | 改用 `canModifyConversation` |
| `GET /conversations` 列表 SQL | `OR user_id IS NULL`（所有登录用户可见） | 仅管理员带这个条件；访客加 `AND user_id IS NOT NULL` |

额外收紧一条：**无主会话即使 `visibility='public'` 也不放行非管理员** ——
那个值是它被孤儿化之前留下的，不代表所有者的意愿。

**刻意不销毁数据**：孤儿会话不是被删掉，而是收归管理员可见，由人决定归属或清理。

#### 修复后实测

```
7.  未登录读该会话      200 → 404   ✅
8.  未登录调 truncate   200 → 403「You do not have permission to modify」 ✅
9.  其他已登录成员读     → 404       ✅
10. 管理员读            → 200       ✅（仍可处置）
```

`services/conversationAccess.test.ts` 13 个用例锁住不变量，
含一个穷举 user × visibility 全组合的测试。

#### 仍待 owner 决策（不属于安全修复范围）

删除用户时，他的**会话 / 记忆 / 文件应该怎么处理**？当前是「留下变成孤儿，归管理员」。
其他可选：一并删除、或转交给某个指定账号。这是产品决策不是技术决策，先不替 owner 定。

---

### 修复进度（2026-08-21 起，逐项推进）

| 项 | 状态 | 内容 |
|---|---|---|
| 🔴🔴 安全漏洞 | ✅ 已修 + 实测验证 | 见上 |
| ① 客户端测试 | ✅ 本轮目标达成 | 13 → **47** 个用例（2 → 5 个文件）；顺带修出两个真 bug |
| ② 巨型函数 | 🟡 抽出四块并测住 | 697 → **653** 行；新增 47 个用例覆盖原先零测试的逻辑。**剩下的故障转移/SSE/工具往返 240 行是一次重新设计，未做** |
| ③ 类型合并 | ✅ 完成 | 8 处漂移 → 2 处（有文档的故意差异）；立了一道**已验证会失败**的闸 |
| ④ users.ts 重复映射 | ✅ 完成 | 三份映射合一，连 SQL 漏字段一起修；7 个用例 |
| ⑤ 死代码 | ✅ 完成（含一处审计修正） | 见下 |

**测试总量：server 277 → 323，client 13 → 47（合计 290 → 370）。**
tsc 两端净、构建净、eslint 0 错 12 警（警告都是原有的）。

#### ② 抽了什么

既有约定是「抽纯函数 + 导出 + 单测」（`limitHistory` 是样板），照办：

| 新模块 | 抽出的逻辑 | 用例 |
|---|---|---|
| `services/chatContent.ts` | 消息正文 + 附件 → 上游 content。原先**本轮消息和历史消息各写了一份**一模一样的 `contentParts`/`textContent`/`hasImages` 推演（76 行 → 48 行，且规则只剩一份） | 12 |
| `services/toolCallStream.ts` | 流式 `tool_calls` 按 index 累加、跨 chunk 拼接、按 index 排序输出 | 10 |

顺手加固一处：原先 `Array.from(toolCallsMap.values())` 用的是 Map 插入序，
并行调用时不保证等于 index 序。上游是按 `tool_call_id` 配结果的，所以**不是活着的 bug**，
但换成显式排序不花成本。

**剩下的 668 行为什么没当场继续拆**（后续 B/C 又拆掉两块，见下文，现为 653 行）：
主体是节点故障转移 + SSE 流式 + 工具调用往返（约 240 行）、
五段上下文注入（约 100 行）、自审一遍（约 70 行）。这些都深度耦合网络与数据库，
要拆得安全需要引入依赖注入（项目里 `InvokeModelDeps`/`DeepProbeDeps` 已有这个形状），
属于一次独立的重新设计 —— 半拆只会增加间接层而不增加安全性。

#### ③ 怎么合的

**没做大手术**：抽 shared 包要改两边 tsconfig、Vite 解析、部署脚本，风险远大于收益。
真正的问题不是「写了两份」，而是**漂移没人发现**。所以：

1. 把 6 处「服务端实际返回了、但自己的类型没写」补齐 ——
   `ModelCapability` 补 `tts`/`embedding`（`routes/prefs.ts:184` 一直在用）、
   `UserPublic.isVirtual`、`StationModel.adminEnabled`/`publicEnabled`、
   `McpServer.toolCount`（`routes/mcp.ts` 原先用 `McpServer & { toolCount }` 绕过）、
   `RegexScript`/`RegexPreset.ownerUsername`
2. 客户端 `StationModel.capabilities` 从 `ModelCapability[] | string[]` **收紧**为
   `ModelCapability[]`（放宽的理由消失了）；两处 `ownerUsername` 改成 `string | null`
   （服务端返回的是 `owner_username || null`）
3. 新增 `server/src/typeParity.test.ts`：**同名类型必须逐字段一致**，
   故意的差异要写进 `INTENTIONAL_DIFFERENCES` 白名单并说明理由。
   另有一条断言防止白名单越攒越大。

保留的 2 处故意差异：`Message.toolCalls`（前端从 SSE 事件自己攒的展示字段，
服务端根本不返回）、`Attachment.messageId`（服务端描述 DB 行必有；
客户端还要兜 chat SSE 的 `attachmentMeta`，那里没有这个字段）。

⚠️ 这道闸**验证过真的会失败**：故意给服务端 `Station` 加一个字段，
测试立刻报 `Station: 仅服务端 [deliberateDriftProbe?: boolean;]`，然后已还原。

#### ⑤ 清了什么，以及一处审计修正

已删：
- `client/src/components/layout/LanguageToggle.tsx` + `ThemeToggle.tsx`（共 60 行）——
  v0.7.78 被 `TopRightToggles.tsx` 重写取代，无任何文件 import
- `middleware/auth.ts` 的 `requireAdmin`（定义后一次未用）
- `server/src/types.ts` 的 `MemoryTag` / `FileChunk` / `PresetScript`（定义后从未使用；
  无人校验的类型声明放着只会误导，因为它们早就不跟表结构同步了）

**❗️审计修正：`try { ALTER TABLE } catch {}` 不是死代码，也不是债。**

审计原文说「`database.ts:625-627` 残留 3 个」，两处都错：

1. **数量错了**：实际是 **11 处**（我当时的 grep 只匹配了 `catch` 写在同一行的写法，
   漏掉了多行写法）。账本里另有 14 处正式迁移。
2. **判断错了**：这 11 处**必须存在**。`SCHEMA_MIGRATIONS` 的
   `{ version: 1, name: 'baseline-schema', up: (d) => initTables(d) }` ——
   `initTables` 本身就是 v1 迁移，它的职责是**重演**账本诞生之前的建表历史：
   先按最初的样子建表，再逐个补列。所以 `CREATE TABLE conversations` 里
   故意没有 `user_id`，靠第 524 行的 ALTER 补上。
   **删掉这些 ALTER，新建库会直接缺列，应用起不来。**
   而 `try/catch` 是这次重演的幂等性来源：账本之前的部署可能停在任意一个中间
   schema 状态，v1 必须对所有这些状态都安全。

`migrations.ts` 头注释说的「取代旧的 ALTER 堆」指的是**此后的所有变更**（v2–v16），
不包括 v1 基线本身。这一条从 backlog 里划掉。

#### ① 的过程中修掉的两个真 bug

1. **英文界面显示 `3 script{s}`** —— `{s}` 是英文复数占位符，原先要靠调用点自己传，
   六个调用点里**四个忘了**（`regex.scriptsCount`/`presetsCount`、`files.chunks`、
   `files.selectedFiles`），英文用户看到的就是字面量 `{s}`。另有一处传成
   `count > 1 ? 's' : ''`，导致 0 个站点显示成 `0 station available`。
   改为在 `t()` 里从 `count` 统一推导，调用点不用再管；新增 `i18n.test.ts` 15 个用例
   （含中英键对齐、源文件重复键、占位符一致性）锁住。

2. **群聊也有「AI 输出时无法滚动」的同类问题** —— `GroupChatLayout` 的两个 effect
   是无条件 `scrollIntoView({behavior:'smooth'})`，和 `ChatArea` v0.7.97 修掉的是同一类：
   翻上去看之前的回答，队友一发言就被拽回底部。把判定抽成
   `utils/scrollFollow.ts`（纯函数 + 13 个用例），`ChatArea` 与 `GroupChatLayout`
   两栏共用同一套规则。

---

### 本轮：输入法卡顿 + 上下文注入段（2026-08-22，已完成）

#### A. 手机输入法弹出时输入框「卡一下」

owner 真机反馈（2026-08-22）：「手机自带输入法弹出来的时候网页的输入框向上会卡一下，
不影响使用，只是不流畅」。8-15 报的另两个手机 bug（选择文件无反应、iOS 粘贴）
owner 已确认修好，划掉。

**怀疑**：`utils/viewportHeight.ts` 在 `visualViewport` 每次 resize 时都写一遍
`--app-height`。iOS 输入法弹出是一段动画，这期间 resize 会连续触发，
每次写入一个中间高度 → 反复重排 → 表现为「向上卡一下」而不是平滑上移。

**做法（owner 选定方案 A）**：用 `requestAnimationFrame` 合并写入，
一帧最多写一次。这是处理 resize 抖动的标准手法，代价几乎为零。
没有 rAF 的环境直接同步执行，行为退回改造前。

**结果**：`utils/viewportHeight.test.ts` 6 → **11 个用例**，新增的一组专测合并行为：
同一帧连来 5 次 resize 只写 1 次、写的是最后一次的值、跨帧不合并、
清理时取消未执行的帧、没有 rAF 时退回同步。

⚠️ **本地无法验证是否真的解决了卡顿**：iOS 输入法引起的 visualViewport 变化是
iOS 独有行为，无头浏览器模拟不出来。代码层面「一帧只写一次」已被测试钉死，
但**体感是否改善只能由 owner 真机确认**；若无效则改用防抖（~100ms）方案。

#### B. ② 继续：上下文注入段（约 100 行）

**先纠正昨天的判断** —— 这一段的情况比记录的好：五段注入里**已经有两段**
是按「抽纯函数」的样板做的：

| 段 | 现状 |
|---|---|
| 世界书（lorebook） | ✅ 已用 `services/lorebook.ts` 的 `buildLorebookContext()` |
| 联网搜索 | ✅ 已用 `services/webSearch.ts` 的 `buildWebSearchContext()` |
| 文件库 RAG | ❌ 内联拼字符串 |
| 记忆库 | ❌ 内联拼字符串 |
| 人设（persona） | — 纯透传，无需格式化 |

所以不是「五段全要重写」，是**让另外两段跟上已有的样板**。

**真正脆的地方是顺序，不是格式化。** 五段都用 `apiMessages.unshift()`，
于是**最后 unshift 的排到最前面**，最终顺序完全由调用次序决定：

```
调用次序：  文件RAG → 记忆 → 世界书 → 联网 → 人设
实际顺序：  人设 → 联网 → 世界书 → 记忆 → 文件RAG → ...历史消息
```

这个顺序是有意的（人设要框定整场对话，检索到的上下文跟在后面），
但它**只写在一句注释里，零测试保护**。任何人调整了这五段的先后，
提示词的层次就悄悄变了，而且不会有任何报错。

**做法**：
1. 抽 `formatFileContext()` / `formatMemoryContext()` 两个纯函数（对齐已有的两个样板）
2. 把注入改成**显式有序**：先收集 `{ source, content }`，再按一个写明的顺序前置
3. **给顺序写测试** —— 这一步才是本轮的重点，把「只靠注释维系的约定」变成会失败的断言

**结果**：新增 `services/chatContext.ts` —— `SYSTEM_CONTEXT_ORDER` 常量 +
`orderSystemContext()` + 两个格式化函数，**15 个用例**。
五次 `unshift` 换成一次 `apiMessages.unshift(...orderSystemContext(ctx).map(...))`，
`unshift(...items)` 按给定顺序插到最前，所以返回顺序就是模型看到的顺序 ——
不再需要在脑子里把调用次序倒过来推。处理函数 668 → **656 行**。

测试里有一条**等价性断言**：手动照旧实现跑五次 `unshift`，与新实现的输出逐项比对。

**端到端实证**（本地验证实例 + 会记录请求体的模拟上游，真实 HTTP 流量）：
造一轮「人设 + 记忆都命中」的对话，上游实际收到的是

```
[0] system     【人设】你是一个严谨的助理
[1] system     以下是从记忆库中检索到的相关记忆…
[2] user       内部工具用 SQLite 做数据库合适吗？      ← 历史对话完整跟在后面
[3] assistant  对于团队内部工具这个量级…
[4] user       再问一次：SQLite 这个数据库选型合适吗？
```

人设第一、记忆第二、system 全部先于用户消息 —— 与重构前一致。

#### C. 自审段（v0.7.99，已完成）

**为什么这段值得先测住**：自审的返回值会**整条替换**用户已经看到的回答。
也就是说「什么算拿到了有效结果」这个判断一旦判松，用户的答案会被抹成空白 ——
而这段原先整个内联在处理函数里，零测试。

**结果**：新增 `services/selfReview.ts`，收下纯粹的两头 ——
`buildSelfReviewPrompt()`（提示词原文一字未改）与 `extractReviewedContent()`
（解析上游响应；空白 / 非字符串 / 结构残缺一律返回 `null`，调用方保留原回答），
中间那次网络请求留在路由里。**10 个用例**，其中一条专门锁「只有空白算失败」。
`extractReviewedContent` 返回的是**未 trim 的原文** —— 只用 trim 判空，不改内容
（模型的换行和缩进是有意义的）。

**顺手修掉一处字符串往返**：原先自审要用哪个节点，是把 `usedStation` 这个
给人看的字符串（`"模型 @ 节点名"`）`split(' @ ')[0]` 拆开、再回 `stations` 里
按同样的拼接结果找回来 —— 节点名里只要有 ` @ ` 就会找错。改为在选中节点时
一并记下 `winningStation` 对象，自审直接用它的 `modelId` / `baseUrl` / `apiKey`。

**端到端实证**（验证实例 + 记录请求流水的模拟上游，真实 HTTP）：
开着自审的会话，上游收到 **2 次**请求（流式正文 + 非流式自审，后者带
`---BEGIN AI RESPONSE---` 标记），SSE 推回修订版且落库的也是修订版；
关掉自审的会话只有 **1 次**请求。8 条断言全过。

处理函数 656 → **653 行**（这段本来就短，收益在「测住」而非「变短」）。

#### D. 之后（未做）

节点故障转移 + SSE + 工具调用往返（约 240 行，最危险，需要引入依赖注入，
`InvokeModelDeps` / `DeepProbeDeps` 是现成形状）。
每抽一块跑一遍全套测试，任何一步都能停下而不留半成品。

**②的累计进度：697 → 653 行；抽出 4 个纯模块（`chatContent` / `toolCallStream` /
`chatContext` / `selfReview`），共 47 个用例覆盖原先零测试的逻辑。**
测试总量：审计起点 290 → **400**（server 348 / client 52）。

### 10.12 用量统计系统性少算（v0.8.0，抽自审时挖出）

#### 问题

`chat.ts` 记账用的是 `approxPrompt = Math.ceil(String(message).length / 4)` ——
**只数了用户这一句话**，人设、世界书、联网、记忆、文件库、以及全部历史对话
统统没算。而且 `chat.ts` 压根没从上游响应里取 `usage`（它为了支持工具调用
自己做流式解析，绕开了 `streamInvokeModel`），群聊那边的 `rooms.ts` 反而是
用真实的 `result.usage.promptTokens` 记的。另外：

- **自审那次上游调用完全没记账**（一次真金白银的调用，账上不存在）
- **工具调用的每一轮都是一次独立的上游调用**，账上也只按一次算
- `stationId` / `stationName` 两列 `chat` 路径一直写 null（`rooms.ts` 写了）

净效果：**每用户配额和成本看板都系统性少算，且用户带的上下文越多、少算越多**。

#### 影响面（改之前先查清楚了，比预想的小得多）

真库只读查询：**没有任何用户设了配额**（`monthly_token_limit` 全是 0 = 不限），
**历史 `kind='chat'` 用量行只有 1 行、0 token**。所以这个修复
**不会卡到任何人，也不会让看板上已有的数字发生跳变** —— 只是从现在起记的是对的。

#### 方案

1. 新增 `services/usageAccounting.ts`（纯函数 + 单测）：
   - `estimateTokens(text)` —— 保留 chars/4 这个既有的兜底口径
   - `estimateMessagesTokens(messages)` —— 数**整个** `apiMessages`，
     兼容 content 是字符串和是多模态数组两种形状
   - `extractUsageReceipt(obj)` —— 从流式 chunk 或非流式响应里取 `usage`，
     字段缺失一律容忍（少一个字段不该让整张回执作废）
   - `resolveUsage(receipt, fallback)` —— **逐字段**取真实回执，缺的用估算补
2. `chat.ts`：
   - 流式解析时顺手收 `parsed.usage`（很多中转站本来就会在最后一个 chunk 带上），
     工具调用多轮时逐轮累加
   - 兜底估算改成按**该轮实际发出的 messages** 算，而不是只算用户那一句
   - 补上 `stationId` / `stationName`（`winningStation` 已经在手上了）
   - 自审那次调用**单独记一行**（`kind: 'chat'`，配额与成本自然合计正确；
     和 `rooms.ts` 的口径一致 —— 一次上游调用一行）

#### 一处自查补漏：故障转移会双算

第一版把两个累加器放在站点循环**外面**，只在请求开始时清零。但故障转移可能发生在
**流已经开始之后**（读到一半连接断了）—— 那次失败的尝试已经累加过 prompt 估算、
也可能已经收到过回执。不重置的话，成功的那个节点会连着失败尝试的数字一起记，
变成**反方向的多算**。改为每换一个节点就把 `usageReceipt` / `estimatedPrompt`
清零，账上只记最终成功的那个节点。

（这一条是提交前重读 diff 时自查出来的，不是测出来的；修法是循环体开头两行赋值，
逻辑上直读可判，未再补端到端用例。）

#### 刻意不做

**不加 `stream_options: { include_usage: true }`。** 它能让上游必定回真实用量，
但那是**改变我们发出去的请求体**：中转站良莠不齐，遇到不认识的字段直接 400 的
是有的，而「聊天挂掉」比「数字不够准」严重得多。现在的做法是**只读不求** ——
站里带了就用真的，没带就用改对了口径的估算。哪天确认全部在用的站都吃这个参数，
再作为一次独立改动打开。

---

### 10.13 外部 AI 审核意见的核对（2026-08-22）

owner 拿到一份第三方 AI（署名 **Cline**，不是 grok）出的《严格生产化审核结论》，
结论是「可发布」，列了 6 条待修项。**逐条核过代码，结论如下** ——
记在这里是因为「哪些意见被驳回、为什么」比「改了什么」更容易被下一轮重复问。

| 它说的 | 核对结果 |
|---|---|
| ③ 客户端 zustand persist 中间件缺失 | ❌ **不是缺陷**。项目就没打算用 persist 中间件：需要持久化的三处（`themeStore` 主题、`chatStore` 上次会话 + 选中模型、`roomStore` 群聊已读位置）都是手写 `localStorage`，还带了隐私模式下的 try/catch 兜底。其余 10 个 store 是**纯服务端状态**，持久化它们只会缓存出脏数据 |
| ⑥ 生产静态文件缓存策略需优化 | ❌ **已经是对的**。`index.ts:90` 带指纹的 assets 走 `maxAge:'1y' + immutable`，`index.html` 用 `setHeaders` 单独设 `no-cache`，SPA 回退也是 `no-cache`。这正是标准做法 |
| ⑤ API 响应类型不一致 | ⚠️ **落不了地**。166 处都是 `{success, data}` 包装；不带 `success` 的少数是文件下载与 SSE —— 那些本来就不该被包装。报告没给出任何一个具体的不一致点，无法据此动手 |
| ② `database.ts` 函数内 `require('./routes/stations')` 循环依赖风险 | ⚠️ **它看到的正是注释里已写明的处理**。那个 require 刻意放在函数体内：`refreshModelCapabilities` 必须**每次启动**都重跑（一次性迁移会漏掉迁移之后才种进来的行），所以不能进版本化迁移；外面套了 try/catch 并注明「首次加载时若出现循环即无害空转」。真要改进是把 `detectCapabilities` 挪到 services 层彻底断环 —— 属洁癖，不是风险 |
| ④ `.env.example` 缺失 | ✅ **真的，已补**（见下） |
| ① ~100 处 `console.*` 未换生产 logger | ✅ 数字准确（非测试代码 108 处）。但这是**规模问题不是缺陷**：输出进 systemd journal，能查能用。换 logger 要碰 108 个点，留作独立改动 |

#### 这份报告漏掉的

- **它没发现 §10.11 那个 🔴 级权限漏洞**（删成员 → 会话变无主 → 未登录可读私密对话、可 truncate 清空消息），却同时写下「安全中间件启用、无硬编码密钥、可发布」。当时那个洞还在线上。
- 也没提 §10.12 的用量统计少算。
- **它声称「已写入项目根目录」，实际没有落盘** —— 全盘搜不到该文件，git 也没有对应的未跟踪项。owner 看到的是它把内容打印出来了。

**结论**：6 条里只有 ④ 值得动，① 记作待办，②③⑤⑥ 不改（理由如上）。
外部 AI 审核可以当**线索来源**，不能当**结论来源** —— 每条都要回到代码里核。

#### ④ 补 `server/.env.example`（已做）

模板文件，只有变量名 / 默认值 / 含义，**不含任何真实密钥**，可以进 git。
生产部署不靠它（`deploy.sh` 首次运行会生成 `~/.multi-model-ai.env`，
chmod 600、随机密钥、永不覆盖已有文件）；它是给本地开发和「一眼看全有哪些开关」用的。

用一段脚本双向校验过：**代码里 `process.env.*` 读到的每个变量样例都有，
样例里的每个变量代码里都真在读**（两边都零遗漏）。

顺带把三条**报告没提、但真实存在**的风险写进了注释：

1. **`ENCRYPTION_KEY` 丢失 = 库里已加密的中转站 API key 再也解不开**
   （报 `Unsupported state or unable to authenticate data`，聊天全挂）。
   这不是理论推演 —— 本轮做端到端验证时就真撞上了：验证库的节点密钥是上一轮
   用另一个 key 加密的，换 key 启动后 `filterStationsForModel` 直接抛，
   得用当前 key 重新加密才恢复。
2. **`BACKUP_DIR` 默认落在 git 检出目录内**（`server/data/backups`，与
   `app.db` 同级）—— 一次 `git clean -fdx` 会把数据库和全部快照一起清掉。
   样例里给了指到仓库外的写法。
3. **探测开关保持关闭**并注明原因（曾有中转站因周期性探测封禁账号，v0.7.97）。

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
| 2026-07-26 | 0.7.52 | **Phase 5 — vector-scan bound (TC2 #3) + server dead-dependency removal.** **(1) Scan bound.** `vectorSearch` used to load EVERY embedded `memory_entries` row and `JSON.parse` each per query — cost grew linearly with team-wide memory history. It now scans only the most-recent `scanLimit` embedded rows: new optional param (default from pure `parseVectorScanLimit`: **2000**, env `VECTOR_SCAN_LIMIT`, `0` = pre-v0.7.52 unlimited), SQL `ORDER BY created_at DESC LIMIT ?`; the v0.7.34 user-scoping WHERE applies **before** the window, so another member's newer memories can never evict yours from your own search; `ORDER BY` applied even when unbounded for deterministic ties. Rationale: recency window (old memories have usually also decayed in relevance); importance still breaks near-ties in the ranking as before. Callers unchanged (default param). **(2) Server dead deps removed** (from the v0.7.50 audit list): `dotenv` + `node-fetch` (zero imports; Node 22 global fetch) dropped from `server/package.json` **and** `package-lock.json` — regenerated fully OFFLINE via `npm install --package-lock-only --offline` (grep-verified both packages gone from the lock; tests + `require('express')` smoke pass). **Client dead deps (`react-router-dom`, `react-textarea-autosize`) still deferred:** the same offline regen fails there (npm rebuilds the ideal tree and needs an uncached optional wasm dep `@tailwindcss/oxide-wasm32-wasi`); client `package.json` was restored byte-identical to HEAD — remove both in a networked session. **Tests:** `embeddings.scanBound.test.ts` (env parse; old-perfect-match-outside-window excluded + `0` restores full scan; in-window similarity ranking; scoping×window composition; window>table = full scan) → server **194** (+5). `tsc` clean. No client changes. **Phase 5 remaining: a11y only.** | Claude |
| 2026-07-26 | 0.7.53 | **Phase 5 COMPLETE — a11y pass.** Focused, verified sweep rather than a blanket rewrite: **(1) unlabeled icon-only buttons** — a project-wide scan (button tags with an icon-only body and neither `title` nor `aria-label`) found exactly **6**, all header back-arrows (`UserManagement`/`UsageLogsPage`/`FileBrowser`/`SettingsPage`/`RegexManager`/`MemoryBrowser`) → each gets `aria-label={t('common.back')}` (existing key; localizes with the UI). Every other icon button already carried a `title`/`aria-label` (house style held up). **(2) Dialogs:** `SystemPromptModal`, `DailyModelModal`, `ImageConfirmModal` overlays now declare `role="dialog" aria-modal="true"` with an `aria-label` from each dialog's own title key (`persona.title`/`prefs.userTitle`/`prefs.imageConfirmTitle`). **(3) Menus/keyboard:** the Sidebar's two popup menus (new-chat, move-to-folder) get `aria-haspopup="menu"`+`aria-expanded`, and a window-level **Escape** handler (mounted only while a menu is open) closes them — previously Escape only worked inside the folder-name input. Client `tsc -b` + `vite build` + eslint (0 err; 1 pre-existing baseline warning) clean; server untouched (194 tests). **This closes Phase 5** (perf v0.7.45, retention v0.7.46, organize v0.7.47, invites v0.7.48, history LIMIT v0.7.49, scan bound v0.7.52, a11y v0.7.53) — and with it the entire 2026-07-20 §10.8 roadmap, Phases 0-5. Left open (optional): $-cost dashboard figure, error-copy polish, client dead-dep removal (needs network), forced-password-change-on-first-login UI. | Claude |
| 2026-07-26 | 0.7.54 | **$ cost dashboard — closes the one item Phase 3 deferred (owner opted in 2026-07-26).** Pricing source decision: an **admin-editable per-model unit-price table** (not a built-in price map — relay-station prices vary and drift). **Backend:** migration **v9 `model_pricing`** (`model_normalized PK`, `prompt_price_per_m`, `completion_price_per_m` — per **1M tokens**, currency-agnostic on purpose; a both-zero row counts as not-priced). `usage.ts` gains pure `computeCost` + `loadPricingMap`, and `computeUsageSummary` now emits **cost** on all three aggregates: per-model (`null` when unpriced), per-user (summed over the user's priced models via one extra `GROUP BY user_id, model_normalized` query, with **`costIncomplete`** flagging users who also used unpriced models — the figure is an explicit floor, never a guess), totals (same floor semantics). New admin endpoints: `GET /api/usage/pricing` (every model ever logged, LEFT-JOINed with its configured prices) + `PUT /api/usage/pricing/:model` (upsert, non-negative validation). **Client:** both summary tables gain a 费用/Cost column (`≥` prefix + tooltip when incomplete; `—` when unpriced), the summary header shows total cost, and a collapsible **模型单价** editor (Coins icon) lists every logged model with prompt/completion price inputs + per-row save (refreshes the summary in place). `usage.cost/costIncompleteHint/pricingTitle/pricingDesc/promptPrice/completionPrice` i18n (zh/en). **Tests:** `usage.pricing.test.ts` (pure computeCost; both-zero=unpriced; per-model/per-user/totals matrices incl. floor-flag transitions as pricing fills in; upsert round-trip) + v9 assertion in `migrations.test.ts`; existing `usage.summary.test.ts` expectations extended (cost fields null/false without pricing) → server **200** (+6). Server `tsc` + client `tsc -b` + `vite build` + eslint clean. | Claude |
| 2026-07-26 | 0.7.55 | **Deep dedup — closes TC2 #5's tail and the v0.7.50 audit's duplicate-implementation finding.** `routes/chat.ts` carried its own `getStationsForModel` + `resolveModel` (near-duplicates of `services/modelInvocation`), and the streaming chat POST ran **two** full station scans per request: `resolveModel` early (result destructured into `station`/`modelId` — **verified never used**, the audited dead scan) and an identical scan feeding the failover loop. Refactor: both local functions **deleted**; the route now computes its station pool **once**, up front, via the shared `modelInvocation.getStationsForModel` (which layers healthy-preferred filtering, failover ordering, counter round-robin and key decryption — the local copy had NO healthy-preference, so failover order strictly improves), feeding both the 503 availability check and the failover loop. **Side fix:** the early check previously used the PUBLIC pool while the loop used the caller's pool — an admin whose model was admin-pool-only got a spurious early 503; both now use `{ adminPool: isAdmin }`. Dead imports (`roundRobin`, `decryptSecret`, `normalizeModelName`, `StationModelJoinRow`) dropped from chat.ts. No schema/API change; server **200** tests + `tsc` clean (modelInvocation's own failover suite already covers the shared implementation). | Claude |
| 2026-07-26 | 0.7.56 | **Claude-style visual restyle (owner: "让它更像 Claude 官网的风格和字体").** Rides the v0.7.5 dual-theme token architecture — the entire reskin is a design-token swap plus one hardcoded-color sweep; **no component logic touched**. **Palette:** LIGHT goes warm-ivory-paper (`#faf9f5` page / `#f5f4ee` panels / `#f0eee6` cards, warm near-black text `#1f1e1d`, warm borders/overlays tinted `rgba(63,58,50,…)`); DARK goes warm charcoal (`#262624`/`#1f1e1d`/`#30302e`, warm off-white text, warm overlays) — deliberately not cold black. **Accent:** ChatGPT green `#10a37f` → terracotta **`#d97757`** in both themes (hover darkens on light `#c15f3c`, lightens on dark `#e08b6d`); selection + primary buttons follow. New tokens **`--accent-tint-8/10/12/15/25`** (terracotta at theme-tuned alphas) and **`--color-assistant`** absorbed the last ~20 hardcoded `rgba(16,163,127,x)` chips and `#ab68ff` assistant-purple avatars across 11 components — the assistant identity is now the same terracotta family. **Type:** body switches to a system sans stack; **headings (h1-h3) and `.markdown-content` assistant prose render in a warm book-serif stack** (`Iowan Old Style / Palatino / Georgia / Songti SC` — offline-safe system fonts, no webfont dependency), assistant text bumped to 15px/1.75 for the editorial read. Composer restyled as a white card with a soft warm shadow + visible border (both themes get a real `--composer-border`). Page `<title>` fixed (`client` → `Multi-Model AI`). Verified: client `tsc -b` + `vite build` + full-src eslint (**0 err**; 11 pre-existing baseline warnings). Rollback = revert this one commit (token-only). | Claude |
| 2026-07-26 | 0.7.57 | **Dev-facing copy sweep — owner asked whether any UI text was "agent 写给自己看的".** Audit surface: all 560+ i18n VALUES (jargon regex: §/P0-3/TC/migration/framework/TODO/…), every hardcoded JSX text node (CJK + English-only scans), `alert()` strings, server `error:` strings returned to clients, and seeded data. **i18n values + server errors came back clean.** Fixed the 9 real leaks, all now i18n-routed: **(1)** the v0.7.24 seeded virtual user displayed its literal dev name **"Virtual Placeholder"** in the RoomsPage member picker, GroupChatLayout member list AND invite list — all three now render `room.virtualName` (虚拟占位成员 / Placeholder member); **(2)** `ChatInput`'s file-size alert was hardcoded Chinese (`超过 20MB 限制`) → `chat.fileTooLarge` with a `{name}` param (+ the `t` dep added to its `useCallback` — caught by the one new eslint warning, fixed, back to the 11-warning baseline); **(3)** `ErrorBoundary`'s English-only copy → `common.renderError`/`common.tryAgain` via imperative `useI18nStore.getState().t` (class component); **(4)** the two `Loading...` fallbacks (App boot + lazy-page) → `common.loading`; **(5)** `FileBrowser` desktop table headers Size/Status/Date/Actions → `files.colSize/colStatus/colDate/colActions`; **(6)** `MemoryBrowser`'s Re-embed button + tooltip → `memory.reembed/reembedHint`; **(7)** `UserManagement` create-form role `<option>`s showed raw `user`/`admin` → `users.roleUser/roleAdmin`. Non-findings (left alone): bilingual language-toggle labels (intentional), usage-log filter options (literal API values), `ArenaLayout` 'Promise' hit (a TS type, not UI). +13 i18n keys → zh = en = **570**, zero diff. `tsc -b` + `vite build` + eslint (0 err / 11 baseline warnings) clean. | Claude |
| 2026-07-26 | 0.7.58 | **§10.9 recorded + P0 #1 — new conversations default PRIVATE.** New **§10.9 Team rollout backlog** captures the owner's agreed priority order for taking the instance to a 4-5 person team (P0 pre-invite: default-private, forced password change, embedding-key encryption; P1 first-week: unread badges+notify, guide refresh; P2 first-month: announcement banner, friendly errors; P3 recorded-only incl. deployment env checklist for ops). **Shipped item #1:** `POST /api/conversations` and the importer now default `visibility` to **`private`** unless explicitly `'public'` (was the inverse); the client's new-chat visibility toggle starts on 私密. Sharing with the team becomes the deliberate act. Existing rows untouched; legacy NULL-visibility rows still read as public (unchanged legacy semantics); guests still see only what members explicitly made public. No schema change. Server 200 tests + both `tsc` + `vite build` clean. | Claude |
| 2026-07-26 | 0.7.59 | **§10.9 P0 #2 — forced password change on first login (closes §10.8 TC0 #5 fully).** **Backend:** migration **v10** adds `users.must_change_password INTEGER DEFAULT 0`. `seedDefaultAdmin` stamps the flag when seeding with the KNOWN default (`admin123`; an `ADMIN_PASSWORD`-seeded admin is not flagged); a per-boot sweep **`flagDefaultAdminPasswords`** bcrypt-checks every unflagged ACTIVE admin against `admin123` — so DBs seeded before v10 get flagged too, and the sweep is a no-op once rotated. Login + `/me` + middleware `getUserById` all carry `mustChangePassword`. New `POST /api/auth/change-password` backed by exported pure **`applyPasswordChange`** (wrong-current / <6 chars / same-as-current / not-found rejections; success rotates the hash AND clears the flag in one UPDATE). **Client:** `ForcePasswordModal` — deliberately non-dismissable (no backdrop close, no ✕; `role=dialog aria-modal`), current/new/confirm fields + show-hide toggle, client-side mismatch/short checks, success clears the flag in `authStore` and the app unblocks; mounted in `App` OVER the layout whenever the logged-in user carries the flag. `auth.*` i18n ×11 (zh/en, 581=581). **Tests:** `auth.password.test.ts` (v10 default; sweep flags default-password admins only + idempotent; change-password rejection matrix incl. flag-never-cleared-on-failure; success round-trip verified by bcrypt + sweep re-run) → server **205** (+5). Both `tsc` + `vite build` clean. | Claude |
| 2026-07-26 | 0.7.60 | **§10.9 P0 #3 — memory-store embedding API key encrypted at rest (closes the v0.7.37 deferral; P0 COMPLETE).** Mirrors the station-key pattern exactly: **write** — `PUT /api/memories/config` runs a non-empty `embeddingApiKey` through `encryptSecret` (clearing to null/empty stays as-is); **read** — both config mappers and `services/embeddings.ts`'s Authorization header go through `decryptSecret`, whose legacy-plaintext passthrough means pre-encryption values keep working untouched; **self-heal** — `encryptPlaintextStationKeys` gains a second stanza that re-encrypts a plaintext `memory_config.embedding_api_key` in place at boot once `ENCRYPTION_KEY` is set (no-op when disabled/already encrypted). No schema change; opt-in via the same `ENCRYPTION_KEY` env as v0.7.37. **Tests:** `embeddingKeyCrypto.test.ts` (stored column is ciphertext + round-trip; legacy passthrough; sweep contract idempotence) → server **208** (+3), `tsc` clean. **§10.9 P0 is now fully shipped — the instance is safe to invite the first teammate.** | Claude |
| 2026-07-26 | 0.7.61 | **§10.9 P1 #4 — group-chat unread badges + AI-done browser notification.** All client-side, riding the existing WS push + `rooms.updated_at` (which the server already bumps on every message). **Unread:** `roomStore` gains a `lastSeen` map persisted to `localStorage['room_last_seen']` — stamped when a room is opened AND on every incoming `message`/`ai` push while it is open (so an open room can never look unread); the RoomsPage list shows a terracotta dot when `room.updatedAt > lastSeen[id]` (or the room has never been opened) and the room isn't the selected one; `room.unread` i18n + `aria-label`. **Notification:** on the `ai` push where a message TRANSITIONS to `status='done'` (previous status tracked pre-upsert, so streaming frames never fire) while `document.hidden`, a browser `Notification` fires with the room name + a 120-char snippet (`tag` dedups per message); permission is requested once on first room entry, and everything no-ops gracefully where `Notification` is unavailable/denied. **Deliberate scope:** no Sidebar-level dot yet — the rooms list isn't loaded outside RoomsPage and polling for a dot isn't worth it; revisit if the team asks. Client `tsc -b` + `vite build` + eslint clean; server untouched (208). | Claude |
| 2026-07-26 | 0.7.62 | **§10.9 P1 #5 — onboarding guide refresh (P1 COMPLETE).** Pure i18n copy rewrite — the six `guide.stepN*` keys keep their names, so `GuideOverlay` itself is untouched. New tour (zh + en): **1** team-shared assistant framing (was "personal assistant"), **2** model selector + the team persona library, **3** pin/folders/search + **default-private with the globe-to-share gesture** (teaches the v0.7.58 privacy default explicitly), **4** attachments + file library 私有/团队 visibility and what sharing means for RAG, **5** group chat + @AI + the new unread dot & background notification, **6** memory store (with an explicit "your memories are yours — teammates can't see them" reassurance) + monthly quotas and who to ask. The retired self-review step's toggle remains discoverable in the sidebar; the guide now spends its six slots on what a new teammate actually meets. zh = en aligned; `tsc -b` + `vite build` clean. | Claude |
| 2026-07-26 | 0.7.63 | **§10.9 P2 #6 — admin announcement banner.** The lead's broadcast channel. **Backend:** migration **v11** creates single-row `announcement` (`id=1 CHECK`, `content`, `enabled`, `updated_by`, `updated_at`; row seeded in the migration — same pattern as `memory_config`). New `routes/announcement.ts` mounted at `/api/announcement`: GET is `optionalAuth` (a broadcast is for everyone incl. guests), PUT is admin-only (`requireAuth`+`requireRole`), always bumps `updated_at` — which doubles as the **dismissal version**. **Client:** `AnnouncementBanner` above `ChatArea` (megaphone icon, terracotta tint, `whitespace-pre-wrap`): renders only when enabled + non-empty; the ✕ stores `updated_at` in `localStorage['announcement_dismissed']`, so an EDITED announcement automatically re-surfaces for members who dismissed the old one. Settings page gains an admin-only 团队公告 card (textarea + 启用 checkbox + save-with-✓-flash, loaded only for admins). `announcement.*` i18n ×5 (zh/en aligned). Migration v10/v11 assertions added to `migrations.test.ts` → server **208**; both `tsc` + `vite build` + eslint (0 err) clean. | Claude |
| 2026-07-26 | 0.7.64 | **§10.9 P2 #7 — friendly error copy (§10.9 P0+P1+P2 ALL SHIPPED).** New pure `friendlyErrorKey(raw)` in `client/utils/errors.ts` maps the six failure families a teammate will actually hit — **no-station** (503 "No healthy stations…" → "稍等重试或换个模型"), **quota** ("联系管理员调高额度"), **rate-limit**, **network**, **timeout**, **expired-auth** — to `error.*` i18n keys (zh/en, 593=593); anything unmatched returns `null` and the caller shows the raw text (never hide an unknown error behind a generic apology). `ChatArea`'s error banner renders the friendly text with the RAW message preserved as the hover tooltip — teammates get the plain-language action, the lead still gets the diagnostic when they hover. Client vitest **11** (+2: mapping matrix + null-passthrough); server untouched (**208**); both `tsc` + `vite build` + eslint (0 err / 11 baseline warnings) clean. **§10.9 scoreboard: P0 #1-3 ✅ (v0.7.58-60), P1 #4-5 ✅ (v0.7.61-62), P2 #6-7 ✅ (v0.7.63-64); P3 stays recorded-only.** | Claude |
| 2026-07-26 | 0.7.65 | **Team knowledge base (owner request: 云端知识库 — 全员可看可传不可改、AI 摘要+关键词、可查原文).** Owner decisions: digest **auto-runs on upload**; KB is a **dedicated zone** (uploads there are team-visible by definition, flat/no folders) while the personal file area keeps its default-private behaviour. **Backend:** migration **v12** adds `file_library.kb` + digest columns (`summary`, `doc_type`, `ai_keywords` JSON, `summary_status` none/pending/ready/error + index). New **`services/kbSummarizer.ts`**: `pickSummaryModel` (env `KB_SUMMARY_MODEL` → else first enabled station model), `parseDigestResponse` (tolerates fences/prose/`type` alias, caps 10 keywords, requires a summary), `summarizeKbFile` (chunks → 9k-char-capped prompt asking for 类型/关键词/去废话要点 JSON → persists; never throws — every failure lands in status=error with a UI retry; usage-logged kind `other` under the uploader; invoker AND logger injectable for tests). **Routes:** upload accepts `kb=1` (forces `visibility='team'`, `folder_id=null`, chains digest after `processFile`); `GET /files?scope=kb&q=&doc_type=` (LIKE over name/summary/keywords/type, wildcards escaped); `GET /:id/reading` (chunks reassembled as markdown text + entry, `canSeeFile`-gated); `GET /:id/original` (`res.download` of the always-kept original bytes); `POST /:id/summarize` (any member may FILL a missing/failed digest; REGENERATING a ready one is uploader/admin — it costs tokens; 409 while pending). Read-only-for-others invariant needs no new code — mutation was owner/admin-gated since v0.7.35/44. **Client:** third **知识库** tab in `FileBrowser` → self-contained `KnowledgeBasePanel`: debounced search + doc-type chips + digest cards (type badge, clamp-3 summary, clickable keyword tags that become the query, live 4s poll while anything is processing/digesting, per-state badges with retry), multi-file upload, and a reading overlay (AI 要点摘要 card + full markdown via the shared `MarkdownMessage` + 查看原文 download + regenerate). `files.kb*` i18n ×16 (zh/en, 609=609). **Tests:** `kbSummarizer.test.ts` (v12 defaults; model pick env/fallback/none; parser matrix; success/failure/empty/no-model/retry flows with stubbed invoker+logger) → server **215** (+7). Both `tsc` + `vite build` + eslint clean. **Known scope cuts:** digest tokens aren't in the $-cost columns yet (invokeModel doesn't surface usage counts — logged as requests only); crawler ingestion stays external (upload the crawled files; a URL-fetch endpoint is a P3 candidate). | Claude |
| 2026-07-26 | 0.7.66 | **Token receipt capture — closes v0.7.65's scope cut #1.** The internal invocation channel never read the upstream `usage` block, so every background AI call (KB digests, arena, rooms) was request-counted but token-blind — invisible to the $-cost dashboard. Now: **(1)** `InvokeModelSuccess` gains `usage {promptTokens, completionTokens, totalTokens}` (nulls when the relay reports none — never guessed); non-stream `invokeModel` reads `data.usage` with finite-number validation. **(2)** Streaming: new pure **`extractSseUsage`** checks every SSE chunk for a `usage` block (many relays attach it to the final chunk, some need `stream_options`), last-seen wins, flushed-tail line included; `streamInvokeModel` returns it. **(3)** Consumers: KB digest logging now writes real prompt/completion/total tokens under the uploader (flows straight into the per-model cost columns AND the monthly quota sum, since both read `api_usage_logs`); rooms' group-AI logging uses the receipt and demotes the old `chars/4` completion estimate to a no-receipt fallback (prompt/total no longer null when reported). Arena's own logging can pick the field up whenever it's next touched — the value is on the result now. **Tests:** `extractSseUsage` matrix (usage chunk / delta-only chunk / [DONE] / garbage / non-numeric) + updated KB fixtures carry receipts → server **216** (+1), `tsc` clean. No client changes; no schema changes. | Claude |
| 2026-07-26 | 0.7.67 | **KB url-import — closes v0.7.65's scope cut #2 (爬虫资料一键入库).** `POST /api/files/kb-url { url }` (authed member): the SERVER fetches the page, so the door is **SSRF-guarded** first — pure `utils/urlGuard.urlRejectionReason` allows http/https only and refuses localhost/`*.localhost`/`*.local`/`*.internal`, private IPv4 literals (127/10/192.168/172.16-31/169.254 incl. the cloud-metadata address/0.x) and raw IPv6 literals (DNS-rebinding-grade attacks documented as out of scope for an internal tool). Fetch: 20s timeout, redirects followed, 2MB text cap, honest UA. Conversion: dependency-free `utils/htmlToText` (drops script/style/noscript/svg/iframe/head subtrees + comments, block-tags→newlines, entity decoding incl. numeric/hex, whitespace collapse) + `extractHtmlTitle`; plain text/JSON pass through; other content types are refused ("upload the file instead"); pages under 80 chars of text are refused as nav shells. The result is written to the uploads dir as a **normal KB markdown file** — `# title` + a 来源/Source line + the text — inserted `kb=1/team/text/markdown`, then chained through the SAME `processFile` → `summarizeKbFile` pipeline as an upload (so it gets chunks, embeddings, and the AI digest automatically). **Client:** 从网址导入 button in the KB toolbar → inline URL input (Enter submits, Esc closes, inline error with tooltip). `files.kbFromUrl/kbUrlPlaceholder/kbUrlImport/kbUrlFailed` i18n (613=613). **Tests:** `kbUrlImport.test.ts` — guard matrix (11 cases incl. metadata endpoint + IPv6), HTML cleaner (scripts/styles dropped, structure kept, CJK entities), happy-path import with stubbed fetch+pipeline into a tmp uploads dir (row flags, source line, chained fileIds), and refused imports leave the DB untouched → server **222** (+6). Both `tsc` + `vite build` + eslint clean. Runtime note: on the offline dev VM the fetch fails by design; it lights up once deployed where egress is allowed. | Claude |
| 2026-07-26 | 0.7.68 | **Chore — `start-dev.command`, a double-clickable macOS launcher for local testing.** The owner (non-programmer) shouldn't need a terminal to try the app. The script: fixes PATH for Finder-launched shells (`/opt/homebrew/bin` etc.), checks Node exists (friendly message otherwise), **self-heals the `better-sqlite3` native binary** — the sandbox VM had recompiled it for Linux/Node22, so on the Mac it load-fails; the script detects that via a require probe and runs `npm rebuild better-sqlite3` once (needs network for node headers; her Mac has it) — then starts server (`:3001`) and client (`:5173`) in the background, `open`s the browser, prints the default-admin hint, and a `trap` makes Ctrl+C stop both. `chmod +x` applied. No app code touched. | Claude |
| 2026-07-26 | 0.7.69 | **Launcher v2 — turn startup failures into self-diagnosing output.** First real double-click (owner's Mac): Vite + the new theme came up fine, but login hit `502 / ECONNREFUSED` — the SERVER had died and its actual error was lost in terminal scrollback. The launcher now: **(1)** pipes server+client output to `dev-logs/server.log` / `client.log` (dir gitignored); **(2)** kills stale listeners on 3001/5173 before starting (the classic didn't-Ctrl-C-last-time trap); **(3)** checks for Xcode Command Line Tools before attempting the `better-sqlite3` rebuild and says exactly what to install if missing; **(4)** verifies the rebuild by re-probing the require; **(5)** health-polls `GET /api/health` for up to 30s (bailing early if the process died) and only then opens the browser; **(6)** on failure prints the LAST 30 LINES of the server log framed with "把这段截图发给 Claude 就能修". `set -e` dropped in favour of explicit handling (it silently killed the window before). | Claude |
| 2026-07-26 | 0.7.70 | **Launcher v3 — fix the rebuild guard that never fired.** v2's self-heal probe was `node -e "require('better-sqlite3')"` — but better-sqlite3 v11 loads the native `.node` file **lazily inside the `Database` constructor** (to support the `nativeBinding` option), so a bare require succeeds even when the binary is for the wrong OS. Result on the owner's Mac (Node v24.13.0): probe green → rebuild skipped → server crashed at `getDb` with `ERR_DLOPEN_FAILED: … better_sqlite3.node (slice is not valid mach-o file)` — the Linux binary the dev VM compiled was still in place, exactly the case the guard existed for. Now `sqlite_ok()` runs two honest checks: **(1)** `file build/Release/better_sqlite3.node` must report Mach-O (a Linux ELF fails instantly, no Node involved); **(2)** `new (require('better-sqlite3'))(':memory:')` executed **from `server/`** must succeed — it forces the lazy dlopen. Rebuild output goes to its own `dev-logs/rebuild.log` (auto-tailed 25 lines on failure), the post-rebuild verify reuses `sqlite_ok`, and the last-resort message spells out the full-path `rm -rf node_modules && npm install` fallback. Node 24 note: `npm rebuild` runs prebuild-install-then-source via the package's install script, so it works with or without a Node-24 prebuild (CLT guard already in place). Script-only change; no app code. | Claude |
| 2026-07-26 | 0.7.71 | **UI fix — the fixed top-right theme/language cluster overlapped page-header buttons (owner's first live session, chat page).** `TopRightToggles` floats at `fixed top-4 right-4 z-60`; the chat header's right end now holds the 人设 (persona) button (added v0.7.4x), so on the owner's Mac the moon/globe/EN icons stacked straight onto it. Audit of every top bar that reaches the top-right found four unprotected colliders: **ChatArea** header (人设), **FileBrowser** top bar (新建文件夹/上传 in mine-scope), **UsageLogsPage** header (refresh), **AnnouncementBanner** (dismiss ×). All four now reserve `pr-32` (128px ≥ cluster width incl. the wider 中文 label in EN locale), the same reservation pattern MemoryBrowser/UserManagement already used — those two bumped `pr-28`→`pr-32` for the EN-locale case. Settings/Arena/Rooms headers keep no reservation (no right-edge content). Client-only, 6 files, class-string changes only. | Claude |
| 2026-07-26 | 0.7.72 | **项目世界书 — owner batch #1 of the SillyTavern-inspired trio (§10.9 追加批次).** The "AI that grows with the project" foundation: **(1)** migration v13 `lorebook_entries` (title / keywords JSON / content / enabled / priority / created_by). **(2)** Pure `services/lorebook`: `parseLorebookKeywords` (array or comma/、/newline string → trimmed, case-insensitive-deduped, ≤20), `matchLorebookEntries` — case-insensitive **substring** matching by design (CJK has no word boundaries; entries are curated, not adversarial), sorted priority DESC → recency, bounded to ≤6 entries / ~2400 chars per message with the first match always surviving the budget, `buildLorebookContext` (framed zh block), `canModifyLorebookEntry`. **(3)** Chat injection: scans the new message + last 6 history turns so follow-ups keep a triggered setting alive; unshifted before the persona (persona still leads); try/caught so lorebook failures can never break chat. Rooms/arena deliberately not wired (recorded). **(4)** Routes `/api/lorebook`: GET all (team-shared), POST (any member), PUT/DELETE (owner or admin; PUT also toggles enabled). **(5)** Client: fourth 世界书 tab in 文件库 (`FileScope` + 'lore'), `LorebookPanel` — entry cards (keyword chips, author, enabled-dimming), inline editor, client-side filter, owner/admin action buttons. i18n +18 keys ×2 (incl. new `common.edit`), zh=en parity. **Tests:** `lorebook.test.ts` — parsing, validation, CJK+latin matching, priority/recency ordering, entry+char budgets, permissions → server **232** (+10); client tsc/vitest/eslint/build green, zh=en 635 keys. | Claude |
| 2026-07-26 | 0.7.73 | **自动蒸馏学习 — owner batch #2 ("越聊越懂" learning loop).** auto_save keeps RAW messages; now the AI also REFINES. **(1)** Migration v14: `conversations.distilled_message_count` watermark; the schema-v1 knobs `memory_config.auto_summarize`/`summarize_threshold` — plumbed through config API/UI since forever but consumed by NOTHING — become the distiller's switch + cadence (flipped ON in the migration; the knob controlled nothing before, so no admin intent is overridden). **(2)** `services/memoryDistiller`: pure `shouldDistill` (cadence math, 0/neg threshold → default 20) + `parseDistillResponse` (JSON array from fences/prose, `fact` alias, 1-5 importance scale tolerated → 0-1, clamps, ≤5 facts × ≤400 chars) + `distillConversation(convId, db, deps{invoke,log,embed})`: un-distilled tail (last 9k chars) → zh prompt asking for durable conclusions/decisions/preferences ONLY (no 寒暄, no encyclopedia answers) → memory entries with **summary=content** (the existing chat RAG injection filters on summary — distilled facts flow into context with zero new injection code), tag `distilled`, embeddings via injectable embed, importance from the model, owner-scoped, usage-logged kind 'other'; watermark advances even on zero facts (prevents an infinite re-submit loop) but NOT on invoke failure (tail retried next round). **(3)** Chat path: `maybeDistillConversation` fire-and-forget after each assistant reply (two tiny queries when not due). Rooms deliberately not wired (recorded). **(4)** Client: 自动蒸馏 toggle + cadence input in memory settings; **bug found & fixed while wiring** — the existing auto_save/context_injection toggles sent snake_case keys the camelCase-reading PUT ignored, i.e. those two switches have NEVER worked; now camelCase. i18n +4×2 (639=639). **Tests:** cadence matrix, parse matrix (alias/scale/clamp/cap/garbage), full distill flow on in-memory DB (rows, tags counter, watermark, zero-facts advance, failure no-advance, guards) → server **241** (+9). | Claude |
| 2026-07-26 | 0.7.74 | **聊天内联网搜索 — owner batch #3; the SillyTavern-inspired trio is COMPLETE.** **(1)** Migration v15: single-row `web_search_config` (enabled / provider='tavily' / api_key / max_results 3, capped 1-8). **(2)** `services/webSearch`: `parseTavilyResponse` (tolerant: junk items dropped, url-as-title fallback, optional top-level `answer` lifted into a pseudo-result, snippets capped 800 chars), `buildWebSearchContext` (numbered sources + instruction to end the answer with a 参考来源 section listing only links actually used), `searchWeb(query, db, deps{fetchImpl})` — key decrypted only at call time, 15s timeout, never throws; NO server-side fetching of result URLs (that stays behind the SSRF-guarded KB url-import; we use provider snippets only). **(3)** Routes `/api/websearch`: `/status` (member: is the toggle usable = switch AND key), `/config` GET/PUT (admin; key encrypted like the embedding key). **(4)** Chat: body flag `webSearch: true` → snippets injected as system context after lorebook, before persona; unavailable/failed search logs a warning and degrades to a normal answer. **(5)** Client: sticky 联网 chip in the composer status row (rendered only when `/status` says available), flag threaded sendMessage→doSendMessage→startStream→streamChat (incl. FailedSend retry); admin Settings card (switch + Tavily key, saved masked-input style) mirroring the announcement card. i18n +6×2 (645=645). **Tests:** v15 defaults + availability gate, parse matrix, context build, refuse-without-network paths (0 fetch calls), happy path asserting the DECRYPTED key/query/max_results in the posted body, provider error / empty results / thrown fetch → server **248** (+7). Deployment note: needs egress to api.tavily.com — on the offline dev VM the chip works but every search degrades (by design). | Claude |
| 2026-07-26 | 0.7.75 | **Station settings UX — owner's live-testing feedback (screenshot: unreadable chips + no way to edit a station).** **(1) Inline station edit:** the server's `PUT /api/stations/:id` has supported name/baseUrl/apiKey updates (key encrypted) since v0.7.x, but the UI only ever offered add + delete — owners re-created a station to fix a typo. New 编辑 button on each station card opens an inline form (same fields/placeholders as the add form); the key field's contract is explicit: blank = keep the stored encrypted key, filled = replace. Reuses `stationStore.updateStation`. **(2) Badge contrast:** `capColor` and the 管理员选用 badge used hard-coded LIGHT text colors (`#60a5fa` etc. — chosen when the app was dark-only) which washed out on the light theme, and the model row sat on `rgba(0,0,0,0.2)` — a dark-theme leftover that rendered as the murky gray band in the owner's screenshot. All badge colors now come from `--badge-{blue,purple,pink,green,orange,gray}-{bg,fg}` CSS vars: dark-on-tint in light theme, light-on-tint in dark; row background → `--overlay-4`. 对用户公开 keeps the terracotta accent chip style used app-wide. i18n +3×2 (648=648). Client-only; tsc/build/eslint clean; server suite untouched at 248. | Claude |
| 2026-07-26 | 0.7.76 | **Announcement UX rework + group-chat banner — owner feedback ("公告不是每天都发，做成按钮就好；群聊里也要能看到").** **(1)** New `settings/AnnouncementManager` replaces the always-open editor card: compact row (megaphone + 已发布/未发布 status chip) with a single primary button (发布公告 / 修改公告). Clicking opens a two-step dialog: EDIT (textarea, prefilled with current text) → 下一步：预览 → PREVIEW that renders the draft in the exact member-facing banner style (same tint/icon/dismiss-x) → 确认发布 (the owner's requested 二次确认). Published state shows a 2-line snippet of the live text plus 撤回 — retract flips `enabled=false` only, keeping the text for later re-publishing (confirm prompt spells this out). No server changes — the existing GET/PUT carry the whole flow. **(2)** Owner remembered a group-chat banner; audit confirmed the banner only ever mounted in the chat Layout — RoomsPage is a separate full-screen view. `AnnouncementBanner` now renders at the top of RoomsPage too (page root became a column; list+detail wrapped in a flex row; per-updated_at dismissal is shared via the same localStorage key, so dismissing in one view dismisses in both). i18n +11×2 (659=659; `announcement.enabled` retired from UI but key kept). Client-only; tsc/vitest/build/eslint clean. | Claude |
| 2026-07-26 | 0.7.77 | **Group-chat view polish — owner's screenshot feedback.** **(1) Last header collision:** the v0.7.71 pr-32 audit covered every page-level top bar but missed `GroupChatLayout`'s header — it lives INSIDE RoomsPage's right column, so the grep-by-page pass didn't flag it; its right-edge 模型设置/成员管理 buttons sat exactly under the fixed theme/language cluster (owner's screenshot). Now `pr-32` like the rest. **(2) Collapsible group list:** the 280px list column gets a desktop-only PanelLeftClose button; collapsed it becomes a 44px icon rail (展开 / 返回 / 新建群) so the two chat columns get the full width — mirrors the main sidebar's collapse pattern. Mobile keeps the existing list↔detail flow (classes split so the collapse only binds at `md:`). i18n +2×2 (661=661). Client-only; tsc/build/eslint clean. | Claude |
| 2026-07-26 | 0.7.78 | **Toggles into the headers — ends the floating-cluster era (owner: icons must be horizontally aligned with uniform gaps, everywhere).** The `fixed top-4 right-4` cluster could never truly align with page headers (each header has its own height/padding) and kept spawning overlap bugs (v0.7.71, v0.7.75 screenshot, v0.7.77). Root fix: **(1)** `TopRightToggles` gets `variant='fixed'|'inline'` — inline is a plain `flex items-center gap-1` group. **(2)** `Layout.withLang` no longer mounts the fixed cluster; instead each top bar renders the inline cluster as its LAST buttons: ChatArea (after 人设), FileBrowser (right-side group now always rendered; mine-scope upload buttons inside it), MemoryBrowser (after 设置), UserManagement (after 新建用户), UsageLogsPage (after refresh), SettingsPage (ml-auto after title), ArenaLayout (header end), GroupChatLayout (after 成员管理), RoomsPage empty-state (absolute corner slot — the one spot with no header). Flexbox guarantees the OCD ask: same baseline, same gaps, every page. **(3)** All pr-32/pr-28 reservations removed (ChatArea, FileBrowser, UsageLogsPage, AnnouncementBanner, MemoryBrowser, UserManagement, GroupChatLayout) — obsolete by construction. Fixed variant survives only on login/register (no header there). 12 files, client-only, no i18n changes; tsc/build/eslint clean (661=661). | Claude |
| 2026-07-26 | 0.7.79 | **Daily deep probe + arena rendering — owner's arena screenshot (three asks).** **(1) 每日真问题测活:** the 60s sweep only pings `/models`, which a station can pass while its model pool is dead (the screenshot's `HTTP 503 No active API keys for this group`). New `services/deepProbe` (+ migration v16 `stations.last_deep_probe`): every enabled station, once per LOCAL day at a per-station RANDOM time (re-rolled daily, in-memory; the column stops restart double-fires), sends ONE real question from an 8-question zh pool (AI/LLM 区别, RAG, embedding… — explicitly no hello-pings, test-asserted) to ONE random enabled model of that station via a DIRECT `chat/completions` call — the normal invokeModel failover would mask exactly the failure being probed. Success → healthy; failure/empty completion → unhealthy (router deprioritizes); every attempt usage-logged kind 'other' (`[deep-probe]` prefix, tokens included) so it's auditable in 使用日志. Scheduler: minute tick, `unref`'d, wired into startup/shutdown beside the health job. **(2) Arena rendering:** answers were dumped as plain text (`whitespace-pre-wrap`) — raw `**`/`###` everywhere; now rendered through `MarkdownMessage` inside `.markdown-content` (errors keep plain red text), and the candidate grid gets `items-start` + `min-h` 180→120 so an instant-error card no longer stretches to the height of a 68s long answer (the screenshot's dead space). **(3) Latency question answered in-product docs (§13 note): arena calls are NON-streaming by design (fair side-by-side timing), so `68093ms` ≈ the model actually generating the full long answer — our pipeline adds single-digit ms; chat feels fast because it streams. Recorded as a possible P3: streaming arena cells. **Tests:** probe-time bounds/rng, probeDay, dueForProbe matrix, no-hello-ping pool assertion, healthy flow (station-direct URL, real question in body, health+watermark+log), 503/empty→unhealthy, no-models day-stamp, disabled/unknown guards → server **255** (+7). | Claude |
| 2026-07-26 | 0.7.80 | **Arena fullscreen reading — owner follow-up right after the markdown render landed.** Each candidate card's header gains a Maximize2 放大阅读 button (rendered only once there is content or an error to read): opens a near-fullscreen overlay (max-w-4xl, full height, z-80 above everything) with the model name + status/latency in a slim header and the FULL answer as scrollable markdown (errors as red plain text). Three ways out — ✕ button, backdrop click, Esc (listener attached only while open) — restoring the normal two-card view exactly as before. i18n `arena.expandAnswer`/`collapseAnswer` ×2 (663=663). Client-only; tsc/build/eslint clean. | Claude |
| 2026-07-26 | 0.7.81 | **Test-server auto-deploy — owner picked "全自动" for her Oracle Always-Free VM (2C/12G, aureliazhsy.com on Cloudflare, Nginx Proxy Manager already fronting other services).** Design constraints honored: VM's security list opens 8000-9000 → app port **8500**; existing NPM entries proxy `172.17.0.1:<port>` → same pattern documented; owner "更新很麻烦" → push-to-deploy. **(1) `deploy.sh`** (repo root, runs ON the VM, idempotent): first run writes `~/.multi-model-ai.env` (JWT_SECRET/ENCRYPTION_KEY via openssl, PORT, CORS_ORIGIN, commented REQUIRE_INVITE; chmod 600, outside git, never overwritten — the file's own header warns deleting it orphans encrypted API keys), installs pm2 on demand; every run: `git pull --ff-only` → server `npm ci` + `tsc` → client `npm ci` + `vite build` → `pm2 restart|start` with `--update-env`, friendly Node-missing/startup hints throughout. **(2) `.github/workflows/deploy.yml`**: on push to main (or manual dispatch), plain-ssh (no third-party actions) into the VM using 3 repo secrets (VM_HOST/VM_USER/VM_SSH_KEY) and run deploy.sh; concurrency-grouped so pushes queue instead of racing. **(3) `DEPLOY.md`**: zh handbook — one-time setup (CF `A official` record (subdomain official.aureliazhsy.com, owner pick), VM node init, ssh-keygen once → same key serves as GitHub **Deploy Key** (read-only clone auth) AND Actions login; NPM proxy host copy-of-existing-entries walkthrough with **Websockets Support checkbox called out** for the rooms hub; REQUIRE_INVITE flip) + daily ops + 排障 table. Git flow note: owner pushes via Claude Code to the `private` remote — the workflow and secrets live in that repo. bash -n + YAML parse verified; no app code, no tests affected (server 255). **DEPLOYED LIVE 2026-07-26**: https://official.aureliazhsy.com serving from the owner's Oracle VM (pm2 online, pm2-startup + saved iptables → survives reboots); Actions run #5 green (37s) = push-to-deploy verified end-to-end. Live-debug fixes folded in along the way: `--include=dev` (NODE_ENV pruned compilers → bogus `tsc` package offered), npm-ci→npm-install fallback (lockfile strictness differs across npm versions), ADMIN_PASSWORD required by production seeding (now auto-generated+printed on first deploy), Oracle iptables allow `172.16.0.0/12 → :8500` (Docker'd NPM → host port; /16 missed compose networks), VM key must be in its own authorized_keys for Actions SSH. All recorded in DEPLOY.md. | Claude |
| 2026-07-26 | 0.7.82 | **Mobile adaptation — batches 1 & 2 of the §10.9 追加批次 plan** (shipped as commit `6190622`; recorded retroactively in v0.7.83 — the session that wrote it lost its framework update to the `.git/index.lock` fight). **Batch 1 (群聊页, the worst offender):** `GroupChatLayout`'s hard "human chat \| AI replies" two-pane grid — which squeezed both columns into unreadable strips on a phone — becomes **single-pane on narrow screens with a 群聊 / AI回复 tab switch**, desktop two-pane behaviour untouched; `NotepadBar` collapses into the same narrow-screen treatment. **Batch 2 (聊天主页):** `ChatArea`'s header row, `ChatInput`'s status strip (公开/自我审查/联网/选择文件 — previously overflowing), `ModelSelector`'s dropdown width/touch targets and `FileSelector` all get portrait breakpoints; `index.css` gains the shared narrow-screen rules. 9 files, +114/−32; i18n +2×2. Batches 3 (表格页与面板) and 4 (弹窗打磨) still open. | Claude |
| 2026-08-09 | 0.7.83 | **Repo integrity audit after the `.git/index.lock` fight + migration-list tidy.** Owner reported a terminal session where the agent deleted `.git/index.lock`, saw it reappear with its ORIGINAL mtime (a week-stale lock from 2026-07-26 14:50 on the macOS fakeowner mount, not a live process), and only got the commit through by fusing delete+commit into one command — then asked for a damage sweep since the other affected transcripts weren't saved. **Verdict: no code damage.** Evidence: server `tsc` clean + **255/255** tests; client `tsc -b` + `vite build` + **11/11** tests + eslint **0 errors** (12 `set-state-in-effect` warnings, all pre-existing debt, one per file); compiled-server boot smoke on a fresh DB (health 200, ledger v1→v16 complete incl. `model_pricing`, 46 tables, every background job started); no conflict markers / truncation placeholders / undersized source files; i18n **660=660** with zero drift, zero duplicates and every code-side `t()` key resolvable; all **20** route modules mounted; `git fsck --full` clean — its 4 dangling commits are **byte-identical duplicates** (`git diff` empty) of v0.7.82, v0.7.47 ×2 and a 2026-07-17 stash, i.e. orphaned retry attempts, not lost work. **Fixed (the two real leftovers):** ① `SCHEMA_MIGRATIONS` had drifted out of version order — v9 `model-pricing` orphaned at the very end *below* v16 with its comment stranded above v10, and v11/v12 swapped — now strictly ascending 1→16 with each comment reattached to its migration (**behaviour-identical**: `runMigrations` sorts by version and gates on a per-version ledger, verified by the fresh-DB boot above both before and after); ② `_to_delete/` deleted — 114 **zero-byte** git lock files (`HEAD.lock.*`, `index.lock.*`) accumulated between 06:39 and 14:08 on 2026-07-26, verified empty and lock-named before removal. **Environment note (not a bug):** the first test run failed 106/255 with `invalid ELF header` — `better-sqlite3`'s native binary was the **macOS** build that `start-dev.command`'s v0.7.70 guard compiles for the owner's Mac; `npm rebuild` restores the Linux build here, and the launcher flips it back on the Mac. Server 255 / client 11; all checks green. | Claude |
| 2026-08-09 | 0.7.84 | **Mobile batch 3 start — UsageLogsPage stacked cards + a deep mobile audit (owner: "不知道其他地方还有没有问题，就是和移动端相关的内容").** **(1) `UsageLogsPage`** finishes the v0.7.21 pattern: the 8-column `min-w-[900px]` table is gated behind `hidden md:block` and phones get a stacked-card list (`md:hidden`) — one card per log row carrying **all 8 columns' data** (user + role and status/httpStatus on the identifying line, model + the fallback modelUsed/stationName beneath, then time / kind / tokens / latency as wrapped chips, error text last), with the same `usage.empty` state as the table. The page's other blocks were checked and already adapt: the filter bar is `flex flex-wrap`, the summary panel is `grid-cols-1 lg:grid-cols-2` with `overflow-x-auto` + `min-w-[320px]` inner tables (fits 375px), the pricing editor rows are `flex flex-wrap`, and the pager is a 3-item `justify-between`. **(2) Deep audit recorded in §10.9** — the previous pass only counted responsive classes; this one hunts concrete failures, and the headline finding is that **three shipped features are unreachable on a phone**, not merely ugly: `MessageBubble`'s message actions (v0.7.41 copy/regenerate/edit), `Sidebar`'s pin/move-to-folder (v0.7.47) and `SystemPromptModal`'s persona rename/delete all render as `opacity-0 group-hover:opacity-100`, and touch has no hover. Also material: `html,body,#root { height:100% }` means the iOS keyboard covers the composer (`100dvh` fixes it); `overflow:hidden` on the root turns every horizontal overflow into **permanently clipped** content rather than a scroll; 7 modals still lack `max-h`+inner scroll (`ForcePasswordModal` worst — mandatory and non-dismissable on first login); 33 icon buttons are under the 44px touch target. Two planned batch-4 items were **disproved and dropped**: safe-area insets are unnecessary under the default `viewport-fit=auto` (iOS already keeps content clear of the notch), and `BenchmarkPanel`/`PromptLabPanel` were mis-scanned as "0 responsive" when they in fact use `flex-wrap` + `md:`/`sm:` grids. Client `tsc -b` + `vite build` + eslint (0 err / 12 baseline warnings) + 11 tests green; server untouched (255). | Claude |
| 2026-08-09 | 0.7.85 | **P0 fix — the three hover-gated features are reachable on touch again (§10.9 audit's headline finding).** v0.7.84 found that `MessageBubble`'s message actions (v0.7.41 copy / regenerate / edit), `Sidebar`'s pin + move-to-folder (v0.7.47) and `SystemPromptModal`'s persona rename / delete all hid behind `opacity-0 group-hover:opacity-100` — and touch has no hover, so on a phone the features had no entry point at all. **Fix:** all **8** reveal-on-hover sites move to Tailwind v4's `pointer-fine:` variant (`pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100`), which compiles to `@media (pointer:fine){…}` — verified in the built CSS. **Mouse behaviour is unchanged** (still hidden until hover); coarse-pointer devices never match the query, so the controls simply stay visible. Chosen over the codebase's usual `md:` breakpoint because a touch tablet at ≥768px renders the DESKTOP branch — which is exactly why the sweep also covers `FileBrowser` ×2, `MemoryBrowser` and `UserManagement`'s quota pencil, whose hover controls sit inside `hidden md:block` blocks that an iPad user does reach. **Cascade verified, no a11y regression:** `.focus-within\:opacity-100:focus-within` has specificity (0,2,0) against `.pointer-fine\:opacity-0`'s (0,1,0), so keyboard focus still reveals the actions on a mouse machine despite the media-query rule coming later in the sheet. Layout checked: the Sidebar title is `truncate flex-1`, so always-on buttons shrink it rather than overflow it. A sweep confirms **zero** bare `opacity-0 group-hover:` / `invisible group-hover:` / `hidden group-hover:` sites remain; the 3 surviving `group-hover` uses are LoginPage decoration. Client `tsc -b` + `vite build` + 11 tests + eslint (0 err / 12 baseline warnings) green; server untouched (255). **Still open from the audit:** P1 clipped toolbars, P2 seven unbounded modals, P3 `100dvh` + 44px touch targets. | Claude |
| 2026-08-09 | 0.7.86 | **Mobile P1 + P2 + P3 — the §10.9 audit list is now closed.** **(1) Keyboard occlusion.** New `utils/viewportHeight.ts` mirrors `visualViewport.height` into a `--app-height` custom property (ignoring changes while `scale !== 1` so pinch-zoom doesn't resize the shell), called from `main.tsx` before render; the root rule becomes `@supports (height: 100dvh) { html, body, #root { height: var(--app-height, 100dvh) } }`. The `@supports` gate matters: browsers without `dvh` keep the plain `height: 100%` instead of computing an invalid value. **`dvh` alone would not have fixed this** — on iOS the software keyboard shrinks only the VISUAL viewport, leaving `100dvh` (and the `overflow:hidden` layout viewport) at full height, which is exactly how the composer ended up under the keyboard with no way to scroll to it. **(2) Modals.** New shared `.dialog-panel` bounds a dialog by `calc(var(--app-height, 100dvh) - 2rem)` — the VISIBLE viewport, so it survives both a long body and an open keyboard, unlike a `vh` bound. Applied to the **7** dialogs that had no bound at all (`ForcePasswordModal` — mandatory and non-dismissable on first login, so the worst of them — `DailyModelModal`, `ImageConfirmModal`, `AnnouncementManager`, `RoomsPage` create-group, `GroupChatLayout` model-settings, `GuideOverlay`) and the two existing `max-h-[80/85vh]` bounds (`SystemPromptModal`, `GroupChatLayout` manage) migrated onto it. `GuideOverlay` needed structure rather than a class — it is now a flex column with `flex-shrink-0` on the progress bar and nav row and `overflow-y-auto` on the step body, so its `overflow-hidden` (which clips the progress bar to the rounded corners) survives. **All 11 dialogs in the app are now height-bounded.** **(3) Toolbars** (recall the root is `overflow:hidden`, so these were clipped away, not scrollable): `RegexManager`'s **five** hard `grid-cols-2/3` form grids gain `grid-cols-1 sm:`, its tab row gains `flex-wrap`; `KnowledgeBasePanel`'s toolbar and URL-import row, `LorebookPanel`'s toolbar, `FileBrowser`'s top button group and create-folder form, and `McpServerManager`'s card action row all gain `flex-wrap`. **(4) Touch targets.** New `.touch-target` (44px min box, `inline-flex` centred) inside `@media (pointer: coarse)` only — desktop density is untouched — applied to the **9** controls v0.7.85 had just made visible on touch (`MessageBubble` ×3, `Sidebar` conversation row ×4, `SystemPromptModal` ×2); the remaining sub-44px icon buttons live in desktop-oriented admin tables and are deliberately left. **Disproved:** `SettingsPage` needs no change despite scanning as "1 responsive class" — it has no fixed widths, its station action row is already `flex-wrap`, and its two form rows hold two buttons each. Built CSS verified to contain `pointer:fine`, `pointer:coarse`, `dialog-panel`, `touch-target` and the `100dvh` @supports block. Client `tsc -b` + `vite build` + 11 tests + eslint (0 err / 12 baseline warnings) green; server untouched (255). **Caveat: none of this could be exercised on a real iPhone from the dev container — owner verification on device is the next step.** | Claude |
| 2026-08-13 | 0.7.87 | **Desktop group chat was pinned to the left half of the screen (owner report) — a latent flex bug from v0.7.6.** `GroupChatLayout`'s root (`h-full flex flex-col`) is a **flex ITEM** of `RoomsPage`'s right pane: that wrapper stopped being a plain block in v0.7.6, when the mobile list/detail switch needed `hidden md:flex` on it. With no grow factor the root resolved to `flex: 0 1 auto` and sized to **its own max-content** — measured at ~915px inside a 1440px screen, the rest of the window blank — and the width drifted with message length. The `!currentRoom` loading branch had the same defect (spinner centred inside a shrink-wrapped strip). Fix: `flex-1 min-w-0` on both return roots. **Evidence, not inference:** headless Chromium measurements of three structures — block wrapper (pre-0.7.6) = 1160px ✅ / flex wrapper without grow (current) = 69px ❌ / flex wrapper + `flex-1` (fix) = 1160px ✅ — then the real app driven over CDP confirmed full width with evenly split columns at 1440 / 1024 / 768 / 500px, and the mobile single-pane view (v0.7.82 batch 1) rendering correctly at 390px. **Disproved:** the first hypothesis was that v0.7.82's `flex-wrap` + `min-w-0 flex-1 truncate` on the composer status row had shrunk the intrinsic width; an A/B measurement put the old and new rows at an identical 397px max-content, clearing the mobile batches — this bug predates them by ~25 versions and only escaped notice because the rendered width depends on content. **Swept the rest of the app for the same shape:** the other 80 'component inside a flex container' hits are all lucide icons (intrinsically sized) or false positives from the `flex-shrink-0`/`flex-1` substrings, and `TopRightToggles`' default variant is `fixed` (out of flow) — group chat was the only real instance. Client `tsc -b` + `vite build` + 11 tests + eslint (0 err / 12 baseline warnings) green; server untouched. | Claude |
| 2026-08-13 | 0.7.88 | **Mobile: sidebar conversation rows showed one character of the title (owner on-device report).** Two earlier mobile fixes compounded: v0.7.85 made the row's five actions permanently visible on touch (`pointer-fine:` instead of hover), and v0.7.86 grew four of them to 44px (`.touch-target`). Measured on a real touch-emulated phone: a 263px row, 197px of buttons (44/44/44/44/21), **12px left for the title** — exactly one CJK character. Fix: on coarse pointers the five icons collapse into **one 44px ⋯ menu** (`hidden pointer-fine:flex` on the inline strip, `pointer-fine:hidden` on the trigger), with text-labelled menu items — a phone has no hover, so bare icons carry no tooltip. Delete keeps its two-tap confirm inside the menu; the folder item hands off to the existing folder dropdown. Mouse behaviour is unchanged by construction (the desktop declarations sit in the same `@media (pointer: fine)` block they already used). New i18n: `sidebar.moreActions`, `conversation.makePublic/makePrivate` (as a menu action, '公开' has to read '设为公开'). **Verification note worth keeping:** headless Chromium never matches `(pointer: fine)` — it has no pointing device, so both pointer queries are false (`pointer: none`) — and `Emulation.setEmulatedMedia` does not support the `pointer` feature. The desktop branch was therefore verified under **Xvfb + headful chromium**, where `pointer: fine = true`: the five buttons measure 21px again and the ⋯ trigger computes to `display: none`. Touch run: title 12px → 173px, trigger 44×44, all five menu items present. Client `tsc -b` + `vite build` + 11 tests + eslint (0 err / 12 baseline warnings) green; server untouched. | Claude |
| 2026-08-14 | 0.7.89 | **The "no service node available" message now says which of three things is wrong (owner was misled by it).** That 503 fires **before any call to a provider**, yet advised "wait a moment and retry" — so the owner went looking for an outage when the real cause was that freshly pulled models are left disabled by design. None of the three causes is transient; waiting never helps. New `diagnoseNoStation()` — split into pure `diagnoseNoStationFromRows` plus a DB shell, mirroring this file's existing `filterStationsForModel`/`getStationsForModel` pair so it unit-tests without SQLite — separates: no station carries the name (`model-unknown`, e.g. an old conversation remembering a renamed model), every station carrying it is switched off (`station-disabled`), or a live station has it so only the pool flag can have excluded it (`model-not-enabled`). **Unhealthy is deliberately not a cause**: `filterStationsForModel` returns unhealthy stations as a fallback rather than an empty pool. `noStationMessage()` emits three distinctive strings that `friendlyErrorKey` maps to three Chinese/English texts phrased as an action ("tick it under Settings → station → model list") rather than "retry later"; both halves of that text contract are unit-tested (server 260, client 12). **Verified in a real browser across four states**: each cause renders its own message, and the control — config correct but the provider URL fake — renders `All stations failed`, confirming config faults are now distinguishable from genuine call failures. **Also pinned down the owner's exact path**: `ChatInput` reads the model from `localStorage['selected_model']`, so a message still goes out carrying a stale model name while the selector sits empty at "select model" — which is how "the pull worked but chat fails" happens. **Left undone (owner told):** `chat.ts` throws away each station's real error (401 etc.) behind a bare `All stations failed`; surfacing those means collecting errors in the failover loop. | Claude |
| 2026-08-14 | 0.7.90 | **Hand the user the station's actual error (owner: "I need to see the real error").** Sequel to v0.7.89: once the config causes were named, the next wall was `All stations failed` — one bare English string, with the `!response.ok` branch **never reading the response body**, so the provider's own "incorrect API key" / "model does not exist" was discarded. Both failure branches now record `{station, HTTP status, body}` into `stationFailures`. `classifyUpstreamFailures()` picks a single cause **by what the user must do**, not by frequency: 401/403 > 404 > 5xx > 429. Rate limiting ranks last on purpose — it is the only genuinely transient cause, so it must not mask a real misconfiguration sitting behind another station. Six localized texts follow from it. `sanitizeUpstreamDetail()` replaces the station's own key and anything `sk-`/`Bearer`-shaped with `***` and truncates to 300 chars (some providers return a whole HTML error page). **The per-station breakdown goes to admins only** — it names stations and echoes upstream bodies, which a member can neither act on nor should necessarily see; their message already says to fetch an admin. The usage log keeps the full breakdown regardless. Client side: the SSE error carries a `detail` field → `chatStore.errorDetail` → a collapsed `<details>` in the banner that `scrollIntoView`s on open (it lives inside the scrolling message list, so expanding it otherwise grows the box below the fold — precisely the text the user opened it to read) and is a real element rather than a `title=` tooltip, which a phone cannot hover. **Verified against a purpose-built fake upstream on :9999** returning 401/404/429/500 plus an unreachable URL: each renders its own text, and the real key the fake provider echoed back arrives as `***`. A separate member account confirms the response carries no `detail`. server 268 (+8), client 13 (+1). | Claude |
| 2026-08-14 | 0.7.91 | **The header model selector was decorative — what actually went out was the model saved in the daily-model modal (owner: "picked an image model, got model-not-found; switched to grok4.6, same").** One line in `ChatInput` stacked three defects: `const model = prefsChat || selectedModel || models[0]`. (1) `prefs.chatModel` outranked the selector, so changing models in the header changed nothing about the request. (2) `selectedModel` came from `useState(() => localStorage.getItem(...))` — read once at mount, never updated (`_setSelectedModel` was never called), so a later pick could not reach the send path anyway. (3) Neither candidate was checked against the live catalogue, so a name that had been renamed or unpicked still went out. The owner's saved daily default pointed at a model that no longer existed, which is why **every** model she picked failed identically. Fixed by resolving at send time, preferring an explicit pick over the saved default, and taking the first candidate that actually exists in `models` (with a pass-through when the catalogue has not loaded, so a send is never blocked on a list we do not have); the permanently-stale state is deleted, and `DailyModelModal` now writes `localStorage['selected_model']` on save so the two views of one decision cannot drift apart. **The error also names the model now** — the server had always quoted it, but the localized text dropped it, which is precisely what made this take an afternoon to find. **Reproduced and verified locally**: with `user_model_prefs.chat_model = 'ghost-model-v9'` and a valid gpt-4o in the selector, the old build reported "model not found" and the new one sends gpt-4o and surfaces the station's real 401. **Found, not fixed:** `showDailyModal` is driven solely by the server's `needsDailyModal` and nothing anywhere can reopen that modal, so the setting that decides the send model cannot be changed again once dismissed for the day — owner informed. | Claude |
| 2026-08-14 | 0.7.92 | **Daily-model modal deleted; the three model slots move into Settings (owner: "I want to switch any time, like Cherry Studio").** The modal arrived in `99c9f90` alongside the arena/image/TTS work, built on a "commit to today's models on first entry" premise — which is why it felt entitled to let `prefs.chatModel` outrank the header selector, and is the soil v0.7.91's bug grew in. It also could not be reopened once dismissed, so the setting that decided the send model was unreachable for the rest of the day. New `settings/ModelPrefsSection` sits at the top of Settings (everyone's, not admin-only) with chat/image/TTS dropdowns fed by the existing `/api/prefs/catalog`, saving on change with a "✓ saved" marker. The division of labour is stated in the copy: the chat slot is only **what the app opens with** and the header selector overrides it, while image and TTS have no per-message picker so for them this really is the setting. Choosing a chat model also writes `localStorage['selected_model']` so the two views cannot drift. **Trap closed on the way past:** `autoTts` was only ever written by the modal, hard-coded to `true`, with no toggle anywhere — picking a TTS model meant every reply read itself aloud, permanently; there is now a checkbox, shown once a TTS model exists. Removed `DailyModelModal.tsx`, its Layout mount, and `showDailyModal`/`closeDailyModal`; the server drops `needsDailyModal`/`markModalSeen`/`skipDailyModal` from the API surface while **keeping the two DB columns** (dropping a column in SQLite means rebuilding the table, for no gain — nothing writes them now); 9 modal-only i18n keys deleted and one stale string repointed ("pick an image model in the daily modal" → Settings). Verified in a real browser at desktop and 390px: the modal no longer appears, the three dropdowns work and stack on a phone, and the selection reaches localStorage. client 13, server 268, eslint warnings 12 → 11 (deleting the modal removed a historical set-state-in-effect). | Claude |
| 2026-08-15 | 0.7.93 | **Group-chat @AI resolves models and reports failures the way private chat does (owner: "deepseek-chat works in a private chat, group chat says `No enabled station serves model`").** Root cause: `routes/rooms.ts` called `streamInvokeModel` without `adminPool`, so group chat only ever saw the **public** pool (`sm.enabled = 1`), while `routes/chat.ts:284` passes `{adminPool: isAdmin}` and reaches the admin pool (`COALESCE(admin_enabled,1) = 1`). Every other condition — name normalization, station enabled, unhealthy fallback — is shared, so that one omission is the whole difference. The pool is scoped to the **asker**, deliberately not to the room's configuration: `PUT /:id/models` guards on `isMember` only, so honouring the room's model regardless of who asked would let any member reach a model an admin kept out of the public pool on purpose. The check sits before `beginAiTask`, so a misconfiguration costs no occupancy lock and leaves no orphan "thinking" bubble in the shared thread. Empty pools now go through v0.7.89's `diagnoseNoStation`/`noStationMessage` contract, and `GroupChatLayout` finally calls `friendlyErrorKey` (it never had) via a local `localizeError` covering both error surfaces — the store banner and the failed AI bubble — appending the model name the way ChatArea does. **A leak closed on the way past:** on upstream failure `streamInvokeModel` returned `errors.join(' | ')` — station names, HTTP statuses and **raw upstream bodies** — which `broadcastStream('error')` pushed to every member and stored in the shared row, and some providers echo the key you sent straight back. Private chat fixed this in v0.7.90 with `sanitizeUpstreamDetail` plus admin-only detail; rooms had none of it. Both `invokeModel` and `streamInvokeModel` now also collect structured `stationFailures` (status kept apart from a redacted body; the `error` string is unchanged, so arena/media/deepProbe behave exactly as before), and rooms broadcasts a single classified cause while the per-station breakdown goes to the usage log, which is already admin-only — a row shared by the whole room has no admin-only seam to expand inline. Empty `stationFailures` can only mean the pool went empty between the pre-check and the call, so that falls back to a diagnosis rather than a raw English string. **Also, by owner request, the group-chat page is now 1:2:3** (the AI column at 1:1 was too narrow for long answers). The ratio is decided in `RoomsPage`, because the group list and the `GroupChatLayout` wrapper are **siblings**: the wrapper takes `md:flex-[5]` (= 2+3) against the list's `md:flex-[1]` (clamped 200–320px so it neither squeezes group names on a laptop nor wastes an ultrawide), and the 2:3 lives inside. `md:` and up only; phones keep the single-pane tab switch. **This is exactly the v0.7.87 sibling-context trap** — writing 2:3 inside `GroupChatLayout` while leaving the wrapper at `flex-1` splits the page 1:1 first and divides 2:3 within the right half. **Measured in Chromium at four widths**: 1440 → 241:480:719 (an exact 1:2:3), 1024 → 200:330:494 (list on its floor), 1920/2560 → 320:641:959 and 320:897:1343 (list on its ceiling). server 274 (+6), client 13, tsc/build clean, eslint 0 errors / 11 warnings (baseline). **Recorded, not fixed:** the owner failed twice to find where a room's model is set (it hides behind an unlabelled header icon), and `No enabled station serves model` points at the station when the real subject is pool permission. | Claude |
| 2026-08-15 | 0.7.94 | **The six sidebar-footer destinations move into Settings; the sidebar narrows 260px → 190px (owner: "put the memory store, file library and so on into settings, and halve the sidebar").** Which six was the owner's call, asked before building: **only the admin/tool destinations move** — memory store, file library, export chats, import chats, user management, usage logs — while **group chat and the arena stay in the sidebar**, because they are opened daily and burying them costs two clicks every time. New `settings/ToolsSection` sits under the model slots (both are everyone's, above the admin-only blocks) as a `grid-cols-1 sm:grid-cols-2` card, carrying the footer's visibility rules across unchanged: a signed-in member sees four entries, an admin six, a guest none — in which case the card removes itself. Export/import came with their logic; they are file-picker flows, not navigation, and nothing else used them. **The width stops at 190px rather than the literal half (130px)**: at 130px a conversation title has room for roughly eight CJK characters, and v0.7.88 exists precisely because titles had been squeezed to 12px by the buttons beside them — the owner picked 190px (about twelve characters) once given that trade-off. The mobile drawer stays 280px; it overlays the chat instead of competing with it for width. **One navigation change follows:** Settings is now the only entrance to those four pages, so `Layout` sends their back button to `'settings'` rather than `'chat'` — returning somewhere you never came from is worse than the click it saves. **Two traps on the way:** a comment placed between `{sidebarOpen && (` and its `<div>` sits in JSX *expression* position where `{/* */}` is invalid and breaks the build; and building the entry table during render with a row whose handler reads `ref.current` trips react-hooks' "Cannot access refs during render" even though the read only happens on click — replaced by creating the file input on demand in the click handler, which drops the hidden input and the ref together and incidentally removes the need to clear `value` so re-picking the same file still fires. **Verified in Chromium**: sidebar measures 190px; its footer holds only group chat / arena / settings; the Tools & data card shows all six entries; opening the memory store and pressing back lands on Settings. client 13, tsc/build clean, eslint 0 errors / 11 warnings (baseline), i18n 673 = 673. | Claude |
| 2026-08-15 | 0.7.95 | **Real iPhone: the page rendered larger than the screen in both directions, went back to normal on a pinch, and reverted the moment any button was tapped — and after the keyboard closed the composer stayed stranded two thirds up the screen with blank space below (owner, iPhone 13 Pro). One root cause, two symptoms.** It is **not** a layout overflow: at 390×844 `documentElement.scrollWidth` is exactly 390 with zero overflowing elements, and the viewport meta is the standard `width=device-width, initial-scale=1.0`. The cause is that **iOS Safari magnifies the entire page when a focused input/textarea/select computes under 16px, and never zooms back out** — this app's controls are 13–15px for desktop density (the composer is 15px), so the very first tap on the message box fires it and every later tap on any control fires it again, which is exactly the "pinch fixes it, tapping undoes it" loop. `maximum-scale=1` / `user-scalable=no` is not available as a fix: iOS has ignored both since iOS 10, deliberately, because they take zoom away from people who need it. The only lever left is the font — `@media (pointer: coarse) { input, textarea, select { font-size: 16px } }` in `index.css`. **It beats Tailwind's `text-[15px]` through the cascade, not specificity**: custom rules in `index.css` are *unlayered* while `@import "tailwindcss"` puts utilities in `@layer utilities`, and unlayered styles win over layered ones outright — an element selector (0,0,1) could never outrank a class (0,1,0) otherwise. Nothing in the app asks for a control above 16px, so the rule only ever raises. **The second symptom was collateral from the first:** `utils/viewportHeight` had `if (vv.scale !== 1) return;`, meant as "don't fight the user mid-pinch" — but skipping the write freezes whatever value was last published, and on iOS the zoom was neither deliberate nor self-reversing, so the small height written while the keyboard was open was never refreshed after it closed. The shell stayed at keyboard height until a reload, which is precisely what the owner described. It now *removes* `--app-height` when zoomed, handing the rule back to its `100dvh` fallback, which can never be stale. **Verified in Chromium** — note that `Emulation.*` overrides are per-CDP-session, so measuring from a second connection reports `pointer: none` and looks like the fix failed; emulate and measure in one session. With touch emulation on: `pointer: coarse` true, every control on both the chat and settings pages at 16px, and horizontal and vertical overflow both zero. client 13, tsc/build clean, eslint 0 errors / 11 warnings. **Owner's third report — paste does not work in the message box — is not diagnosed yet:** `handlePaste` only calls `preventDefault` when the clipboard carries an image, so plain text should pass through, and there is no `user-select: none` or global key interception anywhere. The working theory is that the zoom above displaced the long-press selection menu; awaiting a retest on the fixed build. | Claude |
| 2026-08-15 | 0.7.96 | **Desktop sidebar titles collapsed to a single character (owner screenshot), appearing after v0.7.94 narrowed the sidebar 260px → 190px.** Not a title-content problem — `chatStore.sendMessage` seeds titles with `message.substring(0, 50)` — and not ordinary truncation either. The culprit is the hover action strip from v0.7.85: `pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100` makes it **invisible but not absent**, and `display: flex` kept it holding roughly 110px of every row. That was survivable at 260px and is not at 190px. The blank space to the right of the "帮" in the screenshot *was* the transparent buttons. Fixed by taking the strip **out of the flow** — `absolute right-2 top-1/2 -translate-y-1/2` with a background that follows the row's own two states, so the panel never shows a seam against it. Toggling `display` on hover was rejected: the title would re-truncate and jump every time the pointer crossed a row. **Measured** — `(pointer: fine)` never matches in headless, so instead the strip's `display` was forced on by hand, which is valid because `absolute` is an unconditional utility and only `display` is pointer-gated: the title box reads 103px with the strip hidden **and** shown, proving it no longer takes width. Hiding the touch-only ⋯ button as well (`pointer-fine:hidden`, which headless leaves on screen because it reports `pointer: none`) reproduces a real desktop: **title box 131px, about ten CJK characters**. Worth noting that this is *wider than it was at 260px* before the fix, where the permanently-reserved strip left the title only 80–100px. client 13, tsc/build clean, eslint 0 errors / 11 warnings. **Two more clues on the paste report:** the iOS Paste callout does not appear at all, and the text being copied came from the in-app copy button on a previous message. `MessageBubble.handleCopy` calls `navigator.clipboard.writeText` as the first statement of the click handler, so the user gesture is intact and it ought to work — but its `catch` swallows failures silently, leaving no signal when a copy does not land, and an empty clipboard is itself a sufficient reason for iOS to offer no Paste. The zoom fixed in v0.7.95 remains the leading suspect; awaiting the owner's retest. | Claude |
| 2026-08-15 | 0.7.97 | **Both station probe jobs default to OFF (a relay banned the owner's account for probing), and streaming answers can finally be scrolled.** ① The traffic profile is the whole story: `healthCheck` swept every enabled station every **60 seconds** (`/models`), which is **1,440 unsolicited requests per station per day** against real chat traffic that might be a few dozen, and `deepProbe` added a genuine chat completion daily. That reads as probing, and a relay treated it as abuse. **Switching them off does not blind the router**: real requests already call `markStationHealth` (the failure branches of `invokeModel`, `streamInvokeModel` and `routes/chat` all do), `filterStationsForModel` treats `unknown` as routable, and an `unhealthy` station is still used as a fallback — so the worst case is that a broken station is discovered when someone actually uses it. New pure `isProbeJobEnabled` mirrors `parseBackupOptions`' parse shape with the default inverted; each `start*Job` returns early with a one-line explanation unless `HEALTH_CHECK_ENABLED` / `DEEP_PROBE_ENABLED` says otherwise. The manual `POST /api/stations/:id/health-check` is deliberately untouched — one request a human asked for is a different thing from a timer nobody sees. The other three timers were audited and none leaves the box (`retention` purges the DB, `roomHub` pings browsers, `backup` snapshots to disk). Startup log verified: both report disabled. ② **Streaming answers could not be scrolled** (owner, desktop): the `ChatArea` effect depends on `[messages, streamingContent]` and `streamingContent` changes on every token, so every token called `scrollIntoView` unconditionally — scrolling up mid-answer was yanked straight back, and `behavior: 'smooth'` layered a new animation over the previous one dozens of times a second, so the view actively fought the wheel instead of ignoring it. Replaced with the standard stick-to-bottom: the container gets an `onScroll` that records whether the reader is at the bottom (**40px of slack** — a container resting at the bottom is often a fraction of a pixel short and elastic overscroll lands nearby), and content only follows when they are. Sending re-enters follow mode (the new last message is the user's own), and switching conversations resets it. Token updates now jump with `auto` while a whole new message still glides with `smooth`, so no animation queue builds up. server 277 (+3), client 13, tsc/build clean, eslint 0 errors / 11 warnings. **Not reproduced this round:** the owner's "tapping Select files does nothing on the phone". At 390×844 the panel measures `x=16..336`, fully on screen, with no overflow on `documentElement` — the suspected "`w-80` clipped by the root `overflow: hidden`" does not hold. Needs more detail. | Claude |

---
| 2026-08-21 | 0.7.98 | 全量代码审计（§10.11）：结论「不是屎山」但有 5 处结构性债务；审计中发现并修复真实安全漏洞——删用户经外键 ON DELETE SET NULL 孤儿化其全部会话，旧规则把无主会话当作「所有人可读可改」，未登录即可读私密对话并 truncate 清空（已实测复现 + 修复后实测验证）；新增 services/conversationAccess.ts 统一三处重复且语义不一致的归属权规则；客户端测试 13→47，顺带修掉英文 `{s}` 复数占位符字面外露、群聊「AI 输出时无法滚动」两个真 bug；同日续做 ②③④⑤ —— 抽出 chatContent / toolCallStream / userPublic 三个纯模块并测住，补齐 6 处前后端类型漂移并新增 typeParity 闸门测试（已验证会失败），清掉两个被取代的 Toggle 组件与三个未使用类型；审计修正：11 处 try/catch ALTER 是 v1 基线重演的必要组成，不是债。测试 290 → 370 | Claude |
| 2026-08-22 | 0.8.0 | 核对外部 AI 审核意见（§10.13）：第三方报告 6 条待修项里 **只有 1 条成立**（`.env.example` 缺失，已补），③ zustand persist 与 ⑥ 静态缓存是**误判**（现状本就正确）、⑤ 无具体点落不了地、② 是注释里已写明的刻意处理、① 属规模问题记作待办。**该报告漏掉了 §10.11 的 🔴 权限漏洞却写「可发布」**，也没提 §10.12，且声称已写入项目实际没落盘。新增 server/.env.example（模板、无密钥、双向校验零遗漏），并写进三条报告没提的真实风险：ENCRYPTION_KEY 丢失=已存节点密钥永久失效、BACKUP_DIR 默认在 git 检出目录内（`git clean -fdx` 连库带备份一起清）、探测开关须保持关闭 | Claude |
| 2026-08-22 | 0.8.0 | **修掉用量统计系统性少算**（§10.12）：原先只数用户那一句话（人设/世界书/联网/记忆/文件库/全部历史都没算）、不看上游 `usage`、自审调用完全不记账、多轮工具调用只按一次算、节点 id/name 一直写 null。新增 services/usageAccounting.ts（21 用例）：数整个 messages + 逐字段取真实回执、缺的用估算补。自审单独记一行。**刻意不加 `stream_options.include_usage`**（改请求体有站会 400，聊天挂掉比数字不准严重）。改前查过影响面：无人设配额、历史 chat 用量仅 1 行 0 token，故不卡人、看板已有数字不跳变。端到端跑了「有回执/无回执」两趟。测试 400→421 | Claude |
| 2026-08-22 | 0.7.99 | ②C 自审段：抽出 services/selfReview.ts（10 用例，锁住「空白结果算失败」这条会抹掉用户答案的判断），并修掉自审按 `"模型 @ 节点名"` 字符串拆解找回节点的隐患（改记 winningStation 对象）；端到端实证开/关自审分别是 2 次/1 次上游调用。处理函数 656→653，测试 390→400。**另报一个未修问题：用量统计只数用户那一句话、不取上游 usage、自审调用不记账 → 配额与成本看板系统性少算** | Claude |
| 2026-08-22 | 0.7.99 | 手机输入法弹出时输入框卡顿：`--app-height` 改为按帧合并写入（rAF），测试 6→11，体感待 owner 真机确认；② 上下文注入段：新增 services/chatContext.ts 把五段 system 注入的**顺序**从「靠调用次序倒推 + 一句注释」变成写明的常量 + 15 个用例（含与旧实现的等价性断言），并抽出文件库/记忆库两个格式化纯函数对齐已有样板；端到端用记录请求体的模拟上游实证顺序未变。处理函数 668→656，测试 370→390 | Claude |

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
