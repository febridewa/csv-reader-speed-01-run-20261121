# Fast csv-reader — Read broken CSV files faster

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/febridewa/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/febridewa/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0, built for the
[csv-reader-speed-01-run-20261121](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
bounty. `solve.js` answers exactly as csv-reader does on every case —
`{columns, rows, errors}` for each `{text, header}` input — including
every broken-row edge case: BOM, LF/CRLF, stray CRs, quoted fields with
doubled quotes and embedded line breaks, quote junk after a closing quote,
unterminated quotes, blank lines, and short/long rows.

## How it is faster

The reference walks the text one character at a time and builds each
field a character at a time. This entry instead cuts fields out of the
text with `indexOf`/`slice`, finds unquoted-field delimiters with a
single global regex scan, and takes a `split(',')` fast path for a whole
record line that holds no quote and no stray CR. No answer is sacrificed
for speed: the entry was checked against csv-reader on the full practice
set, on 60 freshly drawn generator sets, and on 20,000 adversarial fuzz
cases — identical on every one.

Measured locally on the practice set (Node 24, this machine): `run()`
takes ~144 ms vs the reference's ~496 ms, a **3.4× speedup**; end to end
through `main.ts` the entry takes ~754 ms vs the baseline's ~1,476 ms.

## How it runs

`main.ts` (Node 22+) reads every case from `/input/cases.json`,
answers each with `run()` from `solve.js`, and writes
`/output/answers.json`. Dependency-free, ES modules only, no network.

```sh
mkdir -p out && MAKEFUN_INPUT_DIR=kit/practice/input MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Referral

Built with make.fun — referral code `6etrfz79`.

## License

MIT — see [LICENSE](LICENSE).
