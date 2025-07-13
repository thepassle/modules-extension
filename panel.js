import { imports } from "@thepassle/module-utils/imports.js";
import { exports } from "@thepassle/module-utils/exports.js";
import { barrelFile } from "@thepassle/module-utils/barrel-file.js";
import { LitElement, html, css } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { State } from "@thepassle/app-tools/state.js";
import "codemirror-elements";
import "codemirror-elements/lib/cm-lang-javascript.js";
import { debounceAtTimeout } from "@thepassle/app-tools/utils/async.js";

const files = new State({});

function getFileSizeClass(sizeKB) {
  const size = parseFloat(sizeKB);

  if (size < 10) {
    return "file-size small";
  } else if (size <= 40) {
    return "file-size medium";
  } else {
    return "file-size large";
  }
}

class ModuleGraph extends LitElement {
  static styles = [
    css`
      .graph-section {
        font-family: "Consolas", "Monaco", "Courier New", monospace;
      }

      .graph-title {
        font-size: 14px;
        font-weight: 600;
        margin-bottom: 10px;
        color: #333;
        border-bottom: 1px solid #e0e0e0;
        padding-bottom: 5px;
      }

      .tree-container {
        padding: 10px;
        overflow-x: auto;
      }

      .tree-line {
        font-size: 12px;
        line-height: 1.4;
        white-space: nowrap;
      }

      .tree-indent {
        color: #6c757d;
        user-select: none;
      }

      .tree-link {
        background: none;
        border: none;
        color: #0066cc;
        text-decoration: underline;
        cursor: pointer;
        font-family: inherit;
        font-size: inherit;
        padding: 0;
        margin: 0;
      }

      .tree-link:hover {
        color: #004499;
        background-color: rgba(0, 102, 204, 0.1);
      }

      .tree-link:focus {
        outline: 2px solid #0066cc;
        outline-offset: 1px;
      }

      .tree-link.circular {
        color: #dc3545;
      }

      .circular-indicator {
        color: #dc3545;
        font-style: italic;
      }
    `,
    css`
      :host {
        margin: 0;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 12px;
      }

      #container {
        display: flex;
        height: 100vh;
      }

      #file-list {
        width: 250px;
        border-right: 1px solid #ddd;
        overflow-y: auto;
        background: #f5f5f5;
        display: flex;
        flex-direction: column;
      }

      #file-content {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: auto;
      }

      /* Search bar styles */
      #search-container {
        position: sticky;
        top: 0;
        background: #f5f5f5;
        border-bottom: 1px solid #ddd;
        z-index: 1;
      }

      #search-wrapper {
        position: relative;
        margin: 8px;
      }

      #search-input {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 8px 6px 28px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 12px;
        background: white;
        outline: none;
        transition: border-color 0.15s ease;
      }

      #search-input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 1px #3b82f6;
      }

      #search-input::placeholder {
        color: #9ca3af;
      }

      .search-icon {
        position: absolute;
        left: 6px;
        top: 50%;
        transform: translateY(-50%);
        width: 16px;
        height: 16px;
        fill: #6b7280;
        pointer-events: none;
      }

      .clear-search {
        position: absolute;
        right: 6px;
        top: 50%;
        transform: translateY(-50%);
        background: none;
        border: none;
        width: 16px;
        height: 16px;
        cursor: pointer;
        border-radius: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #6b7280;
        font-size: 14px;
        line-height: 1;
      }

      .clear-search:hover {
        background: #f3f4f6;
        color: #374151;
      }

      .search-results-info {
        padding: 4px 8px;
        font-size: 11px;
        color: #6b7280;
        background: #f9fafb;
        border-bottom: 1px solid #e5e7eb;
      }

      .file-item {
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #e0e0e0;
        word-break: break-word;
      }

      .file-item:hover {
        background: #e8e8e8;
      }

      .file-item.selected {
        background: #d0d0d0;
      }

      .file-item.hidden {
        display: none;
      }

      .file-name {
        display: flex;
        align-items: center;
        font-weight: 500;
        margin-bottom: 2px;
      }

      .file-name .name {
        flex: 1;
      }

      .file-name .highlight {
        background-color: #ffeb3b;
        color: #333;
        font-weight: 600;
      }

      .file-url {
        word-break: break-all;
        font-size: 11px;
        color: #666;
        margin-bottom: 2px;
      }

      .file-url .highlight {
        background-color: #ffeb3b;
        color: #333;
        font-weight: 600;
      }

      .medium {
        background: #e9ecef;
        color: #495057;
      }

      .filters {
        padding-top: 6px;
      }

      .filters label {
        display: flex;
        align-items: center;
      }

      .filter-header {
        font-weight: bold;
        margin-top: 8px;
      }

      /* Small files (< 10 KB) - Green */
      .file-size.small {
        background: #d4edda;
        color: #155724;
      }

      /* Medium files (10-40 KB) - Yellow/Orange */
      .file-size.medium {
        background: #fff3cd;
        color: #856404;
      }

      /* Large files (> 40 KB) - Red */
      .file-size.large {
        background: #f8d7da;
        color: #721c24;
      }

      .file-details,
      .file-initiator {
        font-size: 11px;
        color: #888;
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .initiator-type {
        margin-top: 6px;
        margin-bottom: 4px;
        background: #e0e0e0;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: 500;
        flex-shrink: 0;
      }

      .initiator-type.parser {
        background: #d4edda;
        color: #155724;
      }

      .initiator-type.script {
        background: #d1ecf1;
        color: #0c5460;
      }

      .initiator-type.other {
        background: #f8d7da;
        color: #721c24;
      }

      pre {
        margin: 0;
        white-space: pre-wrap;
        word-wrap: break-word;
      }

      .loading {
        color: #666;
        font-style: italic;
      }

      .error {
        color: #d73a49;
      }

      #status {
        padding: 10px;
        background: #f0f0f0;
        border-bottom: 1px solid #ddd;
      }

      cm-editor {
        height: 100%;
        border: none;
        background: white;
        display: block;
        overflow: hidden;
        border: none;
        display: block;
        background-color: #fff;
        flex: 1;
        border-bottom: 1px solid #ddd;
      }

      details {
        user-select: none;
      }

      .bar {
        padding: 10px;
        font-weight: 500;
        background: #f0f0f0;
        border-bottom: 1px solid #ddd;
      }

      #filename {
      }

      ul#files {
        margin: 0;
        padding: 0;
        list-style: none;
        flex: 1;
        overflow-y: auto;
      }

      .no-results {
        padding: 20px;
        text-align: center;
        color: #6b7280;
        font-style: italic;
      }

      .filter-icon {
        width: 16px;
        height: 16px;
        fill: currentColor;
      }

      #tab-bar {
        background: #f0f0f0;
        border-bottom: 1px solid #ddd;
      }

      #tab-bar button {
        border: none;
        padding: 4px 8px;
      }

      #tab-bar button:hover {
        background: #e8e8e8;
      }

      #tab-bar button.selected {
        background: #d0d0d0;
      }
    `,
  ];

