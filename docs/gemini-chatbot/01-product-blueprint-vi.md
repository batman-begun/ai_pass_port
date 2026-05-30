# Product blueprint — “Soi Gương AI”

> Phiên bản: `planning-v0.1`
> Ngày: `2026-05-30`
> Ngôn ngữ ưu tiên: tiếng Việt đời thường, thân thiện với chủ business low-tech.

## 1. Product truth

“Soi Gương AI” không phải widget chatbot support và cũng không phải form thu lead được bọc bằng giao diện chat.

Đây là **generative sales experience** nằm trong landing page:

```text
Một input public rất nhẹ từ owner
→ Gemini mô phỏng các nhu cầu tìm kiếm tự nhiên của khách tiềm năng
→ hệ thống đối chiếu nhu cầu đó với dấu vết public hiện tại của business
→ frontend dựng infographic cho thấy business đang hiện ra rõ hay mờ trước AI/search
→ customer thấy semantic gaps và mini preview đã được dọn lại
→ customer chủ động đi tiếp tới full draft, approval và payment
```

Giá trị cốt lõi không phải “AI chấm điểm cho vui”. Giá trị nằm ở khoảnh khắc customer nhận ra:

> “Nếu khách hỏi AI theo cách tự nhiên, business của mình có thể chưa được hiểu rõ như mình tưởng.”

## 2. Quyết định UX bất biến

### 2.1 Toàn bộ customer journey nằm trong landing page

Không dùng Google Form. Không dùng external cold form. Không chuyển customer sang dashboard khác để hoàn tất funnel.

Các bước sau đều phải nằm trong `aipass.io.vn`:

- Audit input.
- Business confirmation.
- Semantic simulation.
- Infographic result.
- Mini preview.
- Bổ sung dữ liệu.
- Upload menu/media nếu cần.
- Xác nhận critical facts.
- Owner correction.
- Owner approval.
- Package selection.
- Payment consent và trạng thái thanh toán.
- Final output hoặc delivery status.

Zalo có thể là **kênh hỗ trợ tùy chọn**, không được thay thế customer journey chính.

### 2.2 Chatbot chỉ là người dẫn đường

Chatbot phải tạo cảm giác tự nhiên nhưng không được trò chuyện vô hạn. Mỗi node chỉ có một mục tiêu rõ ràng và tối đa một hành động chính.

Dùng:

- Bubble ngắn.
- Quick replies.
- Chips.
- Cards.
- Stepper.
- Progress feedback.
- Input có scope rõ.

Tránh:

- Paragraph dài.
- Hỏi nhiều câu cùng lúc.
- Jargon kỹ thuật.
- Để Gemini tự quyết định flow.
- Chatbot trả lời mọi câu hỏi ngoài phạm vi.

### 2.3 Infographic là phương tiện kể chuyện chính

Gemini trả structured data. Frontend dựng HTML/CSS rich-content components.

Ưu tiên component frontend thay vì sinh ảnh bằng AI ở MVP vì:

1. Render nhanh.
2. Mobile-friendly.
3. Dễ đo click và funnel event.
4. Dễ sửa copy.
5. Dễ accessible.
6. Dễ tái sử dụng ở preview và report.
7. Không phụ thuộc image-generation latency.

## 3. Customer story cần kể

Kết quả audit phải giúp owner hiểu story sau bằng business thật của họ:

> “Nếu có client thực đang tìm business theo những nhu cầu có vẻ liên quan, họ thường hỏi AI/search theo các cách như thế này. Với dấu vết public hiện tại, AI/search có thể hiểu business của anh/chị theo cách này. Có phần đã rõ, có phần còn mờ, có cơ hội phù hợp nhưng chưa đủ dữ kiện để xác nhận. Vì vậy mức độ rõ ràng và khả năng được hiểu đúng hiện đang ở khoảng `xx/100`.”

Không được biến story thành lời đe dọa. Không fear-mongering. Không giả vờ biết chắc ranking hoặc recommendation.

## 4. Node map toàn bộ customer journey

### Phase A — Entry và soi nhanh

