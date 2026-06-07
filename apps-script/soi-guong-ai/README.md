# Soi Gương AI — M2 Apps Script backend

This folder contains the M2 backend skeleton and Gemini integration for the in-page “Soi Gương AI” mirror flow.

## What is included

| File | Purpose |
| --- | --- |
| `Code.js` | Apps Script Web App entrypoint with `doPost(e)`, action router, Google Sheets logging, rate limits, Gemini primary/fallback pipelines, schema validation and render-block responses. |
| `appsscript.json` | Apps Script manifest with V8 runtime and required scopes for Sheets and external Gemini API calls. |

## Required Script Properties

Set these in **Project Settings → Script Properties** before deploying:

| Key | Required | Value |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes | Gemini API key. Never store this in frontend or Sheets. |
| `MIRROR_SHEET_ID` | Yes | Google Sheet ID used for session/event/model-run storage. |
| `PRIMARY_MODEL` | No | Defaults to `gemini-3-flash-preview`. |
| `FALLBACK_MODEL` | No | Defaults to `gemini-2.5-flash`. |
| `PROMPT_VERSION` | No | Defaults to `m2-router-v0.1`. |

## Setup steps

1. Create a Google Sheet for the M2 backend store.
2. Create an Apps Script project.
3. Copy `Code.js` and `appsscript.json` into the Apps Script project.
4. Set the required Script Properties above.
5. Run `setupMirrorSheets()` once from the Apps Script editor to create these tabs:
   - `mirror_sessions`
   - `mirror_events`
   - `mirror_inputs`
   - `business_candidates`
   - `semantic_contexts`
   - `mirror_results`
   - `qualified_intents`
   - `prompt_configs`
   - `model_run_logs`
   - `errors`
   - `rate_limit_counters`
6. Deploy as a Web App with execute-as deployer and access allowed for anonymous users.

## Request envelope

```json
{
  "session_id": null,
  "client_state": "COLLECT_SEED",
  "user_action": "submit_seed",
  "payload": {
    "seed": "Quán Đồng Quê Ven Kênh Nhà Bè"
  },
  "metadata": {
    "page_url": "https://aipass.io.vn/",
    "locale": "vi-VN",
    "timezone": "Asia/Ho_Chi_Minh"
  }
}
```

## Supported actions

| Action | Behavior |
| --- | --- |
| `open_mirror` | Creates/logs a mirror session and returns collect-seed render blocks. |
| `submit_seed` | Classifies and logs seed, resolves a business candidate through Gemini, returns confirmation card. |
| `confirm_business` | Runs live semantic mirror through primary/fallback Gemini pipeline and returns infographic blocks. |
| `reject_business` | Logs rejection and returns collect-seed recovery copy. |
| `edit_seed` | Returns collect-seed recovery copy. |
| `expand_gap` | Logs gap expansion and returns gap detail blocks. |
| `request_full_draft` | Logs qualified intent. |
| `close_mirror` | Logs close event and ends the session. |

## Gemini strategy

M2 follows the M0 decision:

```text
Primary: gemini-3-flash-preview single-pass + Google Search + URL Context + structured output
Fallback: gemini-2.5-flash two-pass discovery + structured normalization
```

Fallback is used when the primary call fails, returns invalid JSON, or fails the minimal top-level schema gate.

## Guardrails implemented

- API key only read from Apps Script Script Properties.
- Payload length limits and string sanitization before Sheets writes.
- Basic per-session/hour rate limits for `submit_seed`, `confirm_business`, and `request_full_draft`.
- Render blocks use allowlisted `type` values; model never returns HTML.
- Score is clamped to `0..100`; factor scores are capped by max score.
- Critical signals (`phone`, `zalo`, `price`, `opening_hours`, `parking`, `certification`, etc.) are never allowed to stay `confirmed_fact` without owner confirmation.
- Missing grounding downgrades confirmed observations to public observations that require owner confirmation.

## Frontend handoff

The current M1 frontend shell can be connected by replacing fixture state transitions with POST calls to the deployed Apps Script URL. The backend response envelope already returns:

```text
ok
session_id
server_state
assistant_message
render_blocks
quick_replies
next_action
```

Keep fixture mode as a local/demo fallback until M2 live testing passes all acceptance criteria.
