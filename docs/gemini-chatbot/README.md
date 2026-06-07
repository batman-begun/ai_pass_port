# Bộ tài liệu planning — Gemini chatbot module “Soi Gương AI”

> Trạng thái: **Planning blueprint + M0 technical spike đã sẵn sàng để bắt đầu M1**
> Ngày cập nhật: **2026-06-07**
> Phạm vi: customer-facing mini application chạy trong landing page `aipass.io.vn`.

## 1. Mục tiêu của bộ tài liệu

Bộ tài liệu này khóa lại intent sản phẩm và chia module “Gemini chatbot” thành các phần đủ rõ để implementation không bị trượt thành một chatbot hỏi đáp tổng quát.

Tên customer-facing được đề xuất cho module:

> **Soi Gương AI**
> **Khách hỏi AI về business của bạn — AI đang thấy gì?**

Module là một **guided generative sales journey**: chatbot dẫn đường, Gemini mô phỏng các ngữ cảnh tìm kiếm tự nhiên của khách tiềm năng, backend kiểm soát state và dữ kiện, còn frontend kể kết quả bằng infographic/rich-content dễ hiểu.

## 2. Quyết định đã khóa cứng

1. **Không dùng Google Form ở bất kỳ bước nào.**
2. **Không kéo customer ra khỏi landing page** trong customer journey chính, kể cả sau CTA, lúc bổ sung dữ liệu, duyệt preview hoặc đồng ý thanh toán.
3. Chatbot **không phải chatbot tự do**. Đây là guided flow có state machine.
4. Gemini phải chạy **semantic context simulation**, không chỉ chấm checklist tĩnh.
5. Kết quả phải được frontend render thành **rich-content / infographic**, không trả một khối paragraph dài.
6. Mọi critical fact phải tách rõ: `confirmed_fact`, `public_observation`, `inference_needs_confirmation`, `missing_signal`.
7. Không hứa tăng doanh số, không hứa lên top Google, không hứa chatbot hoặc AI chắc chắn nhắc tên business.
8. Score là checklist nội bộ của AI Passport; không phải điểm chính thức của Google hoặc nền tảng AI nào.
9. Owner phải duyệt dữ liệu critical trước khi public.
10. API key không được xuất hiện trong frontend.

## 3. Tài liệu trong thư mục

| Tài liệu | Nội dung |
| --- | --- |
| [`01-product-blueprint-vi.md`](./01-product-blueprint-vi.md) | Product intent, UX principles, node map, infographic story, guardrails và definition of done. |
| [`02-technical-architecture-vi.md`](./02-technical-architecture-vi.md) | Kiến trúc Apps Script + Sheets + Gemini, state machine, API contract, schemas, logging và technical spikes. |
| [`03-implementation-roadmap-vi.md`](./03-implementation-roadmap-vi.md) | Milestone triển khai, acceptance criteria, test matrix và bước tiếp theo sau planning. |
| [`04-technical-spike-report-vi.md`](./04-technical-spike-report-vi.md) | Kết quả M0 technical spike, fixture benchmark, quyết định model/pipeline và điều kiện bắt đầu M1. |

## 4. Cách review nhanh

Nếu chỉ có 15 phút, hãy review theo thứ tự:

1. Đọc phần “quyết định đã khóa cứng” ở trên.
2. Review node map trong `01-product-blueprint-vi.md` để kiểm tra customer journey.
3. Review phần infographic contract để kiểm tra cách kể chuyện.
4. Review model strategy và technical spikes trong `02-technical-architecture-vi.md`.
5. Review milestone M0–M2 trong `03-implementation-roadmap-vi.md` để duyệt thứ tự build.

## 5. Quan hệ với landing page hiện tại

Landing page hiện có story funnel, CTA và audit overlay prototype. Blueprint này **không thay story funnel bằng chatbot generic**. Blueprint mở rộng prototype thành mini application:

```text
Story funnel hiện tại
→ customer bấm “Soi quán tôi”
→ guided chat overlay
→ semantic simulation thật
→ infographic cá nhân hóa
→ mini preview
→ in-page data completion
→ in-page approval
→ in-page payment consent
→ final delivery/status
```

## 6. Tài liệu kỹ thuật chính thức đã đối chiếu

Các quyết định kỹ thuật trong blueprint được đối chiếu với tài liệu chính thức sau vào ngày **2026-05-30**:

- Gemini structured outputs: <https://ai.google.dev/gemini-api/docs/structured-output>
- Gemini grounding with Google Search: <https://ai.google.dev/gemini-api/docs/google-search>
- Gemini URL Context: <https://ai.google.dev/gemini-api/docs/url-context>
- Apps Script Web Apps: <https://developers.google.com/apps-script/guides/web>
- Apps Script Properties Service: <https://developers.google.com/apps-script/reference/properties/properties-service>
- Apps Script UrlFetchApp: <https://developers.google.com/apps-script/reference/url-fetch/url-fetch-app>

Các capability, model name và quota có thể thay đổi. Trước khi production deploy cần chạy lại technical spike và xác minh docs hiện hành.