| Node | Tên | Mục tiêu UX | Customer action chính | Output rich-content |
| --- | --- | --- | --- | --- |
| `N00` | Landing story | Hiểu vì sao search behavior đang đổi | Đọc story hoặc bấm CTA | Story screens hiện có |
| `N01` | Open mirror | Mở mini app trong landing | Bấm “Soi quán tôi” | Full-height overlay/mobile sheet |
| `N02` | Collect seed | Cho hệ thống một seed public rất nhẹ | Dán Maps/Facebook/website hoặc nhập tên + khu vực | Input card + quick chips |
| `N03` | Resolve business | Tránh soi nhầm business | Chờ nhận diện | Loading timeline có progress copy |
| `N04` | Confirm candidate | Owner xác nhận đúng business | `Đúng rồi`, `Không phải`, `Tôi sửa lại` | Candidate card |

### Phase B — Semantic simulation và infographic audit

| Node | Tên | Mục tiêu UX | Customer action chính | Output rich-content |
| --- | --- | --- | --- | --- |
| `N05` | Generate contexts | Mô phỏng nhu cầu thật của client | Chờ semantic simulation | Animated context chips |
| `N06` | Show search behavior | Cho owner thấy client thường hỏi thế nào | Xem và mở rộng clusters | Query carousel + demand clusters |
| `N07` | Public footprint mirror | Show AI/search hiện đọc được gì | Xem fact, inference và missing signals | Fact/inference/missing cards |
| `N08` | Visibility snapshot | Tóm tắt độ rõ | Xem score và confidence | Score ring + breakdown bars |
| `N09` | Opportunity gaps | Chỉ ra data gaps đáng ưu tiên | Chọn xem chi tiết | Priority gap cards |
| `N10` | Mini cleaned preview | Cho thấy phiên bản rõ hơn | Xem Before/After | Mini Passport preview |
| `N11` | Full draft CTA | Chuyển từ insight sang intent | Bấm “Dựng bản nháp đầy đủ” | CTA block + trust footer |

### Phase C — Data completion và preview thật

| Node | Tên | Mục tiêu UX | Customer action chính | Output rich-content |
| --- | --- | --- | --- | --- |
| `N12` | Gap questionnaire | Lấp các gap có impact cao | Trả lời từng câu một | Single-question card |
| `N13` | Optional media upload | Nhận menu/ảnh nếu owner muốn dùng | Upload hoặc bỏ qua | Upload card + preview thumbnail |
| `N14` | Verify critical facts | Ngăn hallucination và publish sai | Xác nhận/sửa dữ kiện | Verification checklist |
| `N15` | Generate full draft | Dựng AI Passport draft | Chờ | Staged progress timeline |
| `N16` | Review draft | Cho owner nhìn thấy deliverable thật | Xem page preview | Embedded preview card |
| `N17` | Correction loop | Cho owner sửa không cần học dashboard | Sửa field hoặc gửi yêu cầu | Inline edit / chat-assisted correction |
| `N18` | Owner approval | Chốt dữ liệu được phép dùng | Approve | Approval summary |

### Phase D — Offer, payment và delivery

| Node | Tên | Mục tiêu UX | Customer action chính | Output rich-content |
| --- | --- | --- | --- | --- |
| `N19` | Package selection | Show rõ customer trả tiền nhận gì | Chọn package | Package cards |
| `N20` | Payment consent | Đồng ý thanh toán | Thanh toán trong embedded flow | Payment card |
| `N21` | Payment result | Xác nhận thành công/thất bại | Retry nếu cần | Success/failure card |
| `N22` | Delivery status | Cho customer biết bước tiếp theo | Theo dõi trạng thái | Delivery timeline + optional Zalo support |

## 5. MVP funnel cần build trước

Full journey ở trên là target architecture. Implementation đầu tiên không nên build mọi node cùng lúc.

### MVP Slice 1 — Proof of value

```text
N01 → N02 → N03 → N04 → N05 → N06 → N07 → N08 → N09 → N10 → N11
```

Mục tiêu: kiểm tra owner có cảm được giá trị của semantic simulation và có bấm CTA dựng full draft hay không.

### MVP Slice 2 — In-page conversion

```text
N12 → N13 → N14 → N15 → N16 → N17 → N18
```

Mục tiêu: thay mọi external form bằng in-page completion và owner approval.

### MVP Slice 3 — Commercial close

```text
N19 → N20 → N21 → N22
```

Mục tiêu: hoàn thiện package selection, embedded payment và delivery state.

## 6. Semantic context simulation

### 6.1 Gemini phải giả lập nhu cầu thật, không chỉ audit checklist

Ví dụ seed:

```text
Quán Đồng Quê Ven Kênh, Nhà Bè
```

