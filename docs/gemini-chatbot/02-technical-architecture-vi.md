# Technical architecture — Gemini chatbot module “Soi Gương AI”

> Phiên bản: `planning-v0.1`
> Ngày: `2026-05-30`
> Phạm vi: kiến trúc MVP và target architecture cho in-page customer journey.

## 1. Kiến trúc tổng quát

```text
Landing page / rich-content frontend
→ POST request tới Google Apps Script Web App
→ Apps Script controller kiểm tra state, rate limit và payload
→ Apps Script đọc prompt config / session từ Google Sheets
→ Apps Script gọi Gemini API bằng API key trong Script Properties
→ Gemini dùng task-specific prompt và JSON schema
→ Apps Script validate, normalize, log model run
→ Apps Script trả JSON render contract
→ Frontend render chat bubble + infographic components
```

### Vai trò từng layer

| Layer | Vai trò |
| --- | --- |
| Landing page | Customer UI, rich-content renderer, local UX state, analytics emitter |
| Apps Script Web App | Backend controller, state machine, Gemini proxy, validation, persistence, rate limit cơ bản |
| Google Sheets | MVP database và operator-readable log |
| Gemini API | AI worker cho resolve, semantic contexts, evidence mapping, scoring và preview |
| Embedded payment adapter | Payment journey không kéo customer khỏi landing page |

## 2. Quy tắc kiến trúc bất biến

1. Frontend không chứa Gemini API key.
2. Frontend không gọi Gemini API trực tiếp.
3. Gemini không điều khiển state machine.
4. Không render raw Gemini paragraph dài.
5. Backend chỉ trả JSON theo render contract đã validate.
6. Mọi model run phải log `model_name`, `prompt_id`, `prompt_version`, latency và status.
7. Mọi critical fact phải có evidence class.
8. Không có Google Form trong bất kỳ nhánh customer journey nào.
9. Payment provider chỉ được chọn nếu hỗ trợ UX phù hợp với in-page journey; external cold-form payment không được coi là hoàn thành intent.

## 3. State machine

### 3.1 State chính

```text
START
COLLECT_SEED
RESOLVE_BUSINESS
CONFIRM_BUSINESS
GENERATE_CONTEXTS
MAP_PUBLIC_EVIDENCE
BUILD_SNAPSHOT
SHOW_RESULT
OFFER_FULL_DRAFT
COLLECT_GAPS
COLLECT_MEDIA_OPTIONAL
VERIFY_CRITICAL_FACTS
GENERATE_FULL_DRAFT
REVIEW_DRAFT
CORRECTION_LOOP
OWNER_APPROVAL
SELECT_PACKAGE
PAYMENT_PENDING
PAYMENT_SUCCESS
PAYMENT_FAILED
DELIVERY_STATUS
END
ERROR_RECOVERABLE
```

### 3.2 Transition MVP Slice 1

```text
START
  → COLLECT_SEED
  → RESOLVE_BUSINESS
  → CONFIRM_BUSINESS
      ├─ confirm → GENERATE_CONTEXTS
      ├─ reject  → COLLECT_SEED
      └─ edit    → COLLECT_SEED
  → MAP_PUBLIC_EVIDENCE
  → BUILD_SNAPSHOT
  → SHOW_RESULT
  → OFFER_FULL_DRAFT
      ├─ accept  → COLLECT_GAPS
      └─ close   → END
```

### 3.3 Backend là authority

Frontend có thể giữ state để render nhanh, nhưng request tiếp theo luôn gửi `session_id`, `client_state` và `user_action`. Backend kiểm tra transition hợp lệ dựa trên server state. Không tin hoàn toàn state từ browser.

## 4. Endpoint design

MVP có thể dùng một Apps Script `doPost(e)` duy nhất với action router.

### 4.1 Request envelope

```json
{
  "session_id": "uuid-or-null",
  "client_state": "COLLECT_SEED",
  "user_action": "submit_seed",
  "payload": {
    "seed": "Quán Đồng Quê Ven Kênh Nhà Bè",
    "seed_type_hint": "semantic_query"
  },
  "metadata": {
    "page_url": "https://aipass.io.vn/",
    "referrer": "https://facebook.com/...",
    "utm_source": "facebook",
    "utm_medium": "post",
    "utm_campaign": "launch",
    "locale": "vi-VN",
    "timezone": "Asia/Ho_Chi_Minh"
  }
}
```

### 4.2 Response envelope

