#!/usr/bin/env bash
set -eu

# This prefix runs only inside the disposable synthetic Linux experiment.
case "$1" in
  */WPENetworkProcess|*/WebKitNetworkProcess) ;;
  *) printf 'unexpected debugger target: %s\n' "$1" >&2; exit 2 ;;
esac
ulimit -c 0
printf 'network debugger started: %s\n' "$$" > "$SORTIT_PWA_WORK_ROOT/network-gdb.$$.log"
exec gdb -nx --batch \
  -ex 'set pagination off' \
  -ex 'set confirm off' \
  -ex 'set debuginfod enabled off' \
  -ex 'set print frame-arguments none' \
  -ex 'set print thread-events off' \
  -ex 'handle SIGPIPE nostop noprint pass' \
  -ex 'handle SIGUSR1 nostop noprint pass' \
  -ex 'handle SIGUSR2 nostop noprint pass' \
  -ex run \
  -ex 'bt 32' \
  --args "$@" >> "$SORTIT_PWA_WORK_ROOT/network-gdb.$$.log" 2>&1