  static properties = {
    graph: { type: Object },
    files: { type: Object },
    selectedFile: { type: Object },
    searchQuery: { type: String, state: true },
    filteredFiles: { type: Array, state: true },
    view: { type: String },
    filters: { type: Object, state: true },
  };

  constructor() {
    super();
    this.view = "source";
    this.files = {};
    this.graph = {};
    this.selectedFile = {};
    this.searchQuery = "";
    this.filteredFiles = [];

    this.filters = {
      entrypointOnly: false,
      barrelFiles: false,
      smallFiles: true,
      mediumFiles: true,
      largeFiles: true,
    };
  }

  onFilterChange(filterName, checked) {
    this.filters = {
      ...this.filters,
      [filterName]: checked,
    };
    this.updateFilteredFiles();
  }

  hasActiveFilters() {
    return (
      this.filters.entrypointOnly ||
      this.filters.barrelFiles ||
      !this.filters.smallFiles ||
      !this.filters.mediumFiles ||
      !this.filters.largeFiles
    );
  }

  async connectedCallback() {
    super.connectedCallback();
    const handler = () => {
      console.log("Entrypoints changed:", files.getState());
      this.graph = buildModuleGraphs(files.getState());
      console.log("Module Graph:", this.graph);
      printGraphs(this.graph);
      this.files = files.getState();
      this.updateFilteredFiles();
    };
    files.addEventListener("state-changed", debounceAtTimeout(handler, 150));
  }

  selectFile(file) {
    this.selectedFile = file;
  }

