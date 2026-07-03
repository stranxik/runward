// Secondary port: the clock. Taking time out of the domain makes it
// deterministic and therefore testable (reproducible fixtures). Tests inject
// a frozen clock; production injects a system clock.

export interface ClockPort {
  nowIso(): string;
}
