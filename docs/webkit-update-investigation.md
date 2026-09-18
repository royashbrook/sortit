# native update investigation

Status: [#74](https://github.com/royashbrook/sortit/issues/74) remains open. The recovery deadline is shipped. The later Linux failure has a confirmed native network-process abort, but the allocation error and the original uninstrumented failure's cause are not established. This record is not a fix or permission to retry a red release gate automatically.

## what is retained

The reduced experiment runs the real update controller and generated service worker on a blank page. It downloads game assets into the cache but does not execute the game UI. A replacement asset returns HTTP 503. The assertion asks the old worker for its identity after the replacement fails.

In [run 35404052022](https://github.com/royashbrook/sortit/actions/runs/35404052022), trials 1-12 passed. Trial 13 lost the old worker's response after a native heap error and self-SIGABRT. A missing identity alone does not identify a native crash. The separate kernel signal and process evidence does that here.

- PR head: `9ef0900d2dd6b22a790cfa08f4c4730f3bedc018`.
- **Actual CI checkout:** `c0895709b6dd8a5468ebf5b2a6250e1aedcf3323`, the synthetic PR merge. Both have tree `8586e1885e25be864f0ed06f1025d9afccd56a82`, but commit-derived release metadata can differ. Use the actual checkout for replay.
- Runtime: Node 22, Playwright 1.62.1, WebKit revision 2336, Linux WPE port. The run installed `libsoup-3.0-0` version `3.4.4-5ubuntu0.8` on Ubuntu 24.04. The hosted image and system packages are not frozen by the npm lockfile.
- Fixture A: `8365e1b33d0c8edfeca562b2feaa5cfb25c6c54e96e90dabf9c3c79344135f67`.
- Fixture B: `36e6981eb432d314ac6b298bef86d55d93d7c1aebe6fad3271233f32ad58e339`.
- Source: [reduced runner](https://github.com/royashbrook/sortit/blob/c0895709b6dd8a5468ebf5b2a6250e1aedcf3323/tools/native-cache-repro.mjs), [process observer](https://github.com/royashbrook/sortit/blob/c0895709b6dd8a5468ebf5b2a6250e1aedcf3323/tools/native-process-observer.mjs), [executed workflow](https://github.com/royashbrook/sortit/blob/c0895709b6dd8a5468ebf5b2a6250e1aedcf3323/.github/workflows/paint-repro.yml).

[Selected raw lines](evidence/webkit-update-2026-09-18.txt) retain the decisive observations beyond CI artifact expiration. They are excerpts, not complete logs. Original full-file SHA-256 values:

| file | sha256 |
| --- | --- |
| native-browser.log | `23f04677d209b630d518ce5cc3454b0be9ce5e822fb211c9f9d50caf3a5569cc` |
| native-processes.jsonl | `20b9cfbfcf0f67e474ce483d18283b45d7cff866ed3e3e96fbfa0fad49fcef3e` |
| native-signals.log | `cd661f61455ba9aa42a0b2eb92915962b0720a5a5331287a2abc8da19f51f92e` |

## replay without touching a working checkout

Use a disposable Linux environment with Node 22, git, npm and strace. Installing Playwright's system dependencies requires that environment's package-install authority. Nothing below deploys the game. Run these commands in Bash, keeping the same shell for the variables.

```bash
sortit_repro_root=$(mktemp -d)
git clone https://github.com/royashbrook/sortit.git "$sortit_repro_root/source"
cd "$sortit_repro_root/source"
git fetch origin c0895709b6dd8a5468ebf5b2a6250e1aedcf3323
git switch --detach c0895709b6dd8a5468ebf5b2a6250e1aedcf3323
npm ci
npx playwright install --with-deps webkit
export SORTIT_PWA_WORK_ROOT="$sortit_repro_root"
node tools/verify-pwa.mjs --prepare-only
```

The preparation command prints both fingerprints and the manifest path. The builds are development fixtures, not release candidates. Keep that output with the run. If the fingerprints differ from the recorded pair, do not label the artifacts identical. The experiment still uses the same source shape, but it is a new artifact pair.

```bash
sortit_manifests=("$SORTIT_PWA_WORK_ROOT"/sortit-pwa-*/artifacts.json)
test "${#sortit_manifests[@]}" -eq 1
node tools/native-process-observer.mjs > "$sortit_repro_root/native-processes.jsonl" &
sortit_observer=$!
trap 'kill "$sortit_observer" 2>/dev/null || true' EXIT
DEBUG=pw:browser \
strace -f -qq -ttt -e trace=clone,clone3,exit_group,wait4,waitid -e signal=all \
  -o "$sortit_repro_root/native-signals.log" \
  node tools/native-cache-repro.mjs "${sortit_manifests[0]}" 50 controller shared \
  > "$sortit_repro_root/native-browser.log" 2>&1
sortit_result=$?
kill "$sortit_observer"
wait "$sortit_observer"
trap - EXIT
printf 'experiment exit: %s; evidence: %s\n' "$sortit_result" "$sortit_repro_root"
```

The runner asserts and exits on the first failure. `sortit_result` preserves that result through observer cleanup. This is an interactive diagnostic recipe, not a CI gate. The original workflow also has a ten-minute job limit. Do not remove that bound if reusing it in CI.

For a short macOS command check, omit the Linux observer/strace block and run `node tools/native-cache-repro.mjs <printed-manifest> 3 controller shared`. That checks the recipe, not the Linux crash. Instrumentation can change timing. Do not retain cores, process memory, environment dumps or browser profiles. This experiment uses synthetic fixtures, not player saves.

Recipe verification, 2026-09-18: a clean detached checkout of the actual CI merge, a fresh `npm ci` and Node 22.23.2 reproduced both recorded fixture fingerprints on macOS. All three short replay trials passed. Both Bash snippets passed `bash -n`, the three full-log hashes matched the retained files, and every selected raw line matched its original verbatim. The Linux tracing block was executed by the linked historical workflow, not rerun for this documentation check.

## controls and limits

| run | change | observed result |
| --- | --- | --- |
| [35403006750](https://github.com/royashbrook/sortit/actions/runs/35403006750) | minimal cache worker, fresh browser per trial | 50 passed |
| [35403626267](https://github.com/royashbrook/sortit/actions/runs/35403626267) | real worker without controller, fresh browser | 50 passed |
| [35403904584](https://github.com/royashbrook/sortit/actions/runs/35403904584) | real worker and controller, fresh browser | 50 passed |
| [35404052022](https://github.com/royashbrook/sortit/actions/runs/35404052022) | real worker and controller, reused browser | 12 passed, trial 13 failed with native abort |
| [35404372401](https://github.com/royashbrook/sortit/actions/runs/35404372401) | three reused-browser arms: minimal, real worker, real worker plus controller | each arm passed 50 |

Only 50 trials in the last row repeat the previously failing controller configuration. The positive-control arm also passed, so the comparison does not isolate a necessary layer. The fresh/shared runs also differ in context creation details and release identities. These counts do not establish a failure rate or prove browser reuse causes the crash.

The earlier full-suite [run 35402324103](https://github.com/royashbrook/sortit/actions/runs/35402324103) also captured a network-process self-abort. Neither capture retroactively proves the cause of the original, uninstrumented run in #74. This does not establish a Safari failure or rule one out. The application controller and worker remain in the reduced experiment.

## disposition

No automatic retry, timeout increase, assertion weakening, browser replacement or runtime workaround follows from this evidence. A native self-abort is not proof of an unrelated infrastructure failure. Preserve the first red result and review any same-artifact rerun separately.

Further closure needs a measured correction, such as an identified upstream fix or a failing control that isolates an application/fixture defect. Validate it against both the reduced experiment and the unchanged consent, offline, save-preservation and failed-install recovery tests. A passing replay alone does not close #74.