  scrollToSelectedFile() {
    if (!this.selectedFile.url) return;

    const selectedElement = this.shadowRoot.querySelector(
      ".file-item.selected"
    );

    if (selectedElement) {
      selectedElement.scrollIntoView({
        behavior: "instant",
        block: "center",
        inline: "nearest",
      });
    }
  }

  onSearchInput(e) {
    this.searchQuery = e.target.value;
    this.updateFilteredFiles();
  }

  clearSearch() {
    this.searchQuery = "";
    this.updateFilteredFiles();
    const searchInput = this.shadowRoot.querySelector("#search-input");
    if (searchInput) {
      searchInput.focus();
    }
  }

  updateFilteredFiles() {
    let allFiles = Object.entries(this.files);

    allFiles = allFiles.filter(([url, fileData]) => {
      if (this.filters.entrypointOnly && !fileData.entrypoint) {
        return false;
      }

      if (this.filters.barrelFiles && !fileData.barrelFile) {
        return false;
      }

      const kb = fileData.size ? (fileData.size / 1024).toFixed(2) : 0;
      const sizeClass = getFileSizeClass(kb);

      if (sizeClass === "file-size small" && !this.filters.smallFiles) {
        return false;
      }
      if (sizeClass === "file-size medium" && !this.filters.mediumFiles) {
        return false;
      }
      if (sizeClass === "file-size large" && !this.filters.largeFiles) {
        return false;
      }

      return true;
    });

    if (!this.searchQuery.trim()) {
      this.filteredFiles = allFiles;
      return;
    }

    const query = this.searchQuery.toLowerCase();
    this.filteredFiles = allFiles.filter(([url, fileData]) => {
      const fileName = url.toLowerCase();
      const fullUrl = url.toLowerCase();
      return fileName.includes(query) || fullUrl.includes(query);
    });
  }

