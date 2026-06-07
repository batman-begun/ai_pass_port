# M0 technical spike report — “Soi Gương AI”

> Trạng thái: **M0 hoàn tất đủ điều kiện bắt đầu M1**  
> Ngày chạy spike: **2026-06-07 UTC**  
> Phạm vi: xác minh Gemini pipeline cho MVP Slice 1 trước khi build guided frontend shell và live semantic mirror.

## 1. Kết luận executive

M0 đã chạy xong với 12 fixture thuộc 4 nhóm ngành: quán ăn, cafe, spa và garage. Kết quả đủ để **bắt đầu M1 — Frontend guided shell bằng fixture data**.

Quyết định pipeline cho MVP:

```text
Primary pipeline: Option B — single-pass Gemini 3 Flash Preview
Fallback pipeline: Option A — two-pass Gemini 2.5 Flash khi input mơ hồ, footprint mỏng, cần evidence discovery rõ hơn, hoặc single-pass fail validation.
```

Lý do chọn:

1. Option B đạt 100% JSON validity sau khi tăng output budget, latency thấp hơn rõ so với Option A.
2. Option B pass 11/12 fixture về resolve/disambiguation expectation và không auto-promote critical fact nhạy cảm.
3. Option A cũng pass 11/12 và có evidence discovery tốt hơn ở case mơ hồ, nhưng latency cao hơn gần gấp đôi.
4. Gemini 3 structured output + built-in tools là preview capability, nên M2 không được phụ thuộc mù quáng vào single-pass; backend vẫn phải validate schema và có fallback.

## 2. Tài liệu chính thức đã xác minh lại

Đã đối chiếu lại tài liệu chính thức trong ngày 2026-06-07:

- Gemini structured outputs: <https://ai.google.dev/gemini-api/docs/structured-output>
- Gemini grounding with Google Search: <https://ai.google.dev/gemini-api/docs/google-search>
- Gemini URL Context: <https://ai.google.dev/gemini-api/docs/url-context>
- Gemini model capabilities: <https://ai.google.dev/gemini-api/docs/models>
- Gemini API pricing: <https://ai.google.dev/gemini-api/docs/pricing>
- Apps Script Web Apps: <https://developers.google.com/apps-script/guides/web>
- Apps Script `PropertiesService`: <https://developers.google.com/apps-script/reference/properties/properties-service>
- Apps Script `UrlFetchApp`: <https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app>

Capability relevant cho blueprint tại thời điểm spike:

- Structured output hỗ trợ JSON Schema subset và cần backend validate business logic sau khi parse.
- Gemini 3 series hỗ trợ kết hợp structured output với built-in tools như Google Search và URL Context theo preview capability.
- `gemini-3-flash-preview` có Search grounding, URL Context và structured outputs; phù hợp làm primary spike model cho UX cần latency thấp.
- `gemini-2.5-flash` có structured output, Search grounding và URL Context, nhưng spike dùng nó theo two-pass để giảm rủi ro khi không muốn trộn tool + schema trong một request.
- Apps Script Web App có thể expose `doPost(e)` và trả `ContentService.TextOutput` cho action router.
- Apps Script `PropertiesService` phù hợp để giữ Gemini API key ngoài frontend và Sheet.
- Apps Script `UrlFetchApp` gọi được external HTTPS API, nhưng cần scope `script.external_request` khi set manifest thủ công.

## 3. Spike harness

Artifact được thêm vào repo:

| File | Vai trò |
| --- | --- |
| [`m0-spike/fixtures.json`](./m0-spike/fixtures.json) | 12 fixture input cho quán ăn, cafe, spa, garage, duplicate-name và thin-footprint cases. |
| [`m0-spike/run_m0_spike.py`](./m0-spike/run_m0_spike.py) | Python stdlib runner gọi Gemini REST API bằng `GEMINI_API_KEY` trong environment. |
| [`m0-spike/results.json`](./m0-spike/results.json) | Kết quả sanitized, không chứa API key, gồm latency, token usage, JSON validity và parsed output. |

Command đã chạy:

```bash
python3 docs/gemini-chatbot/m0-spike/run_m0_spike.py
```

Runner không đọc hoặc ghi API key vào file. Secret chỉ được lấy từ environment variable `GEMINI_API_KEY`.

## 4. Fixture list

