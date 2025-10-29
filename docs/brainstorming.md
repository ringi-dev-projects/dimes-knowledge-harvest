This is a strong pivot. You’re building a **“Knowledge Harvest”** platform that converts senior employees’ tacit know‑how into a living, searchable knowledge base—using voice-first AI interviews, topic coverage tracking, and one‑click export to Notion/HTML/DOCX. Below is a concrete plan you can ship as an MVP on **Next.js + Azure**, plus mid/long‑term steps and a client demo runbook.

---

## 0) What “good” looks like

**Outcomes to promise**

* **Low‑friction capture:** elders talk on the **phone or browser**; the AI asks adaptive questions for 10–60 minutes and does the rest. Use **Azure OpenAI GPT Realtime** (WebRTC for browser; **SIP** for phone) to handle speech‑in / speech‑out with tool calls. ([Microsoft Learn][1])
* **Solid transcripts:** **Azure AI Speech** for STT/TTS (Japanese supported) and **speaker diarization** so you can attribute who said what. ([Microsoft Learn][2])
* **Knowledge map + coverage:** auto‑generate a topic taxonomy from the company’s URL/form, track **coverage %** and **confidence** for each topic across multiple short sessions.
* **One‑click docs:** generate **Notion pages** via API, **HTML handbook**, or **.docx** packs. ([Notion Developers][3])

---

## 1) MVP scope (what to build first)

1. **Project setup (Next.js full‑stack)**

   * Next.js (frontend + API routes).
   * Postgres (or SQLite for a fast PoC) for interviews, topics, coverage.
   * Azure Storage for raw audio; **Azure AI Speech** for STT/TTS; **Azure OpenAI Realtime** for interview agent. ([Microsoft Learn][4])

2. **Seed the “Knowledge Map” from a URL + short form**

   * Crawl the homepage and 1–2 subpages, run a quick LLM pass to propose: **Products, Processes, Equipment, Suppliers, Safety/Compliance, Troubleshooting, Quality, Onboarding**.
   * Persist as a tree of Topics → Subtopics with **target questions** per node using **Structured Outputs** (JSON Schema) on Azure OpenAI. ([Microsoft Learn][5])

3. **Voice interview agent (browser)**

   * Web app “Start interview” → **WebRTC** stream to **GPT Realtime**; the agent keeps state of which topics are uncovered and asks follow‑ups until coverage thresholds are hit. ([Microsoft Learn][1])
   * If the elder doesn’t use a computer, offer **phone interviews** via **SIP** (Realtime API) or **Azure Communication Services (ACS) Call Automation** to place/receive PSTN calls and record safely. ([Microsoft Learn][6])

4. **Post‑processing**

   * **Transcribe** (real‑time or batch), **diarize**, segment into **Q ↔ A** pairs, extract “knowledge atoms” (procedures, cautions, parameters) with **Structured Outputs**. ([Microsoft Learn][7])
   * Store chunks + embeddings in **Azure AI Search** (hybrid vector + keyword) for retrieval later. ([Microsoft Learn][8])

5. **Coverage dashboard**

   * Per topic: **coverage %** (how many target questions answered), **confidence** (consistency across sources + citation density), **quality flags** (gaps, contradictions).
   * A simple **progress bar** per topic and “what to ask next” list.

6. **Export**

   * **Notion**: create a page (or a tree of pages) with blocks mapped to your topic tree via the official API. ([Notion Developers][3])
   * **Word/DOCX** using the **docx** or **docxtemplater** npm packages; **HTML** via server‑side templates. ([npm][9])

7. **Safety & privacy**

   * **PII redaction** using Azure AI Language **PII** or **Microsoft Presidio** before indexing; **Content Safety** for moderation. Add explicit consent & retention policy (APPI in Japan). ([Microsoft Learn][10])

---

## 2) Reference architecture (Azure‑first)

**Frontend**

* Next.js app with: Interview page (WebRTC), Topic coverage dashboard, Export center.

**APIs (Next.js routes)**

