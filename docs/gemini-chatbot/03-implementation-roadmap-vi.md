# Implementation roadmap — “Soi Gương AI”

> Phiên bản: `planning-v0.1`
> Ngày: `2026-05-30`

## 1. Nguyên tắc triển khai

1. Build theo vertical slice để có thể test với business thật sớm.
2. Không build chatbot generic trước rồi mới cố nhét flow vào sau.
3. Không build payment trước khi chứng minh infographic audit tạo intent.
4. Không build full SaaS dashboard ở MVP.
5. Mỗi milestone phải có acceptance criteria và event analytics.
6. Mỗi model task phải có fixture, schema validation và log.
7. Không dùng Google Form như fallback.

## 2. Milestone map

| Milestone | Tên | Mục tiêu | Customer-visible |
| --- | --- | --- | --- |
| `M0` | Technical spike | Chọn pipeline Gemini có thể triển khai thật | Không |
| `M1` | Frontend guided shell | Thay prototype form tĩnh bằng chat/rich-content shell | Có |
| `M2` | Live semantic mirror | Nối Apps Script + Gemini + Sheets để chạy audit thật | Có |
| `M3` | In-page data completion | Bổ sung gap questions, upload và verification | Có |
| `M4` | Full draft + approval | Dựng preview và correction loop | Có |
| `M5` | Embedded commercial close | Package, payment và delivery state | Có |
| `M6` | Pilot hardening | Test business thật, quota, analytics và copy | Có |

## 3. M0 — Technical spike

### 3.1 Mục tiêu

Xác minh capability thực tế trước khi khóa model và prompt strategy.

### 3.2 Việc cần làm

- Tạo Apps Script sandbox Web App.
- Lưu API key bằng Script Properties.
- Test `UrlFetchApp` gọi Gemini API.
- Test structured output JSON schema.
- Test Google Search grounding.
- Test URL Context.
- Test Google Maps URL, Facebook URL và website URL public.
- Benchmark Option A two-pass và Option B single-pass Gemini 3 preview.
- Đo latency, JSON validity, evidence quality, hallucination và cost estimate.
- Chọn model mặc định và fallback model.
- Ghi lại spike report.

### 3.3 Acceptance criteria

- Có ít nhất 12 fixture input thuộc quán ăn, cafe, spa và garage.
- Resolve đúng hoặc hỏi disambiguation hợp lý ở ít nhất 10/12 fixture.
- JSON schema parse thành công ở ít nhất 95% run sau retry policy.
- Public footprint mỏng không tạo critical fact bịa đặt.
- Có quyết định Option A hoặc Option B kèm lý do.

## 4. M1 — Frontend guided shell

### 4.1 Mục tiêu

Biến audit overlay hiện tại thành guided chat + rich-content shell bằng fixture data, chưa cần Gemini live.

### 4.2 Việc cần làm

- Giữ story funnel hiện tại.
- Thay form prototype bằng chat overlay mobile-first.
- Thêm stepper/progress.
- Thêm input seed + quick chips.
- Thêm candidate confirmation card.
- Thêm semantic query carousel.
- Thêm demand cluster grid.
- Thêm footprint mirror.
- Thêm score ring + breakdown.
- Thêm confidence badge.
- Thêm gap cards.
- Thêm Before/After mini preview.
- Thêm CTA full draft.
- Thêm error recovery fixtures.
- Thêm event emitter abstraction.
- Chụp screenshot mobile và desktop.

### 4.3 Acceptance criteria

- Flow fixture chạy từ `N01` đến `N11` mà không reload page.
- Không có Google Form link hoặc external handoff trong flow.
- Mobile viewport đọc được infographic không cần zoom.
- Keyboard navigation cơ bản hoạt động.
- Không inject raw HTML từ fixture hoặc model payload.

## 5. M2 — Live semantic mirror

### 5.1 Mục tiêu

Nối frontend với Apps Script, Sheets và Gemini để chạy audit thật.

### 5.2 Việc cần làm