| ID | Ngành | Input type | Seed | Expected behavior |
| --- | --- | --- | --- | --- |
| F01 | Restaurant | name_area | Pizza 4P's Ben Thanh Ho Chi Minh City | resolve |
| F02 | Restaurant | name_area | Quán Bụi Original Ngô Văn Năm Quận 1 | resolve |
| F03 | Restaurant | thin_footprint | Quán Đồng Quê Ven Kênh Nhà Bè món đồng quê chỗ đậu xe | insufficient_or_low_confidence |
| F04 | Cafe | name_area | The Coffee House Cao Thắng Quận 3 | resolve_or_disambiguate |
| F05 | Cafe | website_url | https://congcaphe.com/ Cộng Cà Phê Hồ Chí Minh | resolve_or_disambiguate |
| F06 | Cafe | duplicate_name | Highlands Coffee Nguyễn Huệ Hồ Chí Minh | disambiguation_or_resolve |
| F07 | Spa | name_area | Mộc Kim Spa Quận 1 Thành phố Hồ Chí Minh | resolve_or_low_confidence |
| F08 | Spa | name_area | Thu Cúc Clinics spa Quận 1 Hồ Chí Minh | resolve_or_disambiguate |
| F09 | Spa | facebook_url_hint | Facebook page Seoul Spa Hồ Chí Minh | resolve_or_disambiguate |
| F10 | Garage | name_area | Garage Ô Tô Minh Phương Quận 7 | resolve_or_low_confidence |
| F11 | Garage | name_area | Toyota Đông Sài Gòn service center | resolve_or_disambiguate |
| F12 | Garage | duplicate_name | sửa xe điện gần Nhà Bè tên An Phát | disambiguation_or_insufficient |

## 5. Request strategy tested

### Option A — two-pass pipeline

```text
Pass 1: gemini-2.5-flash + Google Search + URL Context
→ discovery notes, uncertainty, candidate/evidence signals

Pass 2: gemini-2.5-flash + structured JSON schema
→ normalize thành render-contract-like snapshot

Backend validation
→ frontend infographic block rendering
```

Ưu điểm quan sát được:

- Conservative hơn ở case footprint mỏng hoặc brand nhiều chi nhánh.
- Evidence discovery metadata xuất hiện ổn hơn trong run spike.
- Dễ debug vì có `discovery_excerpt` trước khi normalize.

Nhược điểm quan sát được:

- Latency trung bình cao hơn đáng kể.
- Tốn 2 request cho mỗi fixture.
- Nếu discovery notes dài, pass normalize cần output budget đủ lớn để tránh truncation.

### Option B — single-pass Gemini 3

```text
gemini-3-flash-preview + Google Search + URL Context + structured JSON schema
→ backend validate
→ frontend infographic block rendering
```

Ưu điểm quan sát được:

- Latency thấp hơn.
- Sau khi tăng `maxOutputTokens`, JSON validity đạt 100%.
- Phù hợp UX mobile nếu render progressive state tốt.

Nhược điểm quan sát được:

- Preview capability nên phải coi là chưa ổn định dài hạn.
- Evidence grounding metadata không phải lúc nào cũng xuất hiện dù tool được bật.
- Có một case footprint mỏng bị resolve hơi tự tin hơn mong muốn; backend cần thêm rule hạ confidence.

## 6. Aggregate result

| Metric | Option B — `gemini-3-flash-preview` single-pass | Option A — `gemini-2.5-flash` two-pass |
| --- | ---: | ---: |
| Runs | 12 | 12 |
| JSON valid | 12/12 — 100.0% | 12/12 — 100.0% |
| Resolve/disambiguation expectation pass | 11/12 | 11/12 |
| Critical hallucination guard pass | 12/12 | 12/12 |
| Average latency | 14,184 ms | 26,048 ms |
| P50 latency | 11,256 ms | 26,534 ms |
| Max latency | 32,413 ms | 31,525 ms |
| Prompt tokens | 2,603 | 8,712 |
| Candidate tokens | 15,859 | 17,109 |
| Thinking tokens | 16,961 | 26,204 |
| Total token count | 35,423 | 52,025 |
| Runs with grounding metadata | 3/12 | 11/12 |

Acceptance criteria check:

| Criteria | Result | Status |
| --- | --- | --- |
| Ít nhất 12 fixture thuộc quán ăn, cafe, spa, garage | Có 12 fixture / 4 ngành | Pass |
| Resolve đúng hoặc hỏi disambiguation hợp lý ít nhất 10/12 | 11/12 ở cả hai option | Pass |
| JSON schema parse thành công ít nhất 95% sau retry policy | 100% sau khi tăng output budget | Pass |
| Public footprint mỏng không tạo critical fact bịa đặt | 12/12 không auto-confirm phone/Zalo/price/hours/parking/certification | Pass |
| Có quyết định Option A hoặc Option B kèm lý do | Chọn Option B primary + Option A fallback | Pass |

## 7. Per-fixture outcome

### Option B — single-pass

| Fixture | Expected | Actual status | Confidence | Score | Note |
| --- | --- | --- | --- | ---: | --- |
| F01 | resolve | resolved | high | 88 | Pass |
| F02 | resolve | resolved | high | 88 | Pass |
| F03 | insufficient_or_low_confidence | resolved | medium | 55 | Needs backend confidence downgrade |
| F04 | resolve_or_disambiguate | resolved | high | 88 | Pass |
| F05 | resolve_or_disambiguate | resolved | high | 88 | Pass, but branch ambiguity should be reviewed |
| F06 | disambiguation_or_resolve | disambiguation | medium | 68 | Pass |
| F07 | resolve_or_low_confidence | disambiguation | low | 35 | Pass |
| F08 | resolve_or_disambiguate | resolved | high | 92 | Pass |
| F09 | resolve_or_disambiguate | resolved | high | 88 | Pass |
| F10 | resolve_or_low_confidence | resolved | high | 62 | Pass, but garage claims need owner confirmation |
| F11 | resolve_or_disambiguate | resolved | high | 88 | Pass |
| F12 | disambiguation_or_insufficient | disambiguation | low | 45 | Pass |

### Option A — two-pass

| Fixture | Expected | Actual status | Confidence | Score | Note |
| --- | --- | --- | --- | ---: | --- |
| F01 | resolve | resolved | high | 90 | Pass |
| F02 | resolve | resolved | high | 88 | Pass |
| F03 | insufficient_or_low_confidence | disambiguation | low | 35 | Pass; more conservative than Option B |
| F04 | resolve_or_disambiguate | resolved | high | 85 | Pass |
| F05 | resolve_or_disambiguate | disambiguation | low | 55 | Pass; correctly avoids forcing one branch |
| F06 | disambiguation_or_resolve | resolved | high | 85 | Pass |
| F07 | resolve_or_low_confidence | resolved | medium | 75 | Pass, but review spa-claim wording |
| F08 | resolve_or_disambiguate | disambiguation | low | 35 | Pass |
| F09 | resolve_or_disambiguate | insufficient | low | 15 | Fail against expectation; useful fallback behavior if social signal is unreadable |
| F10 | resolve_or_low_confidence | disambiguation | low | 55 | Pass |
| F11 | resolve_or_disambiguate | resolved | high | 75 | Pass |
| F12 | disambiguation_or_insufficient | disambiguation | low | 35 | Pass |

## 8. Evidence quality findings

1. **Name + area works well enough for MVP candidate card.** Strong public businesses resolve reliably and produce usable candidate summaries.
2. **Thin footprint needs hard backend downgrade.** F03 shows the exact risk: model can produce a plausible local candidate even when seed is demo-like or generic.
3. **Brand-level URLs should not auto-select a branch.** Cộng Cà Phê / Highlands-like inputs need either branch selection card or explicit owner confirmation.
4. **Social-page seeds are uneven.** A seed phrased as Facebook page may resolve to a brand/entity but does not guarantee direct Facebook page readability. M2 UX must accept “dán link public hoặc thêm khu vực”.
5. **Garage and spa categories need stricter fact safety.** Services, certifications, medical/beauty claims, pricing, warranty and contact data must remain owner-confirmed unless strong public source exists.
6. **Grounding metadata is useful but not complete UX evidence.** The backend should log metadata when present, but should not assume missing metadata means no public observation.

## 9. Hallucination and safety findings

Observed guardrail behavior:

- No run auto-confirmed critical phone/Zalo/price/opening-hours/parking/certification facts as safe-to-publish facts.
- Gap questions were consistently generated for owner confirmation.
- Score disclaimer was present in structured payloads.
- Disambiguation appeared in duplicate-name/local-intent cases.

Required backend hard rules for M2:

