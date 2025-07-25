import { barrelFile } from "@thepassle/module-utils/barrel-file.js";
import { imports } from "@thepassle/module-utils/imports.js";
import { exports } from "@thepassle/module-utils/exports.js";
import { sideEffects } from "@thepassle/module-utils/side-effects.js";
import { topLevelAwait } from "@thepassle/module-utils/top-level-await.js";

import { isJavaScriptFile } from "../utils.js";

chrome.devtools.network.onRequestFinished.addListener((request) => {
  const url = request.request.url;

  const contentType = request.response.headers.find(
    (h) => h.name.toLowerCase() === "content-type"
  );

  if (request.response.status >= 300 && request.response.status < 400) {
    const locationHeader = request.response.headers.find(
      (h) => h.name.toLowerCase() === "location"
    );
    if (
      locationHeader &&
      (isJavaScriptFile(url, contentType?.value) ||
        isJavaScriptFile(locationHeader.value, contentType?.value))
    ) {
      const redirectTo = new URL(locationHeader.value, url).href;
      redirectMap.set(url, redirectTo);
    }
  }

  if (isJavaScriptFile(url, contentType?.value)) {
    let redirectedFrom = null;
    for (const [from, to] of redirectMap.entries()) {
      if (to === url) {
        redirectedFrom = from;
        break;
      }
    }

    request.getContent((content) => {
      if (request._resourceType === "fetch") return;

      const url = request.request.url;

      const existingFile = files.getState()[url];
      const existingGlobalFile = allFiles[url];

      const isScriptTag = pendingScriptChecks.has(url);
      if (isScriptTag) {
        pendingScriptChecks.delete(url);
      }

      let initiatorUrl;
      let processedInitiator;
      if (
        !(
          existingFile?.initiator?.type === "inline-script" ||
          existingFile?.initiator?.type === "script-tag"
        )
      ) {
        const isDynamicallyImported = !request?._initiator?.url;
        initiatorUrl = isDynamicallyImported
          ? request?._initiator?.stack?.callFrames?.[0]?.url
          : request?._initiator?.url;
        processedInitiator = {
          kind: isDynamicallyImported ? "dynamic" : "static",
          url: initiatorUrl,
          type: "module",
        };
      }

      // Determine final initiator - static imports take precedence over dynamic
      const finalInitiator = processedInitiator ||
        existingFile?.initiator ||
        existingGlobalFile?.initiator || { type: "other" };

      // If existing file has dynamic initiator but current is static, overwrite
      if (
        existingGlobalFile?.initiator?.kind === "dynamic" &&
        processedInitiator?.kind === "static"
      ) {
        finalInitiator.kind = "static";
        finalInitiator.url = processedInitiator.url;
      }

      const fileData = {
        url: url,
        content: content || existingFile?.content,
        size: request.response?.content?.size ?? 0,
        status: request.response.status,
        timestamp: new Date().toISOString(),
        initiator: finalInitiator,
        redirectedFrom: redirectedFrom,
        entrypoint: existingFile?.entrypoint || isScriptTag || false,
        isPending: false,
        sideEffects: sideEffects(content || "", url),
        tla: topLevelAwait(content || "", url),
        imports: imports(content || "", url),
        exports: exports(content || "", url),
        barrelFile: barrelFile(content || "", url, {
          amountOfExportsToConsiderModuleAsBarrel: 5,
        }),
        ...(existingFile?.scriptAttributes && {
          scriptAttributes: existingFile.scriptAttributes,
        }),
        ...(existingFile?.isModule !== undefined && {
          isModule: existingFile.isModule,
        }),
        ...(existingFile?.isInline !== undefined && {
          isInline: existingFile.isInline,
        }),
        // Initialize or preserve import/export tracking arrays
        importedBy: existingGlobalFile?.importedBy || [],
        importsFiles: existingGlobalFile?.importsFiles || [],
      };

      if (redirectedFrom) {
        const originalFile = files.getState()[redirectedFrom];
        if (originalFile) {
          originalFile.redirectTo = url;
          originalFile.finalContent = content;
        }
      }

      if (initiatorUrl && initiatorUrl !== url) {
        if (!fileData.importedBy.includes(initiatorUrl)) {
          fileData.importedBy.push(initiatorUrl);
        }

        if (!allFiles[initiatorUrl]) {
          allFiles[initiatorUrl] = {
            ...fileData,
            importsFiles: [],
            importedBy: [],
          };
        }

        if (!allFiles[initiatorUrl].importsFiles.includes(url)) {
          allFiles[initiatorUrl].importsFiles.push(url);
        }
      }

      allFiles[url] = fileData;

      // Check if this file is imported by any inline scripts
      // by examining all inline script imports
      for (const [inlineUrl, inlineFile] of Object.entries(allFiles)) {
        if (inlineFile.isInline && inlineFile.imports) {
          // Check if any import from the inline script matches this file
          for (const imp of inlineFile.imports) {
            const resolvedImportUrl = new URL(imp.module, inlineUrl).href;
            if (resolvedImportUrl === url) {
              // This file is imported by the inline script
              if (!fileData.importedBy.includes(inlineUrl)) {
                fileData.importedBy.push(inlineUrl);
              }
              if (!allFiles[inlineUrl].importsFiles.includes(url)) {
                allFiles[inlineUrl].importsFiles.push(url);
              }
            }
          }
        }
      }

      // Update local state
      files.setState((old) => ({
        ...old,
        [url]: fileData,
      }));
    });
  }
});