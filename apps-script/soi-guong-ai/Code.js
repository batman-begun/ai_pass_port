/**
 * Soi Gương AI — M2 Apps Script backend.
 *
 * Deployment properties required:
 * - GEMINI_API_KEY: Gemini API key stored in Script Properties.
 * - MIRROR_SHEET_ID: Google Sheet ID used as the append-only backend store.
 *
 * Optional Script Properties:
 * - PRIMARY_MODEL: defaults to gemini-3-flash-preview.
 * - FALLBACK_MODEL: defaults to gemini-2.5-flash.
 * - PROMPT_VERSION: defaults to m2-router-v0.1.
 */

const APP = Object.freeze({
  version: 'm2-router-v0.1',
  primaryModel: 'gemini-3-flash-preview',
  fallbackModel: 'gemini-2.5-flash',
  apiBase: 'https://generativelanguage.googleapis.com/v1beta/models',
  maxSeedChars: 700,
  maxPayloadChars: 12000,
  localeDefault: 'vi-VN',
  timezoneDefault: 'Asia/Ho_Chi_Minh'
});

const STATES = Object.freeze({
  COLLECT_SEED: 'COLLECT_SEED',
  CONFIRM_BUSINESS: 'CONFIRM_BUSINESS',
  SHOW_RESULT: 'SHOW_RESULT',
  COLLECT_GAPS: 'COLLECT_GAPS',
  END: 'END'
});

const ACTIONS = Object.freeze({
  OPEN_MIRROR: 'open_mirror',
  SUBMIT_SEED: 'submit_seed',
  CONFIRM_BUSINESS: 'confirm_business',
  REJECT_BUSINESS: 'reject_business',
  EDIT_SEED: 'edit_seed',
  EXPAND_GAP: 'expand_gap',
  REQUEST_FULL_DRAFT: 'request_full_draft',
  CLOSE_MIRROR: 'close_mirror'
});

const FACT_STATUSES = Object.freeze([
  'confirmed_fact',
  'public_observation',
  'inference_needs_confirmation',
  'missing_signal',
  'conflict'
]);

const CRITICAL_SIGNAL_KEYS = Object.freeze([
  'phone',
  'zalo',
  'address',
  'opening_hours',
  'price',
  'menu_item',
  'parking',
  'certification',
  'warranty',
  'medical_claim',
  'media_rights'
]);

const SHEET_SCHEMAS = Object.freeze({
  mirror_sessions: [
    'session_id', 'created_at', 'updated_at', 'current_state', 'status', 'locale', 'page_url', 'referrer',
    'utm_source', 'utm_medium', 'utm_campaign', 'user_agent_hash', 'last_error_code'
  ],
  mirror_events: ['event_id', 'session_id', 'created_at', 'event_name', 'state', 'payload_json'],
  mirror_inputs: ['input_id', 'session_id', 'created_at', 'input_type', 'raw_input', 'normalized_input', 'source_guess'],
  business_candidates: [
    'candidate_id', 'session_id', 'created_at', 'business_name', 'area_or_address', 'category_guess',
    'match_confidence', 'public_urls_json', 'evidence_summary_json', 'owner_confirmed'
  ],
  semantic_contexts: ['context_run_id', 'session_id', 'created_at', 'clusters_json', 'prompt_version', 'model_name', 'status'],
  mirror_results: [
    'result_id', 'session_id', 'created_at', 'total_score', 'evidence_confidence', 'score_breakdown_json',
    'public_observations_json', 'priority_gaps_json', 'mini_preview_json', 'raw_normalized_json',
    'prompt_versions_json', 'model_names_json', 'status'
  ],
  qualified_intents: ['intent_id', 'session_id', 'created_at', 'business_name', 'quick_score', 'evidence_confidence', 'cta_source', 'status'],
  prompt_configs: ['prompt_version', 'created_at', 'model_name', 'pipeline', 'prompt_json', 'status'],
  model_run_logs: [
    'run_id', 'session_id', 'created_at', 'task_name', 'pipeline', 'model_name', 'latency_ms', 'ok',
    'json_valid', 'fallback_used', 'error_code', 'usage_json', 'grounding_count'
  ],
  errors: ['error_id', 'session_id', 'created_at', 'action', 'error_code', 'message', 'details_json'],
  rate_limit_counters: ['counter_id', 'session_id', 'created_at', 'window_key', 'action', 'count']
});

const RESOLVE_CANDIDATE_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    match_status: { type: 'string', enum: ['resolved', 'disambiguation', 'insufficient'] },
    business_name: { type: 'string' },
    area_or_address: { type: 'string' },
    category_guess: { type: 'string' },
    match_confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    evidence_summary: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 6 },
    public_urls: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    owner_confirmation_required: { type: 'boolean' },
    reason_vi: { type: 'string' }
  },
  required: [
    'match_status', 'business_name', 'area_or_address', 'category_guess', 'match_confidence',
    'evidence_summary', 'public_urls', 'owner_confirmation_required', 'reason_vi'
  ]
});

