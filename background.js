const connections = {};

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'devtools-panel') {
    port.onMessage.addListener((message) => {
      if (message.type === 'init') {
        connections[message.tabId] = port;
        
        port.onDisconnect.addListener(() => {
          delete connections[message.tabId];
        });
      }
    });
  }
});

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.url.match(/\.js(\?.*)?$/i) || 
        (details.responseHeaders && details.responseHeaders.some(h => 
          h.name.toLowerCase() === 'content-type' && 
          (h.value.includes('javascript') || h.value.includes('ecmascript'))
        ))) {
      
      const connection = connections[details.tabId];
      if (connection) {
        connection.postMessage({
          type: 'js-request-completed',
          data: {
            url: details.url,
            tabId: details.tabId,
            timestamp: new Date().toISOString()
          }
        });
      }
    }
  },
  { urls: ["<all_urls>"], types: ["script"] },
  ["responseHeaders"]
);