import { Import } from "@thepassle/module-utils/imports.js";
import { Export } from "@thepassle/module-utils/exports.js";

export interface FilesState {
  [filePath: string]: File
}

export interface File {
  url: string;
  content: string;
  status?: number;
  timestamp: string;
  initiator: {
    type: "script-tag" | "inline-script" | "other";
    kind?: "static" | "dynamic";
    url?: string;
  },
  redirectedFrom?: string;
  entrypoint?: boolean;
  isPending?: boolean;
  sideEffects: boolean;
  tla: boolean;
  size?: string;
  imports: Import[];
  exports: Export[];
  barrelFile: boolean;
  importedBy?: string[];
  importsFiles: string[];
  isModule: boolean;
  isInline: boolean;
  scriptAttributes: {
    async: boolean;
    defer: boolean;
    type: "module" | "script";
    nonce: boolean;
  },
  redirectTo?: string;
  finalContent?: string;
}