  highlightText(text, query) {
    if (!query.trim()) return text;

    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi"
    );
    return text.replace(regex, '<span class="highlight">$1</span>');
  }

  foo(fileObj) {
    console.log("File clicked:", fileObj);
    this.selectFile(fileObj);
    this.updateComplete.then(() => {
      this.scrollToSelectedFile();
    });
  }

  renderDependencyTree() {
    const trees = buildTreeData(this.selectedFile.url, this.graph, this.files);

    return html`
      <div class="dependency-trees">
        ${trees.map(
          (tree) => html`
            <div class="graph-section">
              <div class="tree-container">
                ${tree.nodes.map(
                  (node) => html`
                    <div class="tree-line">
                      <span class="tree-indent">${node.indent}</span>
                      <button
                        class="tree-link ${node.isCircular ? "circular" : ""}"
                        @click=${() => this.foo(node.fileObj)}
                      >
                        ${node.fileName}
                      </button>
                      ${node.isCircular
                        ? html`<span class="circular-indicator">
                            (circular)</span
                          >`
                        : ""}
                    </div>
                  `
                )}
              </div>
            </div>
          `
        )}
      </div>
    `;
  }

  render() {
    const totalFiles = Object.entries(this.files).length;
    const filteredCount = this.filteredFiles.length;
    const hasSearchQuery = this.searchQuery.trim().length > 0;

    const sortedFiles = this.filteredFiles.sort(
      ([urlA, fileDataA], [urlB, fileDataB]) => {
        if (fileDataA.entrypoint && !fileDataB.entrypoint) return -1;
        if (fileDataB.entrypoint && !fileDataA.entrypoint) return 1;
        return 0;
      }
    );

    return html`
      <div id="container">
        <div id="file-list">
          <div id="search-container">
            <div id="search-wrapper">
              <svg
                class="search-icon filter-icon"
                xmlns="http://www.w3.org/2000/svg"
                height="24px"
                viewBox="0 -960 960 960"
                width="24px"
              >
                <path
                  d="M400-160v-280L118-800h724L560-440v280H400Zm80-308 198-252H282l198 252Zm0 0Z"
                />
              </svg>
              <input
                id="search-input"
                type="text"
                placeholder="Filter files"
                .value=${this.searchQuery}
                @input=${this.onSearchInput}
              />
              ${hasSearchQuery
                ? html`
                    <button
                      class="clear-search"
                      @click=${this.clearSearch}
                      title="Clear search"
                    >
                      ×
                    </button>
                  `
                : ""}
            </div>
            ${hasSearchQuery
              ? html`
                  <div class="search-results-info">
                    ${filteredCount} of ${totalFiles} files
                    ${filteredCount === 0 ? "(no matches)" : ""}
                  </div>
                `
              : ""}
          </div>

          <div id="status">
            <details>
              <summary>Filters</summary>
              <div class="filters">
                <label for="entrypoint-only">
                  <input
                    id="entrypoint-only"
                    name="entrypoint-only"
                    type="checkbox"
                    .checked=${this.filters.entrypointOnly}
                    @change=${(e) =>
                      this.onFilterChange("entrypointOnly", e.target.checked)}
                  />
                  Entrypoint only
                </label>
                <label for="barrel-files">
                  <input
                    id="barrel-files"
                    name="barrel-files"
                    type="checkbox"
                    .checked=${this.filters.barrelFiles}
                    @change=${(e) =>
                      this.onFilterChange("barrelFiles", e.target.checked)}
                  />
                  Barrel files
                </label>
                <div class="filter-header">File sizes</div>
                <label for="small-files">
                  <input
                    id="small-files"
                    name="small-files"
                    type="checkbox"
                    .checked=${this.filters.smallFiles}
                    @change=${(e) =>
                      this.onFilterChange("smallFiles", e.target.checked)}
                  />
                  Small files (&lt; 10 KB)
                </label>
                <label for="medium-files">
                  <input
                    id="medium-files"
                    name="medium-files"
                    type="checkbox"
                    .checked=${this.filters.mediumFiles}
                    @change=${(e) =>
                      this.onFilterChange("mediumFiles", e.target.checked)}
                  />
                  Medium files (10-40 KB)
                </label>
                <label for="large-files">
                  <input
                    id="large-files"
                    name="large-files"
                    type="checkbox"
                    .checked=${this.filters.largeFiles}
                    @change=${(e) =>
                      this.onFilterChange("largeFiles", e.target.checked)}
                  />
                  Large files (&gt; 40 KB)
                </label>
              </div>
            </details>
          </div>
          <div id="status">
            ${hasSearchQuery || this.hasActiveFilters()
              ? `${filteredCount} filtered file${
                  filteredCount !== 1 ? "s" : ""
                }`
              : `${totalFiles} JavaScript file${
                  totalFiles !== 1 ? "s" : ""
                } loaded`}
          </div>

          <ul id="files">
            ${sortedFiles.length === 0 &&
            (hasSearchQuery || this.hasActiveFilters())
              ? html`
                  <div class="no-results">No files match your filters</div>
                `
              : ""}
            ${sortedFiles.map(([url, fileData]) => {
              const fileName = getFileName(url);
              const highlightedFileName = hasSearchQuery
                ? this.highlightText(fileName, this.searchQuery)
                : fileName;
              const highlightedUrl = hasSearchQuery
                ? this.highlightText(url, this.searchQuery)
                : url;

              const kb = (fileData.size / 1024).toFixed(2);
              return html`
                <li
                  @click=${() => this.selectFile(fileData)}
                  class="${this.selectedFile.url === url
                    ? "selected"
                    : ""} file-item"
                >
                  <div class="file-name">
                    <span class="name"
                      >${unsafeHTML(highlightedFileName)}
                      ${fileData.entrypoint ? "[entrypoint]" : ""}</span
                    >
                  </div>
                  <div class="file-url">${unsafeHTML(highlightedUrl)}</div>
                  <div>
                    <span class="file-details"
                      >${getInitiatorInfo(fileData.initiator).details}</span
                    >
                  </div>

                  <div class="file-initiator">
                    <span
                      class="initiator-type ${getInitiatorInfo(
                        fileData.initiator
                      ).className}"
                    >
                      ${getInitiatorInfo(fileData.initiator).type}
                    </span>

                    ${fileData?.scriptAttributes?.async
                      ? html`<span class="initiator-type medium">Async</span>`
                      : ""}
                    ${fileData?.scriptAttributes?.defer
                      ? html`<span class="initiator-type medium">Defer</span>`
                      : ""}
                    ${fileData.barrelFile
                      ? html`<span class="initiator-type other"
                          >Barrel file</span
                        >`
                      : ""}
                    ${fileData?.size
                      ? html`
                          <span class="initiator-type ${getFileSizeClass(kb)}"
                            >${kb} kb</span
                          >
                        `
                      : ""}
                  </div>
                </li>
              `;
            })}
          </ul>
        </div>
        <div id="file-content">
          <div class="bar" id="filename">${this.selectedFile.url}</div>
          ${this.selectedFile.entrypoint
            ? html`
                <div id="tab-bar">
                  <button
                    class="${this.view === "source" ? "selected" : ""}"
                    @click=${() => (this.view = "source")}
                  >
                    Source
                  </button>
                  <button
                    class="${this.view === "tree" ? "selected" : ""}"
                    @click=${() => (this.view = "tree")}
                  >
                    Tree
                  </button>
                </div>
              `
            : ""}
          <div id=""></div>
          ${!this.selectedFile.entrypoint || this.view === "source"
            ? html`
                <cm-editor .value=${this.selectedFile.content} id="content">
                  <cm-lang-javascript></cm-lang-javascript>
                </cm-editor>
                <div class="bar" id="filename">
                  <details>
                    <summary>Imports</summary>
                    <div>Hello</div>
                  </details>
                </div>
                <div class="bar" id="filename">
                  <details>
                    <summary>Exports</summary>
                    <div>Hello</div>
                  </details>
                </div>
              `
            : ""}
          ${this.selectedFile.entrypoint && this.view === "tree"
            ? this.renderDependencyTree()
            : ""}
        </div>
      </div>
    `;
  }
}