const MIRROR_RESULT_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    business_candidate: RESOLVE_CANDIDATE_SCHEMA,
    semantic_context: {
      type: 'object',
      properties: {
        clusters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label_vi: { type: 'string' },
              why_relevant: { type: 'string' },
              example_queries: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 4 },
              relevance: { type: 'string', enum: ['low', 'medium', 'high'] },
              relevance_reason: { type: 'string' },
              inference_notice: { type: 'string' }
            },
            required: ['id', 'label_vi', 'why_relevant', 'example_queries', 'relevance', 'relevance_reason', 'inference_notice']
          },
          minItems: 2,
          maxItems: 5
        }
      },
      required: ['clusters']
    },
    public_evidence: {
      type: 'object',
      properties: {
        observations: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              signal_key: { type: 'string' },
              label_vi: { type: 'string' },
              status: { type: 'string', enum: FACT_STATUSES },
              customer_copy: { type: 'string' },
              evidence_urls: { type: 'array', items: { type: 'string' }, maxItems: 4 },
              confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
              requires_owner_confirmation: { type: 'boolean' }
            },
            required: [
              'signal_key', 'label_vi', 'status', 'customer_copy', 'evidence_urls',
              'confidence', 'requires_owner_confirmation'
            ]
          },
          minItems: 4,
          maxItems: 10
        }
      },
      required: ['observations']
    },
    score_snapshot: {
      type: 'object',
      properties: {
        total_score: { type: 'integer', minimum: 0, maximum: 100 },
        evidence_confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
        confidence_explanation_vi: { type: 'string' },
        factors: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              label_vi: { type: 'string' },
              score: { type: 'integer', minimum: 0 },
              max_score: { type: 'integer', minimum: 1 },
              reason_vi: { type: 'string' }
            },
            required: ['key', 'label_vi', 'score', 'max_score', 'reason_vi']
          },
          minItems: 3,
          maxItems: 8
        },
        disclaimer_vi: { type: 'string' }
      },
      required: ['total_score', 'evidence_confidence', 'confidence_explanation_vi', 'factors', 'disclaimer_vi']
    },
    priority_gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title_vi: { type: 'string' },
          reason_vi: { type: 'string' },
          required_owner_input_vi: { type: 'string' },
          priority: { type: 'string', enum: ['low', 'medium', 'high'] }
        },
        required: ['title_vi', 'reason_vi', 'required_owner_input_vi', 'priority']
      },
      minItems: 3,
      maxItems: 8
    },
    mini_preview: {
      type: 'object',
      properties: {
        business_name: { type: 'string' },
        tagline_vi: { type: 'string' },
        summary_vi: { type: 'string' },
        strengths: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text_vi: { type: 'string' },
              fact_class: { type: 'string', enum: FACT_STATUSES }
            },
            required: ['text_vi', 'fact_class']
          },
          maxItems: 5
        },
        recommended_ctas: { type: 'array', items: { type: 'string' }, maxItems: 6 },
        faq_drafts: { type: 'array', items: { type: 'string' }, maxItems: 6 },
        watermark_vi: { type: 'string' }
      },
      required: ['business_name', 'tagline_vi', 'summary_vi', 'strengths', 'recommended_ctas', 'faq_drafts', 'watermark_vi']
    }
  },
  required: ['business_candidate', 'semantic_context', 'public_evidence', 'score_snapshot', 'priority_gaps', 'mini_preview']
});

function doGet() {
  return jsonResponse({ ok: true, service: 'soi-guong-ai', version: APP.version });
}

function doPost(e) {
  const startedAt = Date.now();
  let request;
  let sessionId = '';
  let action = '';

  try {
    request = parseRequest(e);
    sessionId = request.session_id || Utilities.getUuid();
    action = request.user_action || '';
    ensureSheetsReady();
    enforceRateLimit(sessionId, action);

    const context = buildContext(request, sessionId, startedAt);
    const response = routeAction(context);
    appendEvent(sessionId, action, response.server_state, {
      client_state: request.client_state || '',
      ok: response.ok,
      next_action: response.next_action || ''
    });
    return jsonResponse(response);
  } catch (error) {
    const safeError = toSafeError(error);
    if (sessionId || action) {
      appendErrorSafe(sessionId || 'unknown', action || 'unknown', safeError.code, safeError.message, safeError.details || {});
    }
    return jsonResponse(buildErrorEnvelope(sessionId || null, safeError), 200);
  }
}

function setupMirrorSheets() {
  ensureSheetsReady();
  seedPromptConfig();
  return Object.keys(SHEET_SCHEMAS);
}

function routeAction(context) {
  switch (context.action) {
    case ACTIONS.OPEN_MIRROR:
      return handleOpenMirror(context);
    case ACTIONS.SUBMIT_SEED:
      return handleSubmitSeed(context);
    case ACTIONS.CONFIRM_BUSINESS:
      return handleConfirmBusiness(context);
    case ACTIONS.REJECT_BUSINESS:
      return handleRejectBusiness(context);
    case ACTIONS.EDIT_SEED:
      return handleEditSeed(context);
    case ACTIONS.EXPAND_GAP:
      return handleExpandGap(context);
    case ACTIONS.REQUEST_FULL_DRAFT:
      return handleRequestFullDraft(context);
    case ACTIONS.CLOSE_MIRROR:
      return handleCloseMirror(context);
    default:
      throw appError('INVALID_ACTION', 'Action không hợp lệ hoặc chưa được hỗ trợ.', { action: context.action });
  }
}

function handleOpenMirror(context) {
  const metadata = context.request.metadata || {};
  appendRow('mirror_sessions', {
    session_id: context.sessionId,
    created_at: nowIso(),
    updated_at: nowIso(),
    current_state: STATES.COLLECT_SEED,
    status: 'open',
    locale: metadata.locale || APP.localeDefault,
    page_url: metadata.page_url || '',
    referrer: metadata.referrer || '',
    utm_source: metadata.utm_source || '',
    utm_medium: metadata.utm_medium || '',
    utm_campaign: metadata.utm_campaign || '',
    user_agent_hash: hashString(metadata.user_agent || metadata.fingerprint || ''),
    last_error_code: ''
  });
  return envelope(context.sessionId, STATES.COLLECT_SEED, 'Em sẽ soi cách AI/khách có thể hiểu business của anh/chị. Nhập tên business hoặc dán link public để bắt đầu nhé.', [
    block('assistant_bubble', { text: 'Không cần mật khẩu, OTP hay thông tin ngân hàng. Mọi critical fact đều cần chủ business xác nhận trước khi public.' }),
    block('quick_reply_group', { replies: [{ id: 'submit_seed', label: 'Nhập business' }] }),
    block('trust_footer', trustFooterData())
  ], [{ id: 'submit_seed', label: 'Bắt đầu soi' }], 'await_seed');
}