- Tạo Apps Script `doPost(e)` router.
- Tạo Sheet tabs cho sessions, events, inputs, candidates, contexts, results, prompt config, logs và errors.
- Tạo `open_mirror`, `submit_seed`, `confirm_business`, `request_full_draft` actions.
- Implement classify input.
- Implement resolve candidate task.
- Implement semantic context task.
- Implement evidence mapping task.
- Implement scoring task.
- Implement gap question task.
- Implement mini preview task.
- Implement schema validation và normalize.
- Implement retry/fallback.
- Implement rate limit cơ bản.
- Nối frontend render contract.
- Ghi analytics funnel.

### 5.3 Acceptance criteria

- Seed thật tạo candidate card.
- Owner confirm mới được chạy audit.
- Audit live trả semantic contexts và infographic.
- Score luôn trong `0..100` và breakdown không vượt max.
- Confidence tách riêng score.
- Critical inference luôn có nhãn cần xác nhận.
- Error Gemini hoặc JSON invalid có fallback UX.
- Không lộ API key trong source hoặc network request từ browser.

## 6. M3 — In-page data completion

### 6.1 Mục tiêu

Sau CTA full draft, customer bổ sung dữ liệu ngay trong landing page.

### 6.2 Việc cần làm

- Dùng priority gaps để sinh questionnaire từng câu một.
- Thêm skip logic.
- Thêm optional upload menu/media.
- Thêm upload progress và thumbnail.
- Thêm verification checklist cho critical facts.
- Lưu owner answers.
- Lưu owner-confirmed facts tách khỏi public observations.
- Không yêu cầu password, OTP hoặc banking info.

### 6.3 Acceptance criteria

- Customer không bị kéo ra external form.
- Có thể hoàn tất questionnaire trên mobile.
- Có thể bỏ qua media upload.
- Critical facts chỉ chuyển thành confirmed sau explicit action.

## 7. M4 — Full draft và approval

### 7.1 Mục tiêu

Tạo AI Passport draft mà owner có thể review và sửa ngay trong landing page.

### 7.2 Việc cần làm

- Generate full draft từ verified source of truth.
- Render embedded preview.
- Cho edit inline với field đơn giản.
- Cho correction bằng guided chat cho field phức tạp.
- Thêm approval summary.
- Ghi audit trail cho mỗi correction và approval.

### 7.3 Acceptance criteria

- Preview có watermark trước approval.
- Mọi critical fact dùng trong draft có evidence class và approval state.
- Owner có thể sửa mà không cần dashboard riêng.
- Approval explicit và được log.

## 8. M5 — Embedded commercial close

### 8.1 Mục tiêu

Chốt package và payment mà không phá in-page journey.

### 8.2 Việc cần làm

- Chốt payment provider qua decision record riêng.
- Tạo package cards rõ deliverables.
- Implement embedded checkout adapter.
- Implement payment pending, success và failure states.
- Xác minh payment server-side.
- Cho retry mà không mất draft.
- Render delivery timeline.

### 8.3 Acceptance criteria

- Customer không đi qua external cold form.
- Không xin card/banking info qua chat bubble.
- Payment result được backend xác minh.
- Failure có retry và draft được giữ.

## 9. M6 — Pilot hardening

### 9.1 Mục tiêu

Test thật với customer low-tech trước khi scale.

### 9.2 Việc cần làm

- Test ít nhất 3 business quen và 3 business không quen.
- Quan sát drop-off theo node.
- Phỏng vấn owner về wording gây hiểu nhầm.
- Rà hallucination.
- Rà score gây phản cảm.
- Rà latency mobile.
- Rà quota/cost.
- Tối ưu prompt và microcopy.
- Chốt runbook lỗi.

## 10. Test matrix tối thiểu

### 10.1 Input matrix

| Case | Expected |
| --- | --- |
| Tên business + khu vực rõ | Resolve candidate |
| Tên business trùng nhau | Show disambiguation |
| Google Maps URL | Resolve hoặc fallback hợp lý |
| Facebook URL public | Resolve hoặc fallback hợp lý |
| Website URL public | Dùng URL Context nếu khả dụng |
| URL private/broken | Yêu cầu input thay thế |
| Input rác | Copy lỗi thân thiện |

