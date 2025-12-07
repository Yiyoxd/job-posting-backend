/**
 * prompt.js
 *
 * Provides a unified interface for CLI prompts (confirmation, free text).
 * Supports "--auto" mode which skips interaction and auto-confirms actions.
 *
 * Intended for scripts that require safe execution of destructive operations
 * such as database resets and bulk imports.
 */

import readline from "readline";

export class Prompt {
    constructor({ auto = false } = {}) {
        this.auto = auto;
    }

    /**
     * Asks a generic question and resolves with normalized lowercase text.
     * In auto mode, this returns "y" without prompting.
     */
    ask(question) {
        if (this.auto) return Promise.resolve("y");

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        return new Promise((resolve) => {
            rl.question(question, (answer) => {
                rl.close();
                resolve(answer.trim().toLowerCase());
            });
        });
    }

    /**
     * Asks a yes/no question and returns a boolean.
     * Equivalent to confirming destructive operations.
     */
    async confirm(question) {
        const ans = await this.ask(question);
        return ["y", "yes"].includes(ans);
    }
}

/**
 * Utility: builds a Prompt instance from a script's argv.
 * Example: const prompt = createPromptFromArgs(process.argv);
 */
export function createPromptFromArgs(argv) {
    return new Prompt({
        auto: argv.includes("--auto"),
    });
}