function handleSubmitSeed(context) {
  const payload = context.request.payload || {};
  const seed = sanitizeText(payload.seed || payload.raw_input || '', APP.maxSeedChars);
  if (!seed) {
    return collectSeedError(context.sessionId, 'Em cần tên business, khu vực hoặc link public để soi thử.');
  }

  const classification = classifySeed(seed);
  appendRow('mirror_inputs', {
    input_id: Utilities.getUuid(),
    session_id: context.sessionId,
    created_at: nowIso(),
    input_type: classification.input_type,
    raw_input: seed,
    normalized_input: classification.normalized_input,
    source_guess: classification.source_guess
  });

  const modelRun = resolveBusinessCandidate(seed, context);
  const candidate = normalizeCandidate(modelRun.data, seed);
  persistCandidate(context.sessionId, candidate, false);

  if (candidate.match_status === 'insufficient') {
    return collectSeedError(context.sessionId, 'Em chưa nhận diện chắc đúng business. Anh/chị thêm khu vực hoặc dán link Maps/Facebook/website giúp em nhé.');
  }

  return envelope(context.sessionId, STATES.CONFIRM_BUSINESS, 'Em tìm thấy candidate gần nhất. Anh/chị xác nhận đúng business trước khi em chạy audit live nhé.', [
    block('business_candidate', {
      name: candidate.business_name,
      area_or_address: candidate.area_or_address,
      category_guess: candidate.category_guess,
      match_confidence: candidate.match_confidence,
      evidence_summary: candidate.evidence_summary,
      public_urls: candidate.public_urls,
      requires_owner_confirmation: true
    }),
    block('confidence_badge', {
      confidence: candidate.match_confidence,
      copy_vi: candidate.reason_vi || 'Confidence là độ chắc của dữ kiện public, không phải score chất lượng business.'
    }),
    block('trust_footer', trustFooterData())
  ], [
    { id: 'confirm', label: 'Đúng business này' },
    { id: 'reject', label: 'Không phải' },
    { id: 'edit', label: 'Tôi sửa lại' }
  ], 'await_business_confirmation');
}

function handleConfirmBusiness(context) {
  const payload = context.request.payload || {};
  const seed = sanitizeText(payload.seed || payload.business_name || '', APP.maxSeedChars);
  const candidate = normalizeCandidate(payload.candidate || payload.business_candidate || {}, seed);
  persistCandidate(context.sessionId, candidate, true);

  const modelRun = generateSemanticMirror(seed || candidate.business_name, candidate, context);
  const normalized = normalizeMirrorResult(modelRun.data, candidate, modelRun.grounding_count || 0);
  persistSemanticResult(context.sessionId, normalized, modelRun);

  return envelope(context.sessionId, STATES.SHOW_RESULT, 'Em đã dựng bản soi live. Các inference quan trọng vẫn cần chủ business xác nhận trước khi public.', buildResultBlocks(normalized), [
    { id: 'request_full_draft', label: 'Muốn dựng full draft' },
    { id: 'expand_gap', label: 'Xem gap cần bổ sung' },
    { id: 'close', label: 'Đóng' }
  ], 'await_result_action');
}

function handleRejectBusiness(context) {
  appendEvent(context.sessionId, 'business_rejected', STATES.COLLECT_SEED, context.request.payload || {});
  return collectSeedError(context.sessionId, 'Không sao. Anh/chị sửa lại tên, thêm khu vực hoặc dán link chính chủ để em nhận diện chính xác hơn.');
}

function handleEditSeed(context) {
  return envelope(context.sessionId, STATES.COLLECT_SEED, 'Anh/chị nhập lại tên business + khu vực hoặc dán link public nhé.', [
    block('assistant_bubble', { text: 'Nếu business trùng tên, link Google Maps/Facebook/website giúp giảm nhầm lẫn.' })
  ], [{ id: 'submit_seed', label: 'Gửi lại' }], 'await_seed');
}

function handleExpandGap(context) {
  appendEvent(context.sessionId, 'expand_gap_detail', STATES.SHOW_RESULT, context.request.payload || {});
  return envelope(context.sessionId, STATES.SHOW_RESULT, 'Các gap này là dữ liệu nên được chủ business xác nhận trước khi dựng full draft.', [
    block('priority_gap_list', context.request.payload && context.request.payload.gaps ? context.request.payload.gaps : defaultGapList()),
    block('trust_footer', trustFooterData())
  ], [{ id: 'request_full_draft', label: 'Dựng full draft' }], 'await_result_action');
}

function handleRequestFullDraft(context) {
  const payload = context.request.payload || {};
  appendRow('qualified_intents', {
    intent_id: Utilities.getUuid(),
    session_id: context.sessionId,
    created_at: nowIso(),
    business_name: sanitizeText(payload.business_name || '', 240),
    quick_score: payload.quick_score || '',
    evidence_confidence: payload.evidence_confidence || '',
    cta_source: payload.cta_source || 'mirror_result',
    status: 'qualified_m1_m2'
  });
  return envelope(context.sessionId, STATES.COLLECT_GAPS, 'Đã ghi nhận nhu cầu dựng full draft. Bước sau sẽ hỏi các gap cần bổ sung ngay trong landing page.', [
    block('assistant_bubble', { text: 'Mình vẫn không hỏi mật khẩu/OTP/ngân hàng qua chat. Critical facts sẽ cần owner duyệt.' }),
    block('trust_footer', trustFooterData())
  ], [{ id: 'close', label: 'Đóng' }], 'await_gap_collection');
}

function handleCloseMirror(context) {
  appendEvent(context.sessionId, 'mirror_closed', STATES.END, context.request.payload || {});
  return envelope(context.sessionId, STATES.END, 'Đã đóng phiên soi. Dữ liệu nháp được giữ để team review funnel.', [], [], 'closed');
}