1. If input contains generic name + area but no unique URL and confidence is not high, force `CONFIRM_BUSINESS` with candidate card rather than `SHOW_RESULT` directly.
2. Never map `parking`, `phone`, `zalo`, `price`, `opening_hours`, `certification`, `warranty`, `medical_claim`, `menu_item`, or `media_rights` to `confirmed_fact` unless there is strong public evidence and/or owner confirmation.
3. If `grounding_count == 0` and business is not a clearly known entity, cap `match_confidence` at `medium` and require owner confirmation.
4. If brand has multiple branches, require branch confirmation even when brand-level confidence is high.
5. Score must be validated in `0..100`; factor scores must not exceed max values when M2 adds detailed breakdown.

## 10. Latency and UX implication

Option B average latency around 14.2s is acceptable for MVP only if frontend renders progressive steps:

```text
1. “Em đang nhận diện business…”
2. “Em đang mô phỏng cách khách hỏi AI…”
3. “Em đang soi dấu vết public…”
4. Result infographic
```

Option A average latency around 26.0s is too long for default mobile interaction, but acceptable as fallback if UI communicates that the case is ambiguous and needs a deeper read.

M1 should therefore implement `simulation_progress` fixture states now, even before M2 live backend exists.

## 11. Cost estimate

Pricing assumptions from official Gemini pricing page on 2026-06-07:

- `gemini-3-flash-preview`: $0.50 / 1M input tokens, $3.00 / 1M output tokens including thinking tokens.
- `gemini-2.5-flash`: $0.30 / 1M input tokens, $2.50 / 1M output tokens including thinking tokens.
- Search grounding has free monthly/daily allowances depending model/tier, then separate search-grounding charges; production estimate must track actual grounded prompts/search queries.

Spike token-only estimate for 12 fixtures:

| Pipeline | Input tokens | Output + thinking tokens | Estimated token cost / 12 runs | Estimated token cost / run |
| --- | ---: | ---: | ---: | ---: |
| Option B | 2,603 | 32,820 | ~$0.0998 | ~$0.0083 |
| Option A | 8,712 | 43,313 | ~$0.1109 | ~$0.0092 |

Production note: real cost can be higher if search grounding is billed after free allowances or if prompts/render schema grow in M2.

## 12. Recommended implementation decision

### Approved to start M1

M0 is complete enough to start **M1 — Frontend guided shell** because:

- render schema shape is feasible,
- latency profile is known,
- JSON parse target is achievable with sufficient output budget,
- product guardrails are enforceable through backend validation,
- the biggest risks are now UX/state/rendering and fallback handling, which M1 can build with fixtures.

### M2 model/pipeline default

Use this default in M2 spike-to-production implementation:

```text
Default model: gemini-3-flash-preview
Default pipeline: Option B single-pass with tools + structured output
Fallback model: gemini-2.5-flash
Fallback pipeline: Option A two-pass discovery + normalize
```

Fallback triggers:

- invalid JSON after one retry,
- no grounding metadata plus low/medium confidence on local ambiguous business,
- duplicate-name or multi-branch signal,
- social URL/page readability issue,
- public footprint mỏng,
- model timeout,
- sensitive category claim needs extra caution.

## 13. Known limitations

1. Spike used Gemini REST API directly from local runner, not Apps Script Web App. Apps Script Web App still needs implementation and deployment test in M2.
2. Spike used environment variable secret handling, not `PropertiesService`; M2 must verify Script Properties in Apps Script.
3. Fixture set is broad enough for M0, not enough for production QA.
4. Direct Google Maps URL and actual Facebook URL readability need more production fixtures once owner provides candidate businesses.
5. Preview model behavior can change; model name and capability must be rechecked before production deploy.
6. Search grounding metadata coverage is not guaranteed per response; logging must tolerate absence.
7. Token-cost estimate excludes future prompt growth, Sheets overhead, retries, and paid grounding over allowance.

## 14. Next action after M0

Proceed to **M1 — Frontend guided shell**:

1. Keep current landing story funnel.
2. Replace audit prototype with guided chat/rich-content shell.
3. Use fixture data only; no live Gemini call in M1.
4. Implement block allowlist rendering and no raw HTML injection.
5. Add `simulation_progress`, candidate confirmation, semantic clusters, footprint mirror, score ring, confidence badge, gap cards, before/after preview and CTA.
6. Add event emitter abstraction for later M2 analytics.
7. Capture mobile and desktop screenshots after visible UI change.
