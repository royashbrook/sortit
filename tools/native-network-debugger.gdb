set pagination off
set confirm off
set debuginfod enabled off
set print frame-arguments none
set print thread-events off
set follow-fork-mode parent
set detach-on-fork off
set schedule-multiple on
handle SIGPIPE nostop noprint pass
handle SIGUSR1 nostop noprint pass
handle SIGUSR2 nostop noprint pass
handle SIGCHLD nostop noprint pass
# WebKit uses these signals internally. This experiment targets the observed abort.
handle SIGSEGV nostop noprint pass
handle SIGBUS nostop noprint pass
# A normal helper exit is not the stop we are trying to capture.
define hook-stop
  if $_inferior != 1 && $_thread == 0
    inferior 1
    continue
  end
end
echo native-family-debugger-started\n
run
info inferiors
info proc exe
bt 32