* `/api/realtime/session` → creates ephemeral session for **Azure OpenAI Realtime** (WebRTC). ([Microsoft Learn][1])
* `/api/upload-audio` → saves WAV to Azure Storage, triggers async transcription if needed. ([Microsoft Learn][11])
* `/api/seed-map` → fetch URL(s), run LLM with Structured Outputs to produce a **TopicTree JSON**. ([Microsoft Learn][5])
* `/api/coverage` → compute per‑topic coverage & confidence.
* `/api/export/notion` → push blocks via Notion API; `/api/export/docx` → build `.docx`. ([Notion Developers][3])

**Speech & voice**

* **Browser interviews:** Realtime via **WebRTC** → low latency speech‑in/speech‑out. ([Microsoft Learn][1])
* **Phone interviews:** either **SIP directly to Realtime** or **ACS Call Automation** to control PSTN calls; record and stream audio to your agent. ([Microsoft Learn][6])
* **Diarization**: Azure Speech supports **real‑time diarization** to tag speakers in transcripts. ([Microsoft Learn][7])

**Knowledge store & retrieval**

* **Azure AI Search** (vector + keyword + semantic ranker) for interview chunks and any existing PDFs. Hybrid + RRF improves relevance. ([Microsoft Learn][8])
* Use **text‑embedding‑3‑large** on Azure for embeddings. ([Microsoft Learn][12])
* For OCR/scanned legacy docs, use **Azure AI Document Intelligence**. ([Microsoft Learn][13])

**Data**

* Tables: `company`, `topic`, `interview_session`, `qa_turn`, `knowledge_atom`, `coverage_score`, `export_job`.
* Blob Storage: raw audio, JSON outputs, generated docs.

**Guardrails**

* **Structured Outputs** (JSON Schema) so scoring/extraction is machine‑readable. ([Microsoft Learn][5])
* **PII redaction** (Azure AI Language PII) before indexing; **Content Safety** for all user content. ([Microsoft Learn][10])

> Optional: You can also deploy other model families from Azure’s model catalog (e.g., Mistral) if you want price/latency alternatives behind the same adapter. ([Reuters][14])

---

## 3) Interview flow (end‑to‑end)

1. **Seed**

   * Admin enters company URL + a short intake form.
   * LLM parses the site, proposes Topics/Subtopics + initial question bank + extraction schemas (e.g., SOP steps, tolerances, failure modes). **Structured Outputs** enforce the shape. ([Microsoft Learn][5])

2. **Live session (10–60 min)**

   * Elder joins via **browser** or **phone**.
   * The AI interviewer keeps a **topic coverage state machine**: it asks next best question, confirms critical values (“What’s the torque for…?”), branches based on answers, and repeats back in simple language to confirm. Runs on **GPT Realtime** with tool calls to your “coverage” function. ([Microsoft Learn][1])

3. **Post‑processing**

   * Transcript + **diarization**; chunk by Q/A; extract **knowledge atoms** into JSON (procedures, materials, vendor contacts, troubleshooting trees, safety notes). ([Microsoft Learn][7])
   * Push chunks to **Azure AI Search** (vector + keyword) for future grounding and search. ([Microsoft Learn][8])

4. **Coverage & gaps**

   * Compute coverage % per topic = answered_targets / target_count.
   * Compute confidence using factors like: repeated corroboration across sessions, #citations (docs), STT certainty, and contradiction checks.
   * Generate a **“Next 10 questions”** list based on uncovered high‑weight nodes.

5. **Exports**

   * **Notion:** create a parent page, then sections per Topic with Q/A, SOPs, diagrams list. ([Notion Developers][3])
   * **DOCX:** produce a “Company Handbook” with TOC and per‑topic chapters using `docx`/`docxtemplater`. ([npm][9])
   * **HTML:** static handbook for on‑prem intranet.

---

## 4) Data contracts (copy/paste into your code)

**Topic tree (seed output)**

