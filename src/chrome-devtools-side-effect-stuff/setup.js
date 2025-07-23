import { files } from "../singletons.js";

const port = chrome.runtime.connect({ name: "devtools-panel" });

port.postMessage({
  type: "init",
  tabId: chrome.devtools.inspectedWindow.tabId,
});

port.onMessage.addListener((message) => {
  if (message.type === "js-file") {
    files.setState((old) => ({
      ...old,
      [message.data.url]: {
        ...message.data,
      },
    }));
  }
});