Gemini cần tạo các nhóm client-context có vẻ liên quan:

| Cluster | Ví dụ query tự nhiên |
| --- | --- |
| Món và loại trải nghiệm | “Cuối tuần gần Sài Gòn ăn món đồng quê ở đâu?” |
| Nhóm bạn | “Nhà Bè có quán nào hợp nhóm 8 người không?” |
| Địa phương | “Từ Quận 7 đi quán vùng ven nào không quá xa?” |
| Tiện ích | “Quán nào có chỗ đậu xe và dễ đặt bàn?” |
| Thời tiết | “Trời mưa có quán đồng quê nào có mái che không?” |
| Trust | “Quán món quê nào có ảnh thật và review ổn?” |

Sau đó hệ thống map từng context vào public footprint hiện có:

```text
Có evidence rõ
→ Có evidence một phần
→ Có vẻ là cơ hội nhưng cần owner xác nhận
→ Chưa thấy public signal
→ Không đủ dữ liệu để kết luận
```

### 6.2 Tách fact, inference và missing signal

| Nhãn nội bộ | Customer-facing wording | Ý nghĩa |
| --- | --- | --- |
| `confirmed_fact` | “Anh/chị đã xác nhận” | Fact đã được owner xác nhận trong flow |
| `public_observation` | “Dấu vết public hiện cho thấy” | Có evidence public phù hợp |
| `inference_needs_confirmation` | “Có thể phù hợp — cần xác nhận” | Suy luận hợp lý nhưng chưa được phép public như fact |
| `missing_signal` | “Dấu vết public hiện chưa thấy rõ” | Không kết luận business không có thuộc tính đó |
| `conflict` | “Thông tin đang chưa thống nhất” | Hai hoặc nhiều nguồn cho tín hiệu khác nhau |

### 6.3 Context coverage không phải ranking guarantee

Semantic coverage giúp business rõ hơn khi client hỏi tự nhiên. Nó không chứng minh rằng một AI cụ thể chắc chắn recommend business đó.

## 7. Infographic contract

### 7.1 Rich-content blocks bắt buộc cho MVP Slice 1

| Component | Mục tiêu | Data source |
| --- | --- | --- |
| `BusinessCandidateCard` | Xác nhận đúng business | Resolve task |
| `SimulationProgress` | Cho thấy hệ thống đang mô phỏng client contexts | State machine |
| `DemandClusterGrid` | Show 5–6 nhóm nhu cầu chính | Semantic context task |
| `ExampleQueryCarousel` | Show câu hỏi tự nhiên của client | Semantic context task |
| `PublicFootprintMirror` | Fact / inference / missing / conflict | Evidence task |
| `ScoreRing` | Show tổng điểm | Scoring task |
| `ScoreBreakdownBars` | Show lý do có điểm đó | Scoring task |
| `EvidenceConfidenceBadge` | Tách confidence khỏi score | Evidence task |
| `PriorityGapCards` | Show 3–5 gap có impact lớn | Gap task |
| `BeforeAfterMiniPreview` | Show bản cleaned preview | Preview task |
| `FullDraftCTA` | Dẫn sang full draft | State machine |
| `TrustFooter` | Giảm nỗi sợ high-tech | Static copy |

### 7.2 Ví dụ story rich-content

```text
┌───────────────────────────────────────────────┐
│ KHÁCH THẬT CÓ THỂ HỎI AI                     │
│                                               │
│ 🍲 “Quán món đồng quê gần Quận 7?”            │
│ 👥 “Chỗ nào hợp nhóm bạn cuối tuần?”          │
│ 🚗 “Quán nào có chỗ đậu xe dễ?”               │
│ 🌧️ “Trời mưa có khu mái che không?”           │
└───────────────────────────────────────────────┘

┌───────────────────────────────────────────────┐
│ GƯƠNG MẶT HIỆN TẠI TRƯỚC MẮT AI              │
│                                               │
│ ✓ Public: có vẻ là quán đồng quê tại Nhà Bè   │
│ ✓ Public: có ảnh và một số dấu vết social     │
│ ~ Cần xác nhận: có phù hợp nhóm đông không    │
│ ! Chưa thấy rõ: menu dạng chữ                 │
│ ! Chưa thấy rõ: chỗ đậu xe                    │
└───────────────────────────────────────────────┘

          AI VISIBILITY SNAPSHOT
                   47 / 100

  Identity                  ███████░░░  11/15
  Offer clarity             █████░░░░░   8/15
  Local relevance           ███████░░░  11/15
  Trust signals             ████░░░░░░   6/15
  AI readability            ███░░░░░░░   5/15
  Conversion clarity        ███░░░░░░░   4/15
  Freshness                 ██░░░░░░░░   2/10

  Evidence confidence: Medium
```

