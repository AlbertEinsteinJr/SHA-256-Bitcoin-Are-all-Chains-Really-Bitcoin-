import type { Logger } from "../../contracts/index";

export class ConsoleLogger implements Logger {
  constructor(private readonly bindings: Record<string, unknown> = {}) {}
  private emit(level: string, msg: string, meta?: Record<string, unknown>) {
    const rec = { level, msg, ...this.bindings, ...(meta ?? {}), t: new Date().toISOString() };
    // eslint-disable-next-line no-console
    console[level === "error" ? "error" : "log"](JSON.stringify(rec));
  }
  debug(m: string, meta?: Record<string, unknown>) {
    this.emit("debug", m, meta);
  }
  info(m: string, meta?: Record<string, unknown>) {
    this.emit("info", m, meta);
  }
  warn(m: string, meta?: Record<string, unknown>) {
    this.emit("warn", m, meta);
  }
  error(m: string, err?: unknown, meta?: Record<string, unknown>) {
    this.emit("error", m, { ...meta, err: err instanceof Error ? err.message : err });
  }
  child(bindings: Record<string, unknown>): Logger {
    return new ConsoleLogger({ ...this.bindings, ...bindings });
  }
}