```json
{
  "company": "Acme Manufacturing",
  "topics": [
    {
      "id": "proc_assembly",
      "name": "Assembly Line",
      "weight": 5,
      "targets": [
        {"id":"t1","q":"List all stations and cycle times","required":true},
        {"id":"t2","q":"Torque specs per station","required":true}
      ],
      "children": [
        {
          "id":"proc_assembly_station1",
          "name":"Station 1: Pre-fit",
          "weight": 3,
          "targets":[{"id":"t3","q":"Common defects & fixes","required":false}]
        }
      ]
    }
  ]
}
```

**Knowledge atom (extraction output)**

```json
{
  "topic_id": "proc_assembly_station1",
  "type": "procedure",
  "title": "Station 1 Pre-fit SOP",
  "steps": [
    {"n":1,"text":"Inspect part A for burrs"},
    {"n":2,"text":"Apply 2 drops of Loctite 243"}
  ],
  "parameters": {"torque_nm": 5.5, "tolerance_nm": 0.2},
  "risks": ["Do not exceed 6.0 Nm"],
  "source": {"session_id":"S-2025-10-29-001","speaker":"GUEST1","span":"00:03:11-00:05:04"}
}
```

---

## 5) Minimal wiring (Next.js + Azure), ready for a PoC

> **Browser voice** (lowest friction): use **Azure OpenAI Realtime WebRTC**. Your backend returns a short‑lived session; the browser connects and streams mic audio. Docs include a working WebRTC example. ([Microsoft Learn][1])

* **Server route** `/api/realtime/session`

  * POST to your Azure OpenAI Realtime **sessions** endpoint to create an ephemeral session for `gpt-realtime` / `gpt-4o-mini-realtime-preview`. Return the client token to the browser. ([Microsoft Learn][1])

* **Client**

  * Use `RTCPeerConnection`, capture mic (`getUserMedia`), send the offer, receive the answer; then subscribe to the remote audio track for the AI’s voice. (Pattern follows the Azure WebRTC quickstart.) ([Microsoft Learn][1])

> **Phone fallback** (for elders who prefer calling): either
> (a) point a SIP trunk at the **Realtime API via SIP** (direct), or
> (b) use **ACS Call Automation** to control PSTN calls and bridge audio to your agent. ([Microsoft Learn][6])

**Speech building blocks you’ll need**

* **STT / diarization** via Speech SDK (real‑time), or use **fast/ batch transcription** APIs for recorded calls. ([Microsoft Learn][7])
* **TTS** with Japanese neural voices for prompts/confirmations. ([Microsoft Learn][15])

**Retrieval & storage**

* **Embeddings**: `text-embedding-3-large` (Azure), vector fields in **Azure AI Search**, use **hybrid** + optional **semantic ranker**. ([Microsoft Learn][12])
* **OCR/Forms**: run **Document Intelligence** on legacy scans to enrich the knowledge base. ([Microsoft Learn][13])

**Safety & compliance**

* **PII detection** (Language PII or **Presidio**), **Content Safety** moderation; log consent + retention (Japanese **APPI** references below). ([Microsoft Learn][10])

---

## 6) Coverage math (simple & explainable)

For each topic `T`:

* **Coverage**: `answered_required / required_targets` (hard floor), and display a second bar for `answered_total / all_targets`.
* **Confidence** (0–100): weighted sum of (a) # corroborating sessions, (b) STT certainty, (c) doc citations retrieved from AI Search, (d) contradiction penalty across sessions.
* **Next questions**: greedily select highest‑weight **uncovered** targets per topic.

All of this is just metadata in your DB and easy to visualize in a progress bar grid.

---

## 7) Exports

* **Notion**: use `pages.create` and `blocks.append` to mirror your topic tree → sections → Q/A → SOPs. ([Notion Developers][3])
* **DOCX**: `docx` or `docxtemplater` to generate a handbook with TOC and styles. ([npm][9])
* **HTML**: server‑rendered static pages with a left nav mirroring the topic tree.

---

## 8) Short‑term / Mid‑term / Long‑term