```json
{
  "ok": true,
  "session_id": "uuid",
  "server_state": "CONFIRM_BUSINESS",
  "assistant_message": "Em tìm thấy có vẻ là business này. Đúng của anh/chị không?",
  "render_blocks": [
    {
      "type": "business_candidate",
      "data": {
        "name": "Quán Đồng Quê Ven Kênh",
        "area_or_address": "Nhà Bè, TP.HCM",
        "category_guess": "Quán món đồng quê",
        "match_confidence": "medium",
        "evidence_summary": ["Tên và khu vực có vẻ khớp"]
      }
    }
  ],
  "quick_replies": [
    { "id": "confirm", "label": "Đúng rồi" },
    { "id": "reject", "label": "Không phải" },
    { "id": "edit", "label": "Tôi sửa lại" }
  ],
  "next_action": "await_business_confirmation"
}
```

### 4.3 Action router MVP Slice 1

| `user_action` | Server task | Next state |
| --- | --- | --- |
| `open_mirror` | Create session | `COLLECT_SEED` |
| `submit_seed` | Classify input, log input, resolve candidate | `CONFIRM_BUSINESS` hoặc `COLLECT_SEED` |
| `confirm_business` | Generate contexts, map evidence, score, preview | `SHOW_RESULT` |
| `reject_business` | Log rejection | `COLLECT_SEED` |
| `edit_seed` | Log edit intent | `COLLECT_SEED` |
| `expand_gap` | Log analytics; optional return detail | `SHOW_RESULT` |
| `request_full_draft` | Mark qualified intent | `COLLECT_GAPS` |
| `close_mirror` | Mark abandoned/completed | `END` |

## 5. Gemini task decomposition

Không dùng một mega-prompt cho toàn bộ flow. Tách task để dễ validate, đo latency và đổi model.

| Prompt ID | Task | Input | Output chính |
| --- | --- | --- | --- |
| `resolve_business_v0_1` | Nhận diện candidate | Seed, URL nếu có | Candidate + confidence + observations |
| `generate_semantic_contexts_v0_1` | Sinh context giống client thật | Candidate đã owner confirm | Demand clusters + natural-language queries |
| `map_public_evidence_v0_1` | Đối chiếu contexts với public footprint | Candidate, URLs, contexts | Facts, inference, missing, conflicts |
| `score_visibility_v0_1` | Chấm checklist nội bộ | Evidence map | Score breakdown + confidence |
| `generate_gap_questions_v0_1` | Chọn gap có impact cao | Evidence map + score | Priority gaps + owner questions |
| `generate_mini_preview_v0_1` | Dựng cleaned preview | Facts + gaps | Tagline, summary, CTA, FAQ draft |
| `summarize_owner_story_v0_1` | Viết microcopy ngắn | Kết quả normalize | Bubble copy, không paragraph dài |

## 6. Structured schemas

### 6.1 Semantic context schema

```json
{
  "clusters": [
    {
      "id": "group_weekend_dining",
      "label_vi": "Nhóm bạn đi ăn cuối tuần",
      "why_relevant": "Business có vẻ thuộc nhóm quán món đồng quê vùng ven.",
      "example_queries": [
        "Cuối tuần gần Quận 7 đi ăn món đồng quê ở đâu?",
        "Nhà Bè có quán nào hợp nhóm bạn không?"
      ],
      "relevance": "high",
      "relevance_reason": "Có tín hiệu về món đồng quê và khu vực Nhà Bè.",
      "inference_notice": "Đây là ngữ cảnh mô phỏng, không phải dữ liệu search volume."
    }
  ]
}
```

### 6.2 Public evidence schema

```json
{
  "observations": [
    {
      "signal_key": "parking",
      "label_vi": "Chỗ đậu xe",
      "status": "missing_signal",
      "customer_copy": "Dấu vết public hiện chưa thấy rõ thông tin chỗ đậu xe.",
      "evidence_urls": [],
      "confidence": "low",
      "requires_owner_confirmation": true
    }
  ]
}
```

Allowed `status`:

```text
confirmed_fact
public_observation
inference_needs_confirmation
missing_signal
conflict
```

### 6.3 Score snapshot schema

```json
{
  "total_score": 47,
  "evidence_confidence": "medium",
  "confidence_explanation_vi": "Có một số dấu vết public nhưng còn thiếu thông tin quan trọng.",
  "factors": [
    {
      "key": "identity_nap",
      "label_vi": "Tên, địa chỉ và liên hệ",
      "score": 11,
      "max_score": 15,
      "reason_vi": "Tên và khu vực khá rõ, nhưng contact chưa thấy nhất quán."
    }
  ],
  "disclaimer_vi": "Đây là checklist nội bộ của AI Passport, không phải điểm chính thức của Google hoặc nền tảng AI."
}
```

### 6.4 Mini preview schema

