import { imports } from "@thepassle/module-utils/imports.js";
import { exports } from "@thepassle/module-utils/exports.js";
import { sideEffects } from "@thepassle/module-utils/side-effects.js";
import { topLevelAwait } from "@thepassle/module-utils/top-level-await.js";
import { files } from "../singletons.js";

function getAllScriptTags() {
  const scriptGatheringCode = `
    (function() {
      function gatherScripts() {
        const scripts = document.querySelectorAll('script');
        const scriptData = [];
        
        scripts.forEach((script, index) => {
          const data = {
            index: index,
            type: script.type || 'text/javascript',
            isModule: script.type === 'module',
            src: script.src || null,
            hasInlineContent: !script.src && script.textContent.trim().length > 0,
            inlineContent: !script.src ? script.textContent : null,
            async: script.async,
            defer: script.defer,
            crossOrigin: script.crossOrigin,
            integrity: script.integrity,
            nonce: script.nonce,
            referrerPolicy: script.referrerPolicy,
            documentBaseURI: document.baseURI
          };
          scriptData.push(data);
        });
        
        return scriptData;
      }
      
      // Always gather scripts immediately
      return gatherScripts();
    })();
  `;

  chrome.devtools.inspectedWindow.eval(
    scriptGatheringCode,
    (result, isException) => {
      if (isException) {
        console.error("Error gathering scripts:", result);
        return;
      }

      result.forEach((scriptInfo) => {
        if (scriptInfo.src) {
          // Add to pending checks
          pendingScriptChecks.add(scriptInfo.src);

          const existingFile = files.getState()[scriptInfo.src];
          if (existingFile && existingFile.content) {
            // File already loaded with content
            files.setState((old) => ({
              ...old,
              [scriptInfo.src]: {
                ...existingFile,
                entrypoint: true,
                initiator: { type: "script-tag" },
                isModule: scriptInfo.isModule,
                scriptAttributes: {
                  async: scriptInfo.async,
                  defer: scriptInfo.defer,
                  type: scriptInfo.type,
                },
                sideEffects: sideEffects(existingFile.content, scriptInfo.src),
                tla: topLevelAwait(existingFile.content, scriptInfo.src),
                imports: imports(existingFile.content, scriptInfo.src),
                exports: exports(existingFile.content, scriptInfo.src),
              },
            }));
          } else {
            // Mark as entrypoint, content will come from network
            files.setState((old) => ({
              ...old,
              [scriptInfo.src]: {
                ...old[scriptInfo.src],
                entrypoint: true,
                url: scriptInfo.src,
                initiator: { type: "script-tag" },
                isModule: scriptInfo.isModule,
                isPending: true,
                scriptAttributes: {
                  async: scriptInfo.async,
                  defer: scriptInfo.defer,
                  type: scriptInfo.type,
                },
                timestamp: new Date().toISOString(),
              },
            }));
          }
        } else if (scriptInfo.hasInlineContent) {
          const inlineUrl = new URL(
            `inline-script-${scriptInfo.index}.js`,
            scriptInfo.documentBaseURI
          ).href;
          files.setState((old) => ({
            ...old,
            [inlineUrl]: {
              entrypoint: true,
              url: inlineUrl,
              content: scriptInfo.inlineContent,
              initiator: { type: "inline-script" },
              isModule: scriptInfo.isModule,
              isInline: true,
              sideEffects: sideEffects(scriptInfo.inlineContent, inlineUrl),
              tla: topLevelAwait(scriptInfo.inlineContent, inlineUrl),
              imports: imports(scriptInfo.inlineContent, inlineUrl),
              exports: exports(scriptInfo.inlineContent, inlineUrl),
              scriptAttributes: {
                type: scriptInfo.type,
                nonce: scriptInfo.nonce,
              },
              timestamp: new Date().toISOString(),
            },
          }));
        }
      });
    }
  );
}

function waitForDocumentReady(callback) {
  chrome.devtools.inspectedWindow.eval(
    "document.readyState",
    (readyState, isException) => {
      if (!isException && readyState === "complete") {
        callback();
      } else {
        setTimeout(() => waitForDocumentReady(callback), 100);
      }
    }
  );
}

chrome.devtools.network.onNavigated.addListener(() => {
  files.setState({});
  redirectMap.clear();

  waitForDocumentReady(() => {
    getAllScriptTags();
  });
});

getAllScriptTags();