**Short‑term (MVP)**

* WebRTC interview in the browser; SIP/phone optional. ([Microsoft Learn][1])
* URL + form → **TopicTree** with JSON schema (Structured Outputs). ([Microsoft Learn][5])
* Real‑time prompt: “ask until target coverage; confirm values verbally.”
* Transcribe + diarize; extract **knowledge atoms**; coverage dashboard. ([Microsoft Learn][7])
* Export to Notion & DOCX. ([Notion Developers][3])

**Mid‑term**

* **Scheduling & call me** flows (ACS) + **recording** with legal banners. ([Microsoft Learn][16])
* **Hybrid RAG** over interviews + old PDFs with Azure AI Search + semantic ranker. ([Microsoft Learn][17])
* **Topic templates** per industry (manufacturing, field service, construction).
* **Evaluator** in Azure AI Studio / Prompt Flow to monitor answer quality and hallucinations (and try Microsoft’s “correction” feature when appropriate). ([Microsoft Learn][18])

**Long‑term**

* Organization‑wide **knowledge hub** with permissions; **change‑tracking** & approvals.
* **Confidence analytics** (e.g., heatmaps of high‑risk undocumented areas).
* **Multi‑speaker sessions** (panel interviews) and photo/doc capture from mobile.
* Optional **Teams/SharePoint** integrations.

---

## 9) Demo storyboard (for a prospective client)

1. **Seed**: enter their public URL + a 5‑field form → instant TopicTree preview.
2. **Live capture**: start a 3‑minute sample interview (browser or dial‑in number). The AI asks 3–5 targeted questions; they watch the coverage bar fill in real time. ([Microsoft Learn][1])
3. **Aftercall**: show transcript with speaker labels, extracted SOP, and a “Next 10 questions” deck. ([Microsoft Learn][7])
4. **Export**: click **“Send to Notion”** → open the page that mirrors the TopicTree; also download a DOCX. ([Notion Developers][3])

---

## 10) Legal & trust checklist (Japan‑first posture)

* **Consent & notice**: make explicit that sessions are recorded and processed; show retention window and who can access. (See **APPI** resources from the Personal Information Protection Commission; use their English references as guides.) ([Government of Japan][19])
* **PII handling**: automatic detection + redaction before indexing (Azure AI Language PII or **Presidio**). Log every redaction. ([Microsoft Learn][10])
* **Data residency**: deploy services in Japanese or chosen Azure regions (Speech region list), keep audio/blobs in‑region. ([Microsoft Learn][20])
* **Content safety**: run **Azure AI Content Safety** over transcripts. ([Microsoft Learn][21])

---

## 11) Fast build notes (you can implement now)

* **Realtime voice (browser)**: follow the **Azure Realtime WebRTC quickstart**; your server issues a session token; the client uses `RTCPeerConnection` to stream mic → model and play audio back. ([Microsoft Learn][1])
* **Phone**: if you want PSTN on day one, either **SIP directly to Realtime** or use **ACS Call Automation** (outbound/inbound, DTMF capture, recording). ([Microsoft Learn][6])
* **Transcription**: for uploads or recorded calls, **fast/batch transcription** REST endpoints can finish the job; diarization quickstarts are available. ([Microsoft Learn][11])
* **Retrieval**: **Azure AI Search** with vectors + semantic rerank; ingest via indexers and skills; optionally store enriched projections in a **knowledge store** on Azure Storage for downstream analytics. ([Microsoft Learn][8])
* **Embeddings**: use **text‑embedding‑3‑large** on Azure; there’s an official tutorial. ([Microsoft Learn][12])
* **Structured Outputs**: Azure supports JSON‑Schema‑based structured outputs in chat/completions—use this for TopicTree, knowledge atoms, and exports. ([Microsoft Learn][5])
* **Exports**: Notion API for pages/blocks; `docx`/`docxtemplater` for Word docs. ([Notion Developers][3])

---

## 12) What I recommend you build first (MVP checklist)

