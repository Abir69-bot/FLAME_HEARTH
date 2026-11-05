# VESTA eval report

Generated 2026-11-05T17:59:09.796Z against http://localhost:3101 by scripts/run-evals.ts.

Checks per question: expected tool used · facts in the answer · sources · confidence tag (and expected value) · grounding · dashboard view. "unavailable" = the engine could not answer (limit or outage) and VESTA fell back; those questions are left out of that engine's score. Offline mode is scored only on the questions marked `offline: true`.

## Summary

| Engine | Passed | Scored | Score | Unavailable |
|---|---|---|---|---|
| offline | 13 | 13 | 100% | 0 |

## offline

| Question | Result | Details | ms |
|---|---|---|---|
| q30-correlation | pass | all checks (tools: analyze_data, chart_data) | 501 |
| q01-po2-rover | pass | all checks (tools: physics_calc) | 170 |
| q02-iss-reference | pass | all checks (tools: physics_calc) | 169 |
| q03-rover-envelope | pass | all checks (tools: physics_calc, envelope_check, nearest_tests) | 509 |
| q04-spacesuit-gap | pass | all checks (tools: physics_calc, envelope_check, nearest_tests) | 356 |
| q05-rank-moon-base | pass | all checks (tools: rank_investigations, make_chart, ui_action) | 294 |
| q06-compare-acme-spice | pass | all checks (tools: compare, make_chart, ui_action) | 140 |
| q07-gaps-solids | pass | all checks (tools: ui_action, gap_finder) | 434 |
| q08-explain-test | pass | all checks (tools: query_data, physics_calc, ui_action) | 217 |
| q09-cool-flame-topic | pass | all checks (tools: search_docs) | 697 |
| q13-safety-audit-rover | pass | all checks (tools: physics_calc, envelope_check, nearest_tests, safety_audit) | 1431 |
| q14-compare-coverage | pass | all checks (tools: compare, make_chart, ui_action) | 153 |
| q16-gaps-view | pass | all checks (tools: gap_finder, ui_action) | 402 |