### 7.3 Scorecard đa ngành

| Factor | Max | Câu hỏi chính |
| --- | ---: | --- |
| Entity Identity & NAP Consistency | 15 | Business là ai, ở đâu, contact nào đúng? |
| Offer / Intent Clarity | 15 | Business phục vụ nhu cầu gì? |
| Local & Semantic Match | 15 | Có gắn rõ với khu vực và context tự nhiên không? |
| Trust & Proof | 15 | Có dấu hiệu tin cậy và đang hoạt động không? |
| AI / Search Readability | 15 | Máy có đọc được text, FAQ, summary không? |
| Conversion & Next-Step Clarity | 15 | Client biết gọi, Zalo, chỉ đường, đặt lịch thế nào không? |
| Freshness & Channel Consistency | 10 | Các kênh có mới và nhất quán không? |
| **Tổng** | **100** | |

## 8. Copywriting guardrails

### Không được nói

- “Quán anh/chị chắc chắn sẽ được ChatGPT nhắc tên.”
- “Làm xong chắc chắn lên top Google.”
- “Làm xong doanh số sẽ tăng.”
- “Quán không có chỗ đậu xe.” nếu chỉ vì public data chưa thấy.
- “Quán anh/chị tệ.”

### Nên nói

- “Dấu vết public hiện chưa thấy rõ thông tin chỗ đậu xe.”
- “Đây là bản soi nhanh dựa trên dữ liệu public hệ thống đọc được.”
- “Score là checklist nội bộ của AI Passport, không phải điểm chính thức của Google hoặc nền tảng AI.”
- “Có vẻ phù hợp — cần anh/chị xác nhận trước khi public.”
- “Không cần tin AI. Anh/chị chỉ cần nhìn bản nháp, kiểm tra thông tin và duyệt trước.”

## 9. Trust footer bắt buộc

Hiển thị ở các node có input, upload, approval và payment:

```text
Không hỏi mật khẩu, OTP hoặc tài khoản ngân hàng qua chat.
Chỉ dùng thông tin public hoặc thông tin anh/chị chủ động gửi.
Thông tin critical chỉ public sau khi anh/chị duyệt.
Không cam kết lên top hoặc được AI chắc chắn nhắc tên.
```

## 10. Analytics events tối thiểu

| Event | Trigger |
| --- | --- |
| `mirror_opened` | Customer mở overlay |
| `seed_submitted` | Customer submit seed |
| `candidate_resolved` | Backend trả candidate |
| `candidate_confirmed` | Owner xác nhận candidate |
| `simulation_started` | Bắt đầu semantic simulation |
| `simulation_completed` | Có result hợp lệ |
| `result_viewed` | Owner scroll tới snapshot |
| `gap_expanded` | Owner mở gap detail |
| `mini_preview_viewed` | Owner thấy Before/After |
| `full_draft_cta_clicked` | Owner muốn đi tiếp |
| `data_completion_started` | Owner bắt đầu bổ sung data |
| `owner_approved` | Owner approve draft |
| `package_selected` | Owner chọn package |
| `payment_started` | Mở embedded payment |
| `payment_succeeded` | Thanh toán thành công |
| `payment_failed` | Thanh toán thất bại |

## 11. Definition of done — Product

MVP Slice 1 đạt yêu cầu khi:

1. Customer bấm CTA và vào overlay ngay trong landing.
2. Customer submit seed public nhẹ.
3. Hệ thống resolve business và bắt owner confirm.
4. Gemini tạo semantic contexts có vẻ liên quan đến business.
5. Customer nhìn thấy các kiểu query tự nhiên mà client thật có thể hỏi.
6. Customer nhìn thấy public facts, inference cần xác nhận và missing signals.
7. Customer nhìn thấy score + breakdown + evidence confidence.
8. Customer nhìn thấy mini cleaned preview.
9. Customer bấm CTA dựng full draft mà không bị kéo ra Google Form.
10. Analytics ghi được funnel từ `mirror_opened` đến `full_draft_cta_clicked`.
11. Output không hallucinate critical facts và không overpromise.