function resolveBusinessCandidate(seed, context) {
  const prompt = systemPrompt() + '\n\nSeed khách nhập: ' + seed + '\n\nTask: resolve business candidate. Nếu mơ hồ/trùng tên/footprint mỏng, trả disambiguation hoặc insufficient. Không bịa phone/Zalo/giá/giờ mở cửa.';
  const result = runPrimaryStructured('resolve_candidate', prompt, RESOLVE_CANDIDATE_SCHEMA, context);
  if (result.ok && result.json_valid) {
    return { data: result.data, pipeline: 'primary', grounding_count: result.grounding_count };
  }
  const fallback = runFallbackStructured('resolve_candidate', prompt, RESOLVE_CANDIDATE_SCHEMA, context, result);
  return { data: fallback.data, pipeline: 'fallback', grounding_count: fallback.grounding_count };
}

function generateSemanticMirror(seed, candidate, context) {
  const prompt = systemPrompt() + '\n\nCandidate đã được owner xác nhận trong UI:\n' + JSON.stringify(candidate) + '\n\nSeed gốc: ' + seed + '\n\nTask: dựng semantic mirror cho MVP Slice 1: context clusters, public evidence, score snapshot, priority gaps, mini preview. Tách fact/inference/missing_signal rõ ràng. Không hứa ranking/doanh số.';
  const result = runPrimaryStructured('semantic_mirror', prompt, MIRROR_RESULT_SCHEMA, context);
  if (result.ok && result.json_valid) {
    return { data: result.data, pipeline: 'primary', grounding_count: result.grounding_count, model_name: result.model_name, usage: result.usage };
  }
  const fallback = runFallbackStructured('semantic_mirror', prompt, MIRROR_RESULT_SCHEMA, context, result);
  return { data: fallback.data, pipeline: 'fallback', grounding_count: fallback.grounding_count, model_name: fallback.model_name, usage: fallback.usage };
}

function runPrimaryStructured(taskName, prompt, schema, context) {
  const model = getScriptProperty('PRIMARY_MODEL') || APP.primaryModel;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }, { urlContext: {} }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 6000,
      responseMimeType: 'application/json',
      responseJsonSchema: schema
    }
  };
  return callGeminiStructured(taskName, 'primary_single_pass', model, body, schema, context, false);
}

function runFallbackStructured(taskName, prompt, schema, context, previousResult) {
  const model = getScriptProperty('FALLBACK_MODEL') || APP.fallbackModel;
  const discoveryBody = {
    contents: [{ parts: [{ text: prompt + '\n\nFallback pass 1: discovery only. Trả text ngắn về candidate/evidence/uncertainty/missing signals. Không cần JSON.' }] }],
    tools: [{ googleSearch: {} }, { urlContext: {} }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2400 }
  };
  const discovery = callGeminiText(taskName + '_discovery', 'fallback_discovery', model, discoveryBody, context, Boolean(previousResult));
  const notes = discovery.text || '';
  const normalizeBody = {
    contents: [{ parts: [{ text: systemPrompt() + '\n\nFallback pass 2 normalize. Không thêm dữ kiện ngoài discovery notes.\n\nDiscovery notes:\n' + notes.slice(0, 7000) }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 6000,
      responseMimeType: 'application/json',
      responseJsonSchema: schema
    }
  };
  const normalized = callGeminiStructured(taskName + '_normalize', 'fallback_normalize', model, normalizeBody, schema, context, true);
  normalized.grounding_count = Math.max(normalized.grounding_count || 0, discovery.grounding_count || 0);
  return normalized;
}

function callGeminiText(taskName, pipeline, model, body, context, fallbackUsed) {
  const started = Date.now();
  const response = fetchGemini(model, body);
  const text = getCandidateText(response);
  const result = {
    ok: true,
    text: text,
    model_name: model,
    usage: response.usageMetadata || {},
    grounding_count: getGroundingCount(response),
    latency_ms: Date.now() - started
  };
  logModelRun(context.sessionId, taskName, pipeline, model, result.latency_ms, true, false, fallbackUsed, '', result.usage, result.grounding_count);
  return result;
}

function callGeminiStructured(taskName, pipeline, model, body, schema, context, fallbackUsed) {
  const started = Date.now();
  try {
    const response = fetchGemini(model, body);
    const text = getCandidateText(response);
    const data = JSON.parse(text);
    const validation = validateStructuredPayload(data, schema);
    const result = {
      ok: validation.ok,
      json_valid: validation.ok,
      data: data,
      model_name: model,
      usage: response.usageMetadata || {},
      grounding_count: getGroundingCount(response),
      latency_ms: Date.now() - started,
      error_code: validation.ok ? '' : validation.code
    };
    logModelRun(context.sessionId, taskName, pipeline, model, result.latency_ms, result.ok, result.json_valid, fallbackUsed, result.error_code, result.usage, result.grounding_count);
    if (!validation.ok) {
      throw appError(validation.code, validation.message, validation.details);
    }
    return result;
  } catch (error) {
    const safe = toSafeError(error);
    logModelRun(context.sessionId, taskName, pipeline, model, Date.now() - started, false, false, fallbackUsed, safe.code, {}, 0);
    if (fallbackUsed) {
      throw appError('GEMINI_FALLBACK_FAILED', 'Gemini fallback không trả được JSON hợp lệ.', safe);
    }
    return { ok: false, json_valid: false, error_code: safe.code, message: safe.message };
  }
}

function fetchGemini(model, body) {
  const apiKey = getRequiredScriptProperty('GEMINI_API_KEY');
  const url = APP.apiBase + '/' + encodeURIComponent(model) + ':generateContent';
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    muteHttpExceptions: true,
    contentType: 'application/json',
    headers: { 'x-goog-api-key': apiKey },
    payload: JSON.stringify(body)
  });
  const code = response.getResponseCode();
  const text = response.getContentText();
  if (code < 200 || code >= 300) {
    throw appError('GEMINI_HTTP_' + code, 'Gemini API trả lỗi HTTP.', { body: text.slice(0, 1000) });
  }
  return JSON.parse(text);
}