```json
{
  "business_name": "Quán Đồng Quê Ven Kênh",
  "tagline_vi": "Món đồng quê vùng ven Nhà Bè cho nhóm bạn muốn đổi vị cuối tuần.",
  "summary_vi": "Bản mô tả nháp cần owner xác nhận trước khi public.",
  "strengths": [
    {
      "text_vi": "Có vẻ phù hợp nhóm bạn muốn ăn món quê vùng ven.",
      "fact_class": "inference_needs_confirmation"
    }
  ],
  "recommended_ctas": ["Xem menu", "Nhắn Zalo", "Gọi", "Chỉ đường"],
  "faq_drafts": [
    "Quán có chỗ đậu ô tô không?",
    "Nhóm đông có cần đặt bàn trước không?"
  ],
  "watermark_vi": "Bản nháp — cần chủ business xác nhận"
}
```

## 7. Frontend render contract

Backend chỉ trả các block type thuộc allowlist:

```text
assistant_bubble
quick_reply_group
business_candidate
simulation_progress
semantic_cluster_grid
example_query_carousel
public_footprint_mirror
score_ring
score_breakdown
confidence_badge
priority_gap_list
before_after_preview
trust_footer
full_draft_cta
error_recovery
```

Frontend map `type` sang component HTML/CSS đã viết sẵn. Không cho model trả HTML. Không inject raw model HTML vào DOM.

## 8. Google Sheets schema MVP

### 8.1 `mirror_sessions`

```text
session_id
created_at
updated_at
current_state
status
locale
page_url
referrer
utm_source
utm_medium
utm_campaign
user_agent_hash
last_error_code
```

### 8.2 `mirror_events`

```text
event_id
session_id
created_at
event_name
state
payload_json
```

### 8.3 `mirror_inputs`

```text
input_id
session_id
created_at
input_type
raw_input
normalized_input
source_guess
```

### 8.4 `business_candidates`

```text
candidate_id
session_id
created_at
business_name
area_or_address
category_guess
match_confidence
public_urls_json
evidence_summary_json
owner_confirmed
```

### 8.5 `semantic_contexts`

```text
context_run_id
session_id
created_at
clusters_json
prompt_version
model_name
status
```

### 8.6 `mirror_results`

```text
result_id
session_id
created_at
total_score
evidence_confidence
score_breakdown_json
public_observations_json
priority_gaps_json
mini_preview_json
raw_normalized_json
prompt_versions_json
model_names_json
status
```

### 8.7 `qualified_intents`

```text
intent_id
session_id
created_at
business_name
quick_score
evidence_confidence
cta_source
status
```

### 8.8 Chuẩn bị cho Slice 2 và Slice 3

```text
owner_answers
media_assets
draft_profiles
owner_approvals
package_selections
payment_events
delivery_status
```

### 8.9 Operator tables

```text
prompt_configs
model_run_logs
errors
rate_limit_counters
```

## 9. Guardrails backend

### 9.1 Validation

- Reject payload quá dài.
- Sanitize string trước khi ghi Sheet.
- Allowlist URL protocols `https:` và `http:` nếu cần.
- Không render HTML từ model.
- Validate JSON schema.
- Validate business logic: score factor không vượt max, total score trong `0..100`, enum đúng allowlist.
- Nếu confidence thấp, wording phải mềm và yêu cầu owner xác nhận.

### 9.2 Fact safety

- Critical facts không được auto-promote từ inference sang confirmed.
- Phone, Zalo, address, opening hours, price, menu item, parking, certifications và media rights phải owner-confirm trước publish.
- Public evidence không đồng nghĩa owner approval.

### 9.3 Privacy

- Không hỏi password, OTP hoặc tài khoản ngân hàng qua chat.
- Không ghi API key vào Sheet.
- API key lưu trong Apps Script Script Properties.
- Giảm tối đa việc lưu dữ liệu nhạy cảm.

### 9.4 Rate limit và abuse

Apps Script controller cần rate limit cơ bản theo session và fingerprint nhẹ. Không lưu fingerprint có tính xâm lấn nếu không cần thiết.

Ví dụ policy MVP:

```text
resolve_business: tối đa 3 lần / session
semantic_simulation: tối đa 2 lần / confirmed business / session
full rerun: yêu cầu explicit user action
```

## 10. Error UX

