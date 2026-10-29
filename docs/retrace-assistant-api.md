# ReTRACE Assistant API (v1 draft)

Contract between the `/retrace/` page and the planning service that will run on
the group's servers. The page already speaks this contract. Until a service is
configured, it uses a mock client that replays recorded runs from
`assets/data/retrace-replay-v1.json`.

Client code: `assets/js/retrace/retrace-api.js` (`MockClient`, `HttpClient`).
UI code: `assets/js/retrace/retrace-assistant.js`.

## Switching the page to the live service

Set `retrace_api_base` in the front matter of `_pages/retrace.md`:

```yaml
retrace_api_base: "https://retrace.example.edu"
```

For testing without a deploy, append `?api=<base-url>` to the page URL. Only
`https://` bases, or `http://localhost` / `127.0.0.1`, are accepted.

With a base set, the client calls the endpoints below. If `/v1/health` fails,
the page shows an "unavailable" message. It does not silently fall back to the
replay.

## Endpoints

All bodies are JSON. Errors use one shape:

```json
{ "error": { "code": "invalid_smiles", "message": "Could not parse the target." } }
```

### `GET /v1/health`

```json
{
  "status": "ok",
  "version": "2026.11.0",
  "queue_depth": 2,
  "examples": [
    { "id": "aspirin", "label": "Aspirin", "target_smiles": "CC(=O)Oc1ccccc1C(=O)O" }
  ]
}
```

`examples` populates the example chips. It may be empty.

### `POST /v1/plans`

Request:

```json
{
  "target_smiles": "O=C(O)[C@H]1CCOC[C@H]1c1ccc(I)cc1",
  "preset": "standard",
  "max_routes": 10,
  "weights": { "feasibility": 0.7, "cost": 0.15, "greenness": 0.15 },
  "instructions": "avoid Mitsunobu conditions"
}
```

- `preset` is one of `fast`, `standard`, `thorough`.
- `weights` are normalized by the client to sum to 1. They change candidate
  comparison and ranking only, never the audit verdict.
- `instructions` is free text and may be empty.

Response `202`:

```json
{ "plan_id": "pln_01J…", "status": "queued", "mode": "live" }
```

Suggested error codes: `invalid_smiles`, `invalid_request`, `rate_limited`,
`queue_full`, `unauthorized`.

### `GET /v1/plans/{plan_id}/events`

A Server-Sent Events stream (`text/event-stream`). The client reads it with
`fetch`, so an `Authorization: Bearer …` header can be added later. Events:

| event       | data                                                                                   |
|-------------|----------------------------------------------------------------------------------------|
| `status`    | `{ "stage": "expanding", "message": "Querying single-step engines" }`                  |
| `route`     | one `Route` object (below), sent as soon as a route is saved and audited                |
| `done`      | `{ "plan_id", "routes_returned", "routes_passed", "first_passing_rank", "preset" }`     |
| `error`     | `{ "code", "message" }`                                                                |

`status.message` is shown verbatim in the progress log, so keep it short and
human-readable. Routes may arrive in any order; the page lists them by arrival.

### `DELETE /v1/plans/{plan_id}`

Cancels a running plan. Response: `{ "plan_id": "…", "status": "cancelled" }`.

## `Route` object

```json
{
  "rank": 1,
  "root_step": 4,
  "audit": {
    "passed": true,
    "verdict": "SUSPECT",
    "worst_defect": "CHEMOSELECTIVITY",
    "n_fatal_steps": 0,
    "n_suspect_steps": 2,
    "summary": "…",
    "stage2": { "triggered": false, "upheld": null, "reason": null }
  },
  "steps": [
    {
      "index": 1,
      "product": "COC(=O)C1CCOCC1=O",
      "precursors": ["COC(=O)OC", "O=C1CCCOC1"],
      "precursor_steps": [[], []],
      "audit": { "verdict": "VALID", "defect": "NONE", "reason": "…" }
    }
  ],
  "scores": { "total": 0.81, "feasibility": 0.84, "cost": 0.72, "greenness": 0.77 }
}
```

- `steps[k].precursor_steps[j]` lists the 0-based indices of steps that make
  precursor `j`; an empty list means a purchasable leaf.
- `root_step` is the 0-based index of the step that makes the target.
- `audit.passed` follows the paper: a route passes unless its final verdict is
  `FAKE`. Step verdicts are `VALID`, `SUSPECT`, `FAKE`.
- `scores` is the in-search route evaluator. It is optional; the recorded
  replay sets it to `null` because the frozen audit export does not carry it.

## Deployment notes

- CORS: allow origin `https://jxtse.github.io`, methods `GET, POST, DELETE`,
  headers `Content-Type, Authorization`.
- Rate-limit per client and cap queue length. A plan can take minutes.
- Model provider keys stay on the server. The page never sends credentials
  other than an optional user token.