function normalizeCandidate(candidate, seed) {
  const safe = candidate || {};
  const status = enumOrDefault(safe.match_status, ['resolved', 'disambiguation', 'insufficient'], seed ? 'disambiguation' : 'insufficient');
  const confidence = enumOrDefault(safe.match_confidence, ['low', 'medium', 'high'], status === 'resolved' ? 'medium' : 'low');
  const publicUrls = filterAllowedUrls(safe.public_urls || []);
  return {
    match_status: status,
    business_name: sanitizeText(safe.business_name || seed || 'Business chưa xác định', 240),
    area_or_address: sanitizeText(safe.area_or_address || '', 320),
    category_guess: sanitizeText(safe.category_guess || '', 160),
    match_confidence: publicUrls.length === 0 && confidence === 'high' ? 'medium' : confidence,
    evidence_summary: normalizeStringArray(safe.evidence_summary, 6, ['Cần owner xác nhận business đúng trước khi audit.']),
    public_urls: publicUrls,
    owner_confirmation_required: true,
    reason_vi: sanitizeText(safe.reason_vi || 'Candidate cần được xác nhận trước khi chạy audit.', 700)
  };
}

function normalizeMirrorResult(raw, confirmedCandidate, groundingCount) {
  const result = raw || {};
  const candidate = normalizeCandidate(result.business_candidate || confirmedCandidate || {}, confirmedCandidate.business_name || '');
  const clusters = normalizeClusters(result.semantic_context && result.semantic_context.clusters);
  const observations = normalizeObservations(result.public_evidence && result.public_evidence.observations, groundingCount);
  const score = normalizeScore(result.score_snapshot || {}, observations);
  const gaps = normalizeGaps(result.priority_gaps || []);
  const preview = normalizePreview(result.mini_preview || {}, candidate);
  return {
    business_candidate: candidate,
    semantic_context: { clusters: clusters },
    public_evidence: { observations: observations },
    score_snapshot: score,
    priority_gaps: gaps,
    mini_preview: preview
  };
}

function normalizeClusters(clusters) {
  const items = Array.isArray(clusters) ? clusters : [];
  return items.slice(0, 5).map(function (cluster, index) {
    return {
      id: sanitizeText(cluster.id || 'cluster_' + (index + 1), 80),
      label_vi: sanitizeText(cluster.label_vi || 'Nhóm nhu cầu cần kiểm tra', 160),
      why_relevant: sanitizeText(cluster.why_relevant || 'Đây là ngữ cảnh mô phỏng, không phải search volume.', 500),
      example_queries: normalizeStringArray(cluster.example_queries, 4, ['Khách có thể hỏi AI về business này như thế nào?']),
      relevance: enumOrDefault(cluster.relevance, ['low', 'medium', 'high'], 'medium'),
      relevance_reason: sanitizeText(cluster.relevance_reason || 'Cần owner xác nhận thêm dữ liệu.', 500),
      inference_notice: sanitizeText(cluster.inference_notice || 'Đây là ngữ cảnh mô phỏng, không phải cam kết ranking.', 500)
    };
  });
}

function normalizeObservations(observations, groundingCount) {
  const items = Array.isArray(observations) ? observations : [];
  const normalized = items.slice(0, 10).map(function (obs) {
    const signalKey = sanitizeText(obs.signal_key || 'unknown_signal', 80);
    let status = enumOrDefault(obs.status, FACT_STATUSES, 'inference_needs_confirmation');
    let requiresOwner = obs.requires_owner_confirmation !== false;
    if (CRITICAL_SIGNAL_KEYS.indexOf(signalKey) !== -1 && status === 'confirmed_fact') {
      status = 'inference_needs_confirmation';
      requiresOwner = true;
    }
    if (groundingCount === 0 && status === 'confirmed_fact') {
      status = 'public_observation';
      requiresOwner = true;
    }
    return {
      signal_key: signalKey,
      label_vi: sanitizeText(obs.label_vi || signalKey, 160),
      status: status,
      customer_copy: sanitizeText(obs.customer_copy || 'Tín hiệu này cần được kiểm tra thêm.', 700),
      evidence_urls: filterAllowedUrls(obs.evidence_urls || []),
      confidence: enumOrDefault(obs.confidence, ['low', 'medium', 'high'], groundingCount === 0 ? 'low' : 'medium'),
      requires_owner_confirmation: requiresOwner
    };
  });
  return normalized.length ? normalized : defaultObservations();
}

function normalizeScore(score, observations) {
  const factors = Array.isArray(score.factors) ? score.factors.slice(0, 8).map(function (factor) {
    const max = clampNumber(factor.max_score, 1, 100, 10);
    return {
      key: sanitizeText(factor.key || 'factor', 80),
      label_vi: sanitizeText(factor.label_vi || 'Yếu tố cần kiểm tra', 160),
      score: clampNumber(factor.score, 0, max, 0),
      max_score: max,
      reason_vi: sanitizeText(factor.reason_vi || 'Cần thêm dữ liệu để chấm chắc hơn.', 500)
    };
  }) : [];
  const anyLow = observations.some(function (obs) { return obs.confidence === 'low' || obs.status === 'missing_signal'; });
  return {
    total_score: clampNumber(score.total_score, 0, 100, 40),
    evidence_confidence: anyLow ? enumOrDefault(score.evidence_confidence, ['low', 'medium'], 'medium') : enumOrDefault(score.evidence_confidence, ['low', 'medium', 'high'], 'medium'),
    confidence_explanation_vi: sanitizeText(score.confidence_explanation_vi || 'Confidence dựa trên độ rõ của dấu vết public và owner confirmation.', 700),
    factors: factors.length ? factors : defaultScoreFactors(),
    disclaimer_vi: 'Đây là checklist nội bộ của AI Passport, không phải điểm chính thức của Google hoặc nền tảng AI.'
  };
}

function normalizeGaps(gaps) {
  const items = Array.isArray(gaps) ? gaps : [];
  const normalized = items.slice(0, 8).map(function (gap) {
    return {
      title_vi: sanitizeText(gap.title_vi || 'Gap cần bổ sung', 160),
      reason_vi: sanitizeText(gap.reason_vi || 'Thông tin này giúp khách và AI hiểu business rõ hơn.', 500),
      required_owner_input_vi: sanitizeText(gap.required_owner_input_vi || 'Chủ business xác nhận trước khi public.', 500),
      priority: enumOrDefault(gap.priority, ['low', 'medium', 'high'], 'medium')
    };
  });
  return normalized.length ? normalized : defaultGapList();
}

