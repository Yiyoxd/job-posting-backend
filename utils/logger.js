/**
 * logger.js
 *
 * Provides a structured, timestamped logging facility for CLI scripts.
 * Offers consistent output formatting independent of script context.
 *
 * Features:
 *   - Clean HH:MM:SS timestamps.
 *   - Standardized severity levels.
 *   - Section headers for large script steps.
 */

export class Logger {
    constructor({ silent = false } = {}) {
        this.silent = silent;
    }

    /** HH:MM:SS timestamp */
    getTimestamp() {
        return new Date().toLocaleTimeString("en-US", {
            hour12: false,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    }

    /** Base logging method */
    log(level, message) {
        if (this.silent) return;
        console.log(`[${this.getTimestamp()}] [${level}] ${message}`);
    }

    info(msg) {
        this.log("INFO", msg);
    }

    success(msg) {
        this.log("SUCCESS", msg);
    }

    warn(msg) {
        this.log("WARN", msg);
    }

    error(msg) {
        this.log("ERROR", msg);
    }

    /**
     * SECTION HEADER
     * Used for clear separation between major phases of execution.
     *
     * Example:
     *   logger.section("Database Initialization")
     *
     * Output:
     *   ----- Database Initialization -----
     */
    section(title) {
        if (this.silent) return;
        const line = "-".repeat(title.length + 10);
        console.log(`\n${line}`);
        console.log(`     ${title}`);
        console.log(`${line}\n`);
    }
}

/* Default logger */
export const logger = new Logger();