* [ ] Next.js project with three pages: **Seed**, **Interview**, **Dashboard**
* [ ] `/api/realtime/session` + browser WebRTC hook (Azure Realtime) ([Microsoft Learn][1])
* [ ] `/api/seed-map` → LLM **Structured Outputs** to create TopicTree ([Microsoft Learn][5])
* [ ] Speech SDK wired for **diarization** + transcript storage ([Microsoft Learn][7])
* [ ] Azure AI Search index (vectors + hybrid) + embeddings pipeline ([Microsoft Learn][8])
* [ ] Coverage computation + “Next questions” selector
* [ ] Export: Notion + DOCX
* [ ] PII redaction + consent banner (APPI‑aware) ([Microsoft Learn][10])

If you’d like, I can draft the **Next.js API route skeletons** (session token for WebRTC Realtime, seed‑map with structured outputs, Notion export) and a minimal schema for your Postgres tables.

[1]: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/realtime-audio-quickstart?utm_source=chatgpt.com "GPT Realtime API for speech and audio - Azure"
[2]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/language-support?utm_source=chatgpt.com "Language support - Speech service - Azure AI services"
[3]: https://developers.notion.com/reference/post-page?utm_source=chatgpt.com "Create a page"
[4]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/overview?utm_source=chatgpt.com "What is the Speech service? - Azure AI services"
[5]: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/structured-outputs?utm_source=chatgpt.com "How to use structured outputs with Azure OpenAI ..."
[6]: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/realtime-audio-sip?utm_source=chatgpt.com "Use the GPT Realtime API via SIP - Azure OpenAI"
[7]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/get-started-stt-diarization?utm_source=chatgpt.com "Real-time diarization quickstart - Speech service - Azure AI ..."
[8]: https://learn.microsoft.com/en-us/azure/search/vector-search-overview?utm_source=chatgpt.com "Vector search - Azure AI Search"
[9]: https://www.npmjs.com/package/docx?utm_source=chatgpt.com "docx"
[10]: https://learn.microsoft.com/en-us/azure/ai-services/language-service/personally-identifiable-information/overview?utm_source=chatgpt.com "Azure AI Language Personally Identifiable Information (PII) ..."
[11]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/rest-speech-to-text?utm_source=chatgpt.com "Speech to text REST API - Speech service - Azure AI services"
[12]: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/tutorials/embeddings?utm_source=chatgpt.com "Azure OpenAI in Azure AI Foundry Models embeddings ..."
[13]: https://learn.microsoft.com/en-us/azure/ai-services/document-intelligence/?view=doc-intel-4.0.0&utm_source=chatgpt.com "Azure AI Document Intelligence Documentation"
[14]: https://www.reuters.com/technology/microsoft-partners-with-openais-french-rival-mistral-2024-02-26/?utm_source=chatgpt.com "Microsoft partners with OpenAI's French rival Mistral"
[15]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/index-text-to-speech?utm_source=chatgpt.com "Text to speech documentation - Azure AI services"
[16]: https://learn.microsoft.com/en-us/azure/communication-services/concepts/call-automation/call-automation?utm_source=chatgpt.com "Call Automation overview - An Azure Communication ..."
[17]: https://learn.microsoft.com/en-us/azure/search/hybrid-search-overview?utm_source=chatgpt.com "Hybrid search using vectors and full text in Azure AI Search"
[18]: https://learn.microsoft.com/en-us/azure/ai-foundry/concepts/prompt-flow?utm_source=chatgpt.com "Prompt flow in Azure AI Foundry portal"
[19]: https://www.ppc.go.jp/en/legal?utm_source=chatgpt.com "Laws and Policies |PPC Personal Information Protection ..."
[20]: https://learn.microsoft.com/en-us/azure/ai-services/speech-service/regions?utm_source=chatgpt.com "Speech service supported regions - Azure"
[21]: https://learn.microsoft.com/en-us/azure/ai-services/content-safety/?utm_source=chatgpt.com "Azure AI Content Safety documentation"