function normalizePreview(preview, candidate) {
  const strengths = Array.isArray(preview.strengths) ? preview.strengths.slice(0, 5).map(function (strength) {
    return {
      text_vi: sanitizeText(strength.text_vi || 'Có tín hiệu phù hợp một số nhu cầu khách.', 300),
      fact_class: enumOrDefault(strength.fact_class, FACT_STATUSES, 'inference_needs_confirmation')
    };
  }) : [];
  return {
    business_name: sanitizeText(preview.business_name || candidate.business_name, 240),
    tagline_vi: sanitizeText(preview.tagline_vi || 'Bản mô tả nháp cần chủ business xác nhận.', 300),
    summary_vi: sanitizeText(preview.summary_vi || 'Preview này chưa public và cần owner duyệt dữ liệu critical.', 700),
    strengths: strengths,
    recommended_ctas: normalizeStringArray(preview.recommended_ctas, 6, ['Gọi', 'Nhắn Zalo', 'Chỉ đường']),
    faq_drafts: normalizeStringArray(preview.faq_drafts, 6, ['Business có giờ mở cửa thế nào?', 'Khách nên liên hệ bằng kênh nào?']),
    watermark_vi: 'Bản nháp — cần chủ business xác nhận'
  };
}

function buildResultBlocks(result) {
  const candidate = result.business_candidate;
  const score = result.score_snapshot;
  return [
    block('business_candidate', {
      name: candidate.business_name,
      area_or_address: candidate.area_or_address,
      category_guess: candidate.category_guess,
      match_confidence: candidate.match_confidence,
      evidence_summary: candidate.evidence_summary,
      public_urls: candidate.public_urls,
      requires_owner_confirmation: true
    }),
    block('semantic_cluster_grid', result.semantic_context.clusters),
    block('example_query_carousel', result.semantic_context.clusters.reduce(function (queries, cluster) {
      return queries.concat(cluster.example_queries || []);
    }, []).slice(0, 8)),
    block('public_footprint_mirror', result.public_evidence.observations),
    block('score_ring', {
      total_score: score.total_score,
      evidence_confidence: score.evidence_confidence,
      disclaimer_vi: score.disclaimer_vi
    }),
    block('score_breakdown', score.factors),
    block('confidence_badge', {
      confidence: score.evidence_confidence,
      copy_vi: score.confidence_explanation_vi
    }),
    block('priority_gap_list', result.priority_gaps),
    block('before_after_preview', result.mini_preview),
    block('trust_footer', trustFooterData()),
    block('full_draft_cta', {
      label_vi: 'Dựng full draft cần owner xác nhận',
      copy_vi: 'Bước sau sẽ hỏi gap questions và dựng bản nháp đầy đủ trong landing page.'
    })
  ];
}

function persistCandidate(sessionId, candidate, ownerConfirmed) {
  appendRow('business_candidates', {
    candidate_id: Utilities.getUuid(),
    session_id: sessionId,
    created_at: nowIso(),
    business_name: candidate.business_name,
    area_or_address: candidate.area_or_address,
    category_guess: candidate.category_guess,
    match_confidence: candidate.match_confidence,
    public_urls_json: JSON.stringify(candidate.public_urls || []),
    evidence_summary_json: JSON.stringify(candidate.evidence_summary || []),
    owner_confirmed: ownerConfirmed ? 'yes' : 'no'
  });
}

function persistSemanticResult(sessionId, result, modelRun) {
  appendRow('semantic_contexts', {
    context_run_id: Utilities.getUuid(),
    session_id: sessionId,
    created_at: nowIso(),
    clusters_json: JSON.stringify(result.semantic_context.clusters),
    prompt_version: getPromptVersion(),
    model_name: modelRun.model_name || '',
    status: 'ok'
  });
  appendRow('mirror_results', {
    result_id: Utilities.getUuid(),
    session_id: sessionId,
    created_at: nowIso(),
    total_score: result.score_snapshot.total_score,
    evidence_confidence: result.score_snapshot.evidence_confidence,
    score_breakdown_json: JSON.stringify(result.score_snapshot.factors),
    public_observations_json: JSON.stringify(result.public_evidence.observations),
    priority_gaps_json: JSON.stringify(result.priority_gaps),
    mini_preview_json: JSON.stringify(result.mini_preview),
    raw_normalized_json: JSON.stringify(result),
    prompt_versions_json: JSON.stringify([getPromptVersion()]),
    model_names_json: JSON.stringify([modelRun.model_name || '']),
    status: 'ok'
  });
}

function classifySeed(seed) {
  const trimmed = sanitizeText(seed, APP.maxSeedChars);
  const hasUrl = /^https?:\/\//i.test(trimmed);
  return {
    input_type: hasUrl ? 'url' : 'name_area',
    normalized_input: trimmed.replace(/\s+/g, ' '),
    source_guess: hasUrl ? urlHost(trimmed) : 'manual_text'
  };
}

function parseRequest(e) {
  const raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
  if (raw.length > APP.maxPayloadChars) {
    throw appError('PAYLOAD_TOO_LARGE', 'Payload quá dài.', { length: raw.length });
  }
  const parsed = JSON.parse(raw || '{}');
  return {
    session_id: sanitizeText(parsed.session_id || '', 80),
    client_state: sanitizeText(parsed.client_state || '', 80),
    user_action: sanitizeText(parsed.user_action || '', 80),
    payload: parsed.payload || {},
    metadata: parsed.metadata || {}
  };
}

function buildContext(request, sessionId, startedAt) {
  return {
    request: request,
    sessionId: sessionId,
    action: request.user_action,
    startedAt: startedAt
  };
}

function envelope(sessionId, state, message, blocks, quickReplies, nextAction) {
  return {
    ok: true,
    session_id: sessionId,
    server_state: state,
    assistant_message: message,
    render_blocks: blocks || [],
    quick_replies: quickReplies || [],
    next_action: nextAction || ''
  };
}