customElements.define("module-graph", ModuleGraph);

function buildTreeData(graphEntry, graphs, files) {
  const trees = [];
  const entrypoint = graphEntry;
  const graph = graphs[entrypoint];
  const treeData = {
    entrypoint,
    nodes: [],
  };
  function buildTree(
    url,
    indent = "",
    visited = new Set(),
    isLast = true,
    isRoot = true
  ) {
    if (visited.has(url)) {
      treeData.nodes.push({
        url,
        fileName: url,
        fileObj: files[url] || {},
        indent,
        isCircular: true,
      });
      return;
    }
    visited.add(url);
    treeData.nodes.push({
      url,
      fileName: url,
      fileObj: files[url] || {},
      indent,
      isCircular: false,
    });
    const node = graph[url];
    if (node && node.dependencies && node.dependencies.length > 0) {
      for (let i = 0; i < node.dependencies.length; i++) {
        const dep = node.dependencies[i];
        const isLastDep = i === node.dependencies.length - 1;

        let newIndent;
        if (isRoot) {
          newIndent = isLastDep ? "└── " : "├── ";
        } else {
          // Remove the tree characters from the current indent to get the base
          const baseIndent = indent.substring(0, indent.length - 4);
          // Add the continuation line
          const continuation = isLast ? "    " : "│   ";
          // Add the new tree character
          const treeChar = isLastDep ? "└── " : "├── ";
          newIndent = baseIndent + continuation + treeChar;
        }

        buildTree(dep.url, newIndent, new Set(visited), isLastDep, false);
      }
    }
  }
  buildTree(entrypoint);
  trees.push(treeData);
  return trees;
}

// Updated console version with correct tree lines
function printGraphs(graphs) {
  for (const [entrypoint, graph] of Object.entries(graphs)) {
    console.log(`\n=== Module Graph for ${entrypoint} ===`);

    function printTree(
      url,
      indent = "",
      visited = new Set(),
      isLast = true,
      isRoot = true
    ) {
      if (visited.has(url)) {
        console.log(indent + url + " (circular)");
        return;
      }

      visited.add(url);
      console.log(indent + url);

      const node = graph[url];
      if (node && node.dependencies && node.dependencies.length > 0) {
        for (let i = 0; i < node.dependencies.length; i++) {
          const dep = node.dependencies[i];
          const isLastDep = i === node.dependencies.length - 1;

          let newIndent;
          if (isRoot) {
            newIndent = isLastDep ? "└── " : "├── ";
          } else {
            const baseIndent = isLast ? "    " : "│   ";
            newIndent = indent + baseIndent + (isLastDep ? "└── " : "├── ");
          }

          printTree(dep.url, newIndent, new Set(visited), isLastDep, false);
        }
      }
    }

    printTree(entrypoint);
  }
}


const jsFiles = new Map();
const redirectMap = new Map();

const port = chrome.runtime.connect({ name: "devtools-panel" });

port.postMessage({
  type: "init",
  tabId: chrome.devtools.inspectedWindow.tabId,
});

globalThis.files = files;

