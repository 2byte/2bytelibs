import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export class Logger {
  private logFile: string;
  private silentMode: boolean;
  private writeLogToFileEnabled: boolean;

  constructor(logFile: string, silentMode = false, writeLogToFileEnabled = true) {
    this.logFile = logFile;
    this.silentMode = silentMode;
    this.writeLogToFileEnabled = writeLogToFileEnabled;

    const logDir = dirname(logFile);
    const isCurrentDir = logDir === "." || logDir === "./" || logDir === "";

    if (!existsSync(logDir) && !isCurrentDir) {
      mkdirSync(logDir, { recursive: true });
    }
  }

  log(message: string, level: "INFO" | "ERROR" | "SUCCESS" | "WARN" = "INFO"): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;

    if (this.writeLogToFileEnabled) {
      try {
        appendFileSync(this.logFile, logMessage + "\n");
      } catch (error) {
        console.error("Failed to write to log file:", error);
      }
    }

    if (!this.silentMode) {
      const emoji = { INFO: "ℹ️", ERROR: "❌", SUCCESS: "✅", WARN: "⚠️" }[level] ?? "";
      console.log(`${emoji} ${message}`);
    }
  }

  info(message: string): void {
    this.log(message, "INFO");
  }

  error(message: string): void {
    this.log(message, "ERROR");
  }

  success(message: string): void {
    this.log(message, "SUCCESS");
  }

  warn(message: string): void {
    this.log(message, "WARN");
  }
}