function buildErrorEnvelope(sessionId, error) {
  return {
    ok: false,
    session_id: sessionId,
    server_state: STATES.COLLECT_SEED,
    assistant_message: error.customer_message || 'Hệ thống đang hơi nghẽn. Anh/chị thử lại sau ít phút nhé.',
    render_blocks: [block('error_recovery', {
      code: error.code,
      title_vi: 'Chưa thể soi tiếp',
      copy_vi: error.customer_message || 'Em chưa có đủ dữ liệu hoặc hệ thống đang bận. Anh/chị thử lại hoặc nhập thêm link public.'
    })],
    quick_replies: [{ id: 'edit_seed', label: 'Nhập lại' }],
    next_action: 'recover'
  };
}

function collectSeedError(sessionId, copy) {
  return envelope(sessionId, STATES.COLLECT_SEED, copy, [
    block('error_recovery', { title_vi: 'Cần thêm dữ liệu', copy_vi: copy }),
    block('trust_footer', trustFooterData())
  ], [{ id: 'edit_seed', label: 'Nhập lại' }], 'await_seed');
}

function block(type, data) {
  return { type: type, data: data || {} };
}

function trustFooterData() {
  return [
    'Không hỏi mật khẩu / OTP / thông tin ngân hàng.',
    'Không hứa lên top Google, tăng doanh số hoặc được AI chắc chắn nhắc tên.',
    'Critical facts cần chủ business xác nhận trước khi public.'
  ];
}

function defaultObservations() {
  return [
    { signal_key: 'identity_nap', label_vi: 'Tên/khu vực', status: 'inference_needs_confirmation', customer_copy: 'Cần xác nhận đúng business.', evidence_urls: [], confidence: 'low', requires_owner_confirmation: true },
    { signal_key: 'menu_text', label_vi: 'Menu dạng chữ', status: 'missing_signal', customer_copy: 'Chưa thấy menu/dịch vụ dạng chữ đủ rõ.', evidence_urls: [], confidence: 'low', requires_owner_confirmation: true },
    { signal_key: 'cta', label_vi: 'CTA liên hệ', status: 'missing_signal', customer_copy: 'Chưa thấy CTA thống nhất.', evidence_urls: [], confidence: 'low', requires_owner_confirmation: true },
    { signal_key: 'faq', label_vi: 'FAQ', status: 'missing_signal', customer_copy: 'Chưa thấy câu trả lời cho nhu cầu khách hay hỏi.', evidence_urls: [], confidence: 'low', requires_owner_confirmation: true }
  ];
}

function defaultScoreFactors() {
  return [
    { key: 'identity_nap', label_vi: 'Tên, địa chỉ và liên hệ', score: 6, max_score: 15, reason_vi: 'Cần xác nhận dữ liệu chính chủ.' },
    { key: 'readable_offer', label_vi: 'Menu/dịch vụ đọc được', score: 5, max_score: 25, reason_vi: 'Cần nội dung dạng chữ.' },
    { key: 'customer_questions', label_vi: 'FAQ theo nhu cầu thật', score: 4, max_score: 20, reason_vi: 'Cần owner bổ sung câu trả lời.' }
  ];
}

function defaultGapList() {
  return [
    { title_vi: 'Link chính chủ', reason_vi: 'Giảm nhầm business trùng tên.', required_owner_input_vi: 'Google Maps/Facebook/website đúng.', priority: 'high' },
    { title_vi: 'Menu/dịch vụ dạng chữ', reason_vi: 'Giúp khách và AI đọc được offer.', required_owner_input_vi: 'Danh sách món/dịch vụ chính.', priority: 'high' },
    { title_vi: 'CTA được phép public', reason_vi: 'Giúp khách biết cách liên hệ.', required_owner_input_vi: 'Gọi/Zalo/chỉ đường/đặt lịch.', priority: 'medium' }
  ];
}

function validateStructuredPayload(data, schema) {
  const missing = [];
  (schema.required || []).forEach(function (key) {
    if (data[key] === undefined || data[key] === null) missing.push(key);
  });
  if (missing.length) {
    return { ok: false, code: 'SCHEMA_MISSING_REQUIRED', message: 'JSON thiếu field bắt buộc.', details: { missing: missing } };
  }
  return { ok: true };
}

function ensureSheetsReady() {
  const spreadsheet = getSpreadsheet();
  Object.keys(SHEET_SCHEMAS).forEach(function (name) {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) sheet = spreadsheet.insertSheet(name);
    const headers = SHEET_SCHEMAS[name];
    const existing = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const needsHeader = existing.join('') === '' || existing.join('|') !== headers.join('|');
    if (needsHeader) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  });
}

function seedPromptConfig() {
  appendRow('prompt_configs', {
    prompt_version: getPromptVersion(),
    created_at: nowIso(),
    model_name: getScriptProperty('PRIMARY_MODEL') || APP.primaryModel,
    pipeline: 'primary_single_pass_with_fallback',
    prompt_json: JSON.stringify({ guardrails: systemPrompt() }),
    status: 'active'
  });
}

function appendRow(sheetName, rowObject) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  const headers = SHEET_SCHEMAS[sheetName];
  const row = headers.map(function (key) {
    const value = rowObject[key];
    return value === undefined || value === null ? '' : value;
  });
  sheet.appendRow(row);
}

function appendEvent(sessionId, eventName, state, payload) {
  appendRow('mirror_events', {
    event_id: Utilities.getUuid(),
    session_id: sessionId,
    created_at: nowIso(),
    event_name: eventName,
    state: state,
    payload_json: JSON.stringify(payload || {})
  });
}

function appendErrorSafe(sessionId, action, code, message, details) {
  try {
    appendRow('errors', {
      error_id: Utilities.getUuid(),
      session_id: sessionId,
      created_at: nowIso(),
      action: action,
      error_code: code,
      message: message,
      details_json: JSON.stringify(details || {})
    });
  } catch (ignored) {
    // If Sheets are unavailable, avoid masking the original customer-facing error response.
  }
}

