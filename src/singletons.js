import { State } from "@thepassle/app-tools/state.js";

export const files = new State({});
export const redirectMap = new Map();
export const pendingScriptChecks = new Set();

globalThis.allFiles = {};

globalThis.files = files;
globalThis.redirectMap = redirectMap;
globalThis.pendingScriptChecks = pendingScriptChecks;