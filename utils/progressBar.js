/**
 * ProgressBar.js
 *
 * Minimal, clean and professional CLI progress bar.
 * Features:
 *   - update(current)
 *   - finish()
 *   - timestamps and formatting kept minimal
 */

export class ProgressBar {
    /**
     * @param {number} total Total number of items to process.
     * @param {number} width Width of the visual bar (default: 30 chars)
     */
    constructor(total, width = 30) {
        this.total = total;
        this.width = width;
    }

    /**
     * Updates the bar to represent current progress.
     * Does not print new lines; stays in one console row.
     */
    update(current) {
        const percent = (current / this.total) * 100;
        const filled = Math.floor((percent / 100) * this.width);

        const bar =
            "█".repeat(filled) +
            "░".repeat(this.width - filled);

        const pct = percent.toFixed(1).padStart(5, " ");
        const text = `${bar} ${pct}% (${current}/${this.total})`;

        process.stdout.write(`\r${text}`);
    }

    /**
     * Renders a final completed bar and adds a newline.
     * Useful for printing after the last update().
     */
    finish() {
        this.update(this.total);
        process.stdout.write("\n");
    }
}
