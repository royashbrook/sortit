#include <assert.h>
#include <signal.h>
#include <sys/wait.h>
#include <unistd.h>

int main(void) {
    pid_t child = fork();
    assert(child >= 0);
    if (child == 0) _exit(0);
    assert(waitpid(child, 0, 0) == child);
    raise(SIGABRT);
}