port.onMessage.addListener((message) => {
  if (message.type === "js-file") {
    files.setState((old) => ({
      ...old,
      [message.data.url]: {
        ...message.data,
      },
    }));
  } else if (message.type === "file-content") {
    // displayFileContent(message.data);
  } else if (message.type === "error") {
    // displayError(message.error);
  }
});
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
      
      if (document.readyState === 'loading') {
        return new Promise((resolve) => {
          document.addEventListener('DOMContentLoaded', () => {
            resolve(gatherScripts());
          });
        });
      } else {
        return gatherScripts();
      }
    })();
  `;

  // Execute in the inspected window context
  chrome.devtools.inspectedWindow.eval(
    scriptGatheringCode,
    (result, isException) => {
      if (isException) {
        console.error("Error gathering scripts:", result);
        return;
      }


      result.forEach((scriptInfo) => {
        if (scriptInfo.src) {

          const existingFile = files.getState()[scriptInfo.src];
          if (existingFile) {
            files.setState((old) => ({
              ...old,
              [scriptInfo.src]: {
                ...existingFile,
                entrypoint: true,
                initiator: { type: "parser", scriptTag: true },
                isModule: scriptInfo.isModule,
                scriptAttributes: {
                  async: scriptInfo.async,
                  defer: scriptInfo.defer,
                  type: scriptInfo.type,
                },
                imports: imports(existingFile.content, scriptInfo.src),
                exports: exports(existingFile.content, scriptInfo.src),
              },
            }));
          } else {
            files.setState((old) => ({
              ...old,
              [scriptInfo.src]: {
                entrypoint: true,
                url: scriptInfo.src,
                content: null,
                initiator: { type: "parser", scriptTag: true },
                isModule: scriptInfo.isModule,
                isPending: true,
                imports: [],
                exports: [],
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
              initiator: { type: "parser", inline: true },
              isModule: scriptInfo.isModule,
              isInline: true,
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

getAllScriptTags();

chrome.devtools.network.onRequestFinished.addListener((request) => {
  const url = request.request.url;
  const contentType = request.response.headers.find(
    (h) => h.name.toLowerCase() === "content-type"
  );

  if (request.response.status >= 300 && request.response.status < 400) {
    const locationHeader = request.response.headers.find(
      (h) => h.name.toLowerCase() === "location"
    );
    if (locationHeader && isJavaScriptFile(url, contentType?.value)) {
      const redirectTo = new URL(locationHeader.value, url).href;
      redirectMap.set(url, redirectTo);

      const originalFile = jsFiles.get(url);
      if (originalFile) {
        originalFile.redirectTo = redirectTo;
        originalFile.status = request.response.status;
      }
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


    request.getContent((content, encoding) => {

      const initiator = request.initiator ||
        request._initiator || { type: "other" };


      const existingFile = files.getState()[url];

      const fileData = {
        url: url,
        content: content,
        size: request.response?.content?.size ?? 0,
        status: request.response.status,
        timestamp: new Date().toISOString(),
        initiator: existingFile?.initiator || initiator, 
        redirectedFrom: redirectedFrom,
        entrypoint: existingFile?.entrypoint || false,
        isPending: false,
        imports: imports(content, url),
        exports: exports(content, url),
        barrelFile: barrelFile(content, url, {
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

        _request: request,
      };

      if (redirectedFrom) {
        const originalFile = jsFiles.get(redirectedFrom);
        if (originalFile) {
          originalFile.redirectTo = url;
          originalFile.finalContent = content;
        }
      }

      files.setState((old) => ({
        ...old,
        [url]: fileData,
      }));
    });
  }
});

globalThis.jsFiles = jsFiles;

function isJavaScriptFile(url, contentType) {
  const jsExtensions = [
    ".js", 
    ".mjs", 
    ".cjs", 
    ".jsx", 
    ".ts", 
    ".tsx", 
    ".vue", 
    ".svelte", 
  ];


  const urlWithoutQuery = url.split("?")[0].toLowerCase();
  if (jsExtensions.some((ext) => urlWithoutQuery.endsWith(ext))) {
    return true;
  }

  if (
    contentType &&
    (contentType.includes("javascript") ||
      contentType.includes("ecmascript") ||
      contentType.includes("typescript") ||
      contentType.includes("jsx") ||
      contentType.includes("tsx"))
  ) {
    return true;
  }

  if (
    !urlWithoutQuery.includes(".") &&
    contentType &&
    (contentType.includes("javascript") || contentType.includes("module"))
  ) {
    return true;
  }

  return false;
}

function getFileName(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const fileName = pathname.split("/").pop() || "index.js";
    return fileName;
  } catch (e) {
    return url.split("/").pop() || "unknown.js";
  }
}

function getInitiatorInfo(initiator) {
  if (!initiator) {
    return { type: "unknown", details: "", className: "other" };
  }

  if (initiator.type === "parser" && initiator.scriptTag) {
    return {
      type: "HTML",
      details: "Loaded by HTML <script> tag",
      className: "parser",
    };
  }

  if (initiator.type === "parser" && initiator.inline) {
    return {
      type: "Inline",
      details: "Inline script in HTML",
      className: "parser",
    };
  }

  switch (initiator.type) {
    case "parser":
      return {
        type: "HTML",
        details: "Loaded by HTML",
        className: "parser",
      };

    case "script":
      if (initiator.url) {
        const initiatorFile = getFileName(initiator.url);
        const line = initiator.lineNumber ? `:${initiator.lineNumber}` : "";
        return {
          type: "Script",
          details: `Loaded by ${initiatorFile}${line}`,
          className: "script",
        };
      }
      return {
        type: "Script",
        details: "Dynamic import",
        className: "script",
      };

    case "other":
      return {
        type: "Other",
        details: "Browser or extension",
        className: "other",
      };

    default:
      return {
        type: initiator.type,
        details: "",
        className: "other",
      };
  }
}

chrome.devtools.network.onNavigated.addListener(() => {
  files.setState({});
  redirectMap.clear();

  chrome.devtools.inspectedWindow.eval(
    `
    (function() {
      return new Promise((resolve) => {
        if (document.readyState === 'complete') {
          // Page already loaded, wait a bit more for dynamic scripts
          setTimeout(resolve, 500);
        } else {
          // Wait for load event
          window.addEventListener('load', () => {
            setTimeout(resolve, 500);
          }, { once: true });
        }
      });
    })();
    `,
    (result, isException) => {
      if (!isException) {
        getAllScriptTags();
      }
    }
  );
});

function buildModuleGraphs(modulesObj) {
  const entrypoints = [];
  for (const url in modulesObj) {
    const module = modulesObj[url];
    if (module && module.entrypoint) {
      entrypoints.push(url);
    }
  }

  const graphs = {};

  for (const entrypoint of entrypoints) {
    const graph = {};
    const visited = new Set();

    function traverse(moduleUrl) {
      if (visited.has(moduleUrl)) return;
      visited.add(moduleUrl);

      const module = modulesObj[moduleUrl];
      if (!module) return;

      graph[moduleUrl] = {
        ...module,
        dependencies: [],
      };

      if (module.imports && module.imports.length > 0) {
        const dependencyMap = {};

        for (const imp of module.imports) {
          const depUrl = imp.module;
          if (!dependencyMap[depUrl]) {
            dependencyMap[depUrl] = [];
          }
          dependencyMap[depUrl].push(imp);
        }

        for (const depUrl in dependencyMap) {
          graph[moduleUrl].dependencies.push({
            url: depUrl,
            importInfo: dependencyMap[depUrl],
          });

          traverse(depUrl);
        }
      }
    }

    traverse(entrypoint);
    graphs[entrypoint] = graph;
  }

  return graphs;
}

function getGraph(entrypoint) {
  return graphs[entrypoint];
}

function getAllDependencies(graph, moduleUrl, visited = new Set()) {
  if (visited.has(moduleUrl)) return [];
  visited.add(moduleUrl);

  const module = graph[moduleUrl];
  if (!module || !module.dependencies) return [];

  const deps = [];
  for (const dep of module.dependencies) {
    deps.push(dep.url);
    deps.push(...getAllDependencies(graph, dep.url, visited));
  }

  return [...new Set(deps)];
}

function findImporters(modulesMap, targetUrl) {
  const importers = [];
  for (const [url, module] of modulesMap) {
    if (module.imports) {
      const importInfos = module.imports.filter(
        (imp) => imp.module === targetUrl
      );
      if (importInfos.length > 0) {
        importers.push({
          url,
          importInfo: importInfos,
        });
      }
    }
  }
  return importers;
}