| Trường hợp | Customer-facing copy | Action |
| --- | --- | --- |
| Không resolve được business | “Em chưa nhận diện chắc đúng business. Anh/chị thêm khu vực hoặc dán link Maps/Facebook giúp em nhé.” | Quay về `COLLECT_SEED` |
| Có nhiều candidate | “Em thấy vài business khá giống nhau. Anh/chị chọn đúng business giúp em.” | Render candidate list |
| URL không đọc được | “Link này hiện chưa đọc được rõ. Mình vẫn có thể soi bằng tên business + khu vực.” | Cho input thay thế |
| Gemini timeout | “Hệ thống đang hơi nghẽn. Anh/chị thử lại sau ít phút.” | Retry có giới hạn |
| JSON invalid | “Kết quả vừa rồi chưa đủ rõ để hiển thị. Em đang thử dựng lại bản soi.” | Backend retry một lần |
| Public footprint quá mỏng | “Dấu vết public hiện còn mỏng. Đây cũng là lý do business dễ bị hiểu thiếu.” | Vẫn show low-confidence snapshot |
| Payment failed | “Thanh toán chưa hoàn tất. Anh/chị có thể thử lại, dữ liệu bản nháp vẫn được giữ.” | Retry payment |

## 11. Model strategy và technical spike bắt buộc

### 11.1 Capability đã xác minh từ docs chính thức ngày 2026-05-30

- Gemini API hỗ trợ structured output theo JSON Schema.
- Gemini API hỗ trợ Grounding with Google Search.
- Gemini API hỗ trợ URL Context.
- Theo docs structured output hiện hành, kết hợp structured outputs với built-in tools như Google Search và URL Context trong cùng request là preview capability cho Gemini 3 series được liệt kê trong docs.
- Apps Script Web Apps hỗ trợ `doPost(e)` và có thể trả response text.
- Apps Script `UrlFetchApp` có thể gọi external HTTP API.
- Apps Script `PropertiesService` có Script Properties phù hợp để giữ API key ngoài frontend và Sheet.

Nguồn:

- <https://ai.google.dev/gemini-api/docs/structured-output>
- <https://ai.google.dev/gemini-api/docs/google-search>
- <https://ai.google.dev/gemini-api/docs/url-context>
- <https://developers.google.com/apps-script/guides/web>
- <https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app>
- <https://developers.google.com/apps-script/reference/properties/properties-service>

### 11.2 Hai phương án cần spike

#### Option A — Two-pass pipeline ưu tiên kiểm soát

```text
Pass 1: model + Search / URL Context
→ lấy grounded observations và metadata
Pass 2: model + JSON Schema
→ normalize thành render contract
Backend validate
→ frontend infographic
```

Ưu điểm:

- Tách evidence discovery khỏi formatting.
- Dễ debug.
- Có thể dùng model ổn định/rẻ hơn tùy capability thực tế.

Nhược điểm:

- Latency cao hơn.
- Tốn thêm request.

#### Option B — Single-pass Gemini 3 preview

```text
Gemini 3 series
+ Search / URL Context
+ Structured Output
→ backend validate
→ frontend infographic
```

Ưu điểm:

- Ít request hơn.
- Có tiềm năng giảm latency.

Nhược điểm:

- Preview capability cần kiểm tra ổn định.
- Cần benchmark chất lượng JSON, grounding và chi phí.

### 11.3 Spike matrix

| Case | Cần đo |
| --- | --- |
| Tên business + khu vực | Resolve accuracy |
| Google Maps URL public | URL readability, fallback behavior |
| Facebook Page URL public | URL readability, fallback behavior |
| Website URL public | URL Context quality |
| Business trùng tên | Candidate disambiguation |
| Public footprint mỏng | Hallucination resistance |
| Quán ăn, cafe, spa, garage | Cross-industry quality |
| Option A vs Option B | Latency, cost, JSON validity, evidence quality |

### 11.4 Chưa khóa model name trong implementation

Workbook prototype từng dùng `gemini-2.5-flash`, nhưng blueprint không mặc định đó là quyết định production. Model phải được chọn sau spike dựa trên docs hiện hành, chất lượng, latency, quota và chi phí.

## 12. Payment architecture note

Intent sản phẩm yêu cầu customer journey nằm tại landing page. Vì vậy Slice 3 cần adapter abstraction:

```text
PaymentAdapter.openEmbeddedCheckout(package, session)
PaymentAdapter.handleSuccess(event)
PaymentAdapter.handleFailure(event)
```

Tiêu chí chọn provider:

1. UX embedded hoặc in-page phù hợp.
2. Có webhook hoặc callback xác minh trạng thái server-side.
3. Không yêu cầu customer điền external cold form.
4. Có thể resume session sau lỗi.
5. Không tin payment success chỉ từ browser callback.

Provider cụ thể chưa được chọn trong planning-v0.1 và phải là decision riêng trước Slice 3.

## 13. Security note cho payment

Chatbot không bao giờ xin:

- Password.
- OTP.
- Số tài khoản ngân hàng qua bubble chat.
- Thông tin thẻ dưới dạng text chat.

Payment UI phải do payment provider phù hợp xử lý trong embedded flow an toàn; backend xác minh kết quả bằng cơ chế server-side của provider.