### 10.2 Industry matrix

| Industry | Ví dụ semantic context |
| --- | --- |
| Quán ăn | Món, nhóm khách, khu vực, tiện ích, đặt bàn |
| Cafe | Làm việc, hẹn hò, specialty, take-away, mở khuya |
| Spa | Nhu cầu, liệu trình, khu vực, đặt lịch, trust |
| Garage | Loại xe, lỗi xe, cứu hộ, bảo hành, khu vực |

### 10.3 Safety matrix

| Case | Expected |
| --- | --- |
| Không thấy parking | Nói “chưa thấy rõ”, không nói “không có” |
| Có hai số phone khác nhau | Gắn `conflict`, yêu cầu owner xác nhận |
| Có inference về nhóm khách | Gắn `inference_needs_confirmation` |
| Public footprint mỏng | Low confidence, không bịa fact |
| User nhập OTP | Không lưu; cảnh báo không gửi OTP |

### 10.4 UI matrix

- Mobile narrow viewport.
- Mobile keyboard open.
- Tablet.
- Desktop.
- Reduced motion.
- Keyboard navigation.
- Slow network.
- Gemini timeout.
- JSON invalid sau lần đầu.
- Customer refresh giữa flow.

## 11. Metrics quyết định có đi tiếp hay không

### Slice 1 metrics

```text
mirror_opened → seed_submitted
seed_submitted → candidate_confirmed
candidate_confirmed → result_viewed
result_viewed → mini_preview_viewed
mini_preview_viewed → full_draft_cta_clicked
```

### Slice 2 metrics

```text
full_draft_cta_clicked → data_completion_started
data_completion_started → owner_approved
```

### Slice 3 metrics

```text
owner_approved → package_selected
package_selected → payment_started
payment_started → payment_succeeded
```

Không tối ưu payment khi chưa chứng minh Slice 1 tạo intent.

## 12. Next step ngay sau bộ planning docs này

### Bước đề xuất: triển khai `M0 — Technical spike`

Lý do:

1. Model và tool capability ảnh hưởng trực tiếp architecture.
2. Cần kiểm tra Maps/Facebook URL có đọc được thực tế đến đâu.
3. Cần benchmark two-pass và Gemini 3 preview single-pass.
4. Cần biết latency có phù hợp rich-content mobile UX không.
5. Cần biết structured output và grounding metadata có đủ ổn định không.

### Output của M0

Tạo thêm tài liệu:

```text
docs/gemini-chatbot/04-technical-spike-report-vi.md
```

Báo cáo phải có:

- Fixture list.
- Request strategy.
- Model tested.
- Tool tested.
- JSON validity.
- Resolve quality.
- Evidence quality.
- Hallucination findings.
- Latency.
- Cost estimate.
- Recommended model/pipeline.
- Known limitations.
- Quyết định có bắt đầu M1 hay cần điều chỉnh blueprint.

### Sau khi M0 được duyệt

Bắt đầu `M1 — Frontend guided shell` bằng fixture data. Đây là bước code customer-visible đầu tiên và cần chụp screenshot mobile + desktop để review UX trước khi nối Gemini live.

## 13. Progress update — 2026-06-07

`M0 — Technical spike` đã hoàn tất trong [`04-technical-spike-report-vi.md`](./04-technical-spike-report-vi.md).

Quyết định sau M0:

- Bắt đầu `M1 — Frontend guided shell` bằng fixture data.
- Dùng `gemini-3-flash-preview` single-pass làm primary pipeline cho M2.
- Giữ `gemini-2.5-flash` two-pass làm fallback cho case mơ hồ, footprint mỏng, social URL khó đọc, JSON invalid hoặc timeout.
- Backend M2 vẫn phải validate schema, hạ confidence cho case thiếu grounding/unique evidence và không auto-confirm critical facts.
- M2 backend skeleton và Gemini integration đã được scaffold trong [`apps-script/soi-guong-ai`](../../apps-script/soi-guong-ai) với `doPost(e)` router, Sheets schema setup, primary/fallback Gemini pipeline và guardrail normalization.
