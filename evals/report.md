# VESTA eval report

**Incomplete.** Run on 2026-11-04 with scripts/run-evals.ts. Offline, Groq and Gemini ran against a local server. OpenRouter ran against the live site, because its key is only on Vercel. The free limits of the AI engines ran out, so most of their questions were not scored. These scores do not show whether the AI engines reach the 90% target. Run again after the limits reset.

Checks per question: expected tool used · facts in the answer · sources · confidence tag (and expected value) · grounding · dashboard view. "unavailable" = the engine could not answer (limit or outage); those questions are left out of that engine's score. Offline mode is scored only on the questions marked `offline: true`.

## Summary

| Engine | Passed | Scored | Score | Unavailable |
|---|---|---|---|---|
| offline | 12 | 12 | 100% | 0 |
| groq | 3 | 5 | 60% | 11 |
| gemini | 0 | 0 | n/a | 16 |
| openrouter | 0 | 0 | n/a | 16 |

## offline

| Question | Result | Details | ms |
|---|---|---|---|
| q01-po2-rover | pass | all checks (tools: physics_calc) | 1173 |
| q02-iss-reference | pass | all checks (tools: physics_calc) | 240 |
| q03-rover-envelope | pass | all checks (tools: physics_calc, envelope_check, nearest_tests) | 676 |
| q04-spacesuit-gap | pass | all checks (tools: physics_calc, envelope_check, nearest_tests) | 381 |
| q05-rank-moon-base | pass | all checks (tools: rank_investigations, make_chart, ui_action) | 297 |
| q06-compare-acme-spice | pass | all checks (tools: compare, make_chart, ui_action) | 129 |
| q07-gaps-solids | pass | all checks (tools: ui_action, gap_finder) | 462 |
| q08-explain-test | pass | all checks (tools: query_data, physics_calc, ui_action) | 266 |
| q09-cool-flame-topic | pass | all checks (tools: search_docs) | 1270 |
| q13-safety-audit-rover | pass | all checks (tools: physics_calc, envelope_check, nearest_tests, safety_audit) | 1570 |
| q14-compare-coverage | pass | all checks (tools: compare, make_chart, ui_action) | 166 |
| q16-gaps-view | pass | all checks (tools: gap_finder, ui_action) | 455 |

## groq

| Question | Result | Details | ms |
|---|---|---|---|
| q01-po2-rover | pass | all checks (tools: physics_calc) | 2929 |
| q02-iss-reference | pass | all checks (tools: physics_calc) | 1932 |
| q03-rover-envelope | FAIL | confidence (tools: envelope_check) | 2592 |
| q04-spacesuit-gap | pass | all checks (tools: envelope_check) | 2537 |
| q05-rank-moon-base | unavailable | VESTA could not answer right now. Please try again. | 186 |
| q06-compare-acme-spice | unavailable | VESTA could not answer right now. Please try again. | 241 |
| q07-gaps-solids | unavailable | VESTA could not answer right now. Please try again. | 153 |
| q08-explain-test | unavailable | VESTA could not answer right now. Please try again. | 179 |
| q09-cool-flame-topic | unavailable | VESTA could not answer right now. Please try again. | 177 |
| q10-cfi-oxygen-range | unavailable | VESTA could not answer right now. Please try again. | 195 |
| q11-spice-conditions | unavailable | VESTA could not answer right now. Please try again. | 181 |
| q12-outside-range | FAIL | tool, sources (tools: none) | 1851 |
| q13-safety-audit-rover | unavailable | VESTA could not answer right now. Please try again. | 151 |
| q14-compare-coverage | unavailable | VESTA could not answer right now. Please try again. | 417 |
| q15-cool-flame-detection | unavailable | VESTA could not answer right now. Please try again. | 383 |
| q16-gaps-view | unavailable | VESTA could not answer right now. Please try again. | 353 |

## gemini

| Question | Result | Details | ms |
|---|---|---|---|
| q01-po2-rover | unavailable | VESTA could not answer right now. Please try again. | 1811 |
| q02-iss-reference | unavailable | VESTA could not answer right now. Please try again. | 700 |
| q03-rover-envelope | unavailable | VESTA could not answer right now. Please try again. | 425 |
| q04-spacesuit-gap | unavailable | VESTA could not answer right now. Please try again. | 594 |
| q05-rank-moon-base | unavailable | VESTA could not answer right now. Please try again. | 699 |
| q06-compare-acme-spice | unavailable | VESTA could not answer right now. Please try again. | 687 |
| q07-gaps-solids | unavailable | VESTA could not answer right now. Please try again. | 662 |
| q08-explain-test | unavailable | VESTA could not answer right now. Please try again. | 707 |
| q09-cool-flame-topic | unavailable | VESTA could not answer right now. Please try again. | 496 |
| q10-cfi-oxygen-range | unavailable | VESTA could not answer right now. Please try again. | 523 |
| q11-spice-conditions | unavailable | VESTA could not answer right now. Please try again. | 560 |
| q12-outside-range | unavailable | VESTA could not answer right now. Please try again. | 517 |
| q13-safety-audit-rover | unavailable | VESTA could not answer right now. Please try again. | 457 |
| q14-compare-coverage | unavailable | VESTA could not answer right now. Please try again. | 489 |
| q15-cool-flame-detection | unavailable | VESTA could not answer right now. Please try again. | 455 |
| q16-gaps-view | unavailable | VESTA could not answer right now. Please try again. | 429 |

## openrouter

| Question | Result | Details | ms |
|---|---|---|---|
| q01-po2-rover | unavailable | fell back to groq | 1046 |
| q02-iss-reference | unavailable | fell back to offline | 415 |
| q03-rover-envelope | unavailable | fell back to offline | 442 |
| q04-spacesuit-gap | unavailable | fell back to offline | 571 |
| q05-rank-moon-base | unavailable | fell back to offline | 452 |
| q06-compare-acme-spice | unavailable | fell back to offline | 466 |
| q07-gaps-solids | unavailable | fell back to offline | 423 |
| q08-explain-test | unavailable | fell back to offline | 382 |
| q09-cool-flame-topic | unavailable | fell back to offline | 2238 |
| q10-cfi-oxygen-range | unavailable | fell back to offline | 588 |
| q11-spice-conditions | unavailable | fell back to offline | 1190 |
| q12-outside-range | unavailable | fell back to offline | 662 |
| q13-safety-audit-rover | unavailable | fell back to offline | 16809 |
| q14-compare-coverage | unavailable | fell back to offline | 3586 |
| q15-cool-flame-detection | unavailable | fell back to offline | 1114 |
| q16-gaps-view | unavailable | fell back to offline | 1109 |