function logModelRun(sessionId, taskName, pipeline, model, latencyMs, ok, jsonValid, fallbackUsed, errorCode, usage, groundingCount) {
  appendRow('model_run_logs', {
    run_id: Utilities.getUuid(),
    session_id: sessionId,
    created_at: nowIso(),
    task_name: taskName,
    pipeline: pipeline,
    model_name: model,
    latency_ms: latencyMs,
    ok: ok ? 'yes' : 'no',
    json_valid: jsonValid ? 'yes' : 'no',
    fallback_used: fallbackUsed ? 'yes' : 'no',
    error_code: errorCode || '',
    usage_json: JSON.stringify(usage || {}),
    grounding_count: groundingCount || 0
  });
}

function enforceRateLimit(sessionId, action) {
  const policy = {
    submit_seed: 3,
    confirm_business: 2,
    request_full_draft: 5
  };
  const max = policy[action];
  if (!max) return;
  const windowKey = new Date().toISOString().slice(0, 13);
  const sheet = getSpreadsheet().getSheetByName('rate_limit_counters');
  const values = sheet.getDataRange().getValues();
  let count = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i][1] === sessionId && values[i][3] === windowKey && values[i][4] === action) {
      count += Number(values[i][5] || 0);
    }
  }
  if (count >= max) {
    throw appError('RATE_LIMITED', 'Action vượt giới hạn trong phiên hiện tại.', { action: action, max: max });
  }
  appendRow('rate_limit_counters', {
    counter_id: Utilities.getUuid(),
    session_id: sessionId,
    created_at: nowIso(),
    window_key: windowKey,
    action: action,
    count: 1
  });
}

function getSpreadsheet() {
  const sheetId = getRequiredScriptProperty('MIRROR_SHEET_ID');
  return SpreadsheetApp.openById(sheetId);
}

function getRequiredScriptProperty(key) {
  const value = getScriptProperty(key);
  if (!value) throw appError('MISSING_PROPERTY', 'Thiếu Script Property bắt buộc.', { property: key });
  return value;
}

function getScriptProperty(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function getPromptVersion() {
  return getScriptProperty('PROMPT_VERSION') || APP.version;
}

function systemPrompt() {
  return [
    'Bạn là backend analyst cho AI Passport / Soi Gương AI.',
    'Đây là guided sales journey, không phải chatbot tự do.',
    'Không hứa tăng doanh số, không hứa lên top Google, không nói AI chắc chắn nhắc tên business.',
    'Không bịa phone, Zalo, giá, giờ mở cửa, menu item, parking, certification, media rights.',
    'Tách rõ confirmed_fact, public_observation, inference_needs_confirmation, missing_signal, conflict.',
    'Critical facts cần owner confirmation trước khi public.',
    'Score là checklist nội bộ AI Passport, không phải điểm chính thức của Google hoặc nền tảng AI.'
  ].join('\n');
}

function getCandidateText(response) {
  const candidates = response.candidates || [];
  const parts = candidates[0] && candidates[0].content && candidates[0].content.parts ? candidates[0].content.parts : [];
  return parts[0] && parts[0].text ? parts[0].text : '{}';
}

function getGroundingCount(response) {
  const metadata = response.candidates && response.candidates[0] ? response.candidates[0].groundingMetadata || {} : {};
  const chunks = metadata.groundingChunks || [];
  const supports = metadata.groundingSupports || [];
  return Math.max(chunks.length, supports.length);
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function sanitizeText(value, maxLength) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, maxLength || 1000);
}

function normalizeStringArray(value, maxItems, fallback) {
  const source = Array.isArray(value) ? value : [];
  const items = source.map(function (item) { return sanitizeText(item, 500); }).filter(Boolean).slice(0, maxItems);
  return items.length ? items : fallback;
}

function filterAllowedUrls(value) {
  const source = Array.isArray(value) ? value : [];
  return source.map(function (url) { return sanitizeText(url, 700); }).filter(function (url) {
    return /^https?:\/\//i.test(url);
  }).slice(0, 6);
}

function enumOrDefault(value, allowed, fallback) {
  return allowed.indexOf(value) === -1 ? fallback : value;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function urlHost(url) {
  const match = String(url || '').match(/^https?:\/\/([^/]+)/i);
  return match ? match[1] : '';
}

function hashString(value) {
  if (!value) return '';
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value);
  return digest.map(function (byte) {
    const v = (byte + 256) % 256;
    return ('0' + v.toString(16)).slice(-2);
  }).join('').slice(0, 32);
}

function nowIso() {
  return new Date().toISOString();
}

function appError(code, message, details) {
  const error = new Error(message);
  error.code = code;
  error.details = details || {};
  return error;
}

function toSafeError(error) {
  return {
    code: error && error.code ? error.code : 'INTERNAL_ERROR',
    message: error && error.message ? error.message : 'Unknown error',
    customer_message: customerMessageForError(error && error.code ? error.code : 'INTERNAL_ERROR'),
    details: error && error.details ? error.details : {}
  };
}

function customerMessageForError(code) {
  const messages = {
    INVALID_ACTION: 'Flow này chưa được hỗ trợ. Anh/chị thử lại từ bước nhập business nhé.',
    PAYLOAD_TOO_LARGE: 'Dữ liệu gửi lên quá dài. Anh/chị rút gọn tên/link business giúp em nhé.',
    RATE_LIMITED: 'Phiên này đã soi nhiều lần. Anh/chị thử lại sau ít phút nhé.',
    GEMINI_FALLBACK_FAILED: 'Kết quả vừa rồi chưa đủ rõ để hiển thị. Anh/chị thử lại hoặc thêm link chính chủ giúp em.',
    MISSING_PROPERTY: 'Backend chưa được cấu hình đủ để chạy live audit.'
  };
  return messages[code] || 'Hệ thống đang hơi nghẽn. Anh/chị thử lại sau ít phút nhé.';
}
