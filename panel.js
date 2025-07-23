import { LitElement, html, css } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { getFileName } from "./src/utils.js";
import "codemirror-elements";
import "codemirror-elements/lib/cm-lang-javascript.js";
import { debounceAtTimeout } from "@thepassle/app-tools/utils/async.js";
import { when } from "@thepassle/app-tools/utils.js";
import { files } from "./src/singletons.js";
import { getFileSizeClass } from "./src/utils.js";
import {
  findInitiatorPath,
  buildTreeData,
  buildModuleGraphs,
} from "./src/module-graph.js";
import "./src/chrome-devtools-side-effect-stuff/index.js";

class ModuleGraph extends LitElement {
  static styles = [
    css`
      .initiator-section {
        font-family: system-ui, -apple-system, sans-serif;
      }

      .initiator-container {
        max-height: 50vh;
        overflow: auto;
        padding: 10px;
        background: #f9f9f9;
        border-top: 1px solid #e0e0e0;
      }

      .initiator-path {
        margin-bottom: 8px;
      }

      .initiator-path-title {
        font-size: 11px;
        font-weight: 600;
        color: #666;
        margin-bottom: 4px;
      }

      .initiator-item {
        font-size: 12px;
        line-height: 1.4;
        margin-bottom: 2px;
        display: flex;
        align-items: center;
      }

      .initiator-indent {
        color: #6c757d;
        user-select: none;
        font-family: monospace;
      }

      .initiator-link {
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

      .initiator-link:hover {
        color: #004499;
        background-color: rgba(0, 102, 204, 0.1);
      }

      .initiator-link:focus {
        outline: 2px solid #0066cc;
        outline-offset: 1px;
      }

      .initiator-link.current {
        color: #28a745;
        font-weight: 600;
      }

      .entrypoint-badge {
        background: #e3f2fd;
        color: #1565c0;
        padding: 1px 4px;
        border-radius: 2px;
        font-size: 10px;
        margin-left: 4px;
      }
    `,
    css`
      .graph-section {
        font-family: system-ui, -apple-system, sans-serif;
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
      tla: false,
      sideEffects: false,
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
      this.filters.tla ||
      this.filters.sideEffects ||
      !this.filters.smallFiles ||
      !this.filters.mediumFiles ||
      !this.filters.largeFiles
    );
  }

  async connectedCallback() {
    super.connectedCallback();

    const immediateHandler = () => {
      const currentState = files.getState();
      if (Object.keys(currentState).length === 0) {
        this.graph = {};
        this.files = {};
        this.filteredFiles = [];
        this.selectedFile = {};
        this.requestUpdate();
      }
    };

    const debouncedHandler = debounceAtTimeout(() => {
      this.graph = buildModuleGraphs(files.getState());
      this.files = files.getState();
      this.updateFilteredFiles();
    }, 150);

    const handler = () => {
      const currentState = files.getState();
      if (Object.keys(currentState).length === 0) {
        immediateHandler();
      } else {
        debouncedHandler();
      }
    };

    this._stateChangeHandler = handler;
    files.addEventListener("state-changed", this._stateChangeHandler);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._stateChangeHandler) {
      files.removeEventListener("state-changed", this._stateChangeHandler);
    }
  }

  renderInitiatorView() {
    if (this.selectedFile.entrypoint) {
      return html``; // Don't show initiator view for entrypoints
    }

    const initiatorPaths = findInitiatorPath(
      this.selectedFile.url,
      this.graph,
      this.files
    );

    if (initiatorPaths.length === 0) {
      return html``;
    }

    return html`
      <div class="bar">
        <details>
          <summary>Initiator Chain(s)</summary>
          <div class="initiator-container">
            ${initiatorPaths.map(
              (path, pathIndex) => html`
                <div class="initiator-path">
                  ${path.length > 1
                    ? html`
                        <div class="initiator-path-title">
                          From ${getFileName(path[0].url)}:
                        </div>
                      `
                    : ""}
                  ${path.map((item, index) => {
                    const isLast = index === path.length - 1;

                    return html`
                      <div
                        class="initiator-item"
                        style="padding-left: ${index * 16}px;"
                      >
                        <button
                          class="initiator-link ${isLast ? "current" : ""}"
                          @click=${() => this.selectFile(item.fileObj)}
                          title="${item.url}"
                        >
                          ${item.fileName}
                        </button>
                        ${item.isEntrypoint
                          ? html`
                              <span class="entrypoint-badge">entrypoint</span>
                            `
                          : ""}
                      </div>
                    `;
                  })}
                </div>
              `
            )}
          </div>
        </details>
      </div>
    `;
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
    // Get all files from the module graphs instead of this.files
    let allFiles = [];

    // Iterate through each entrypoint's graph
    Object.entries(this.graph).forEach(([entrypointUrl, moduleGraph]) => {
      // Add all files from this module graph
      Object.entries(moduleGraph).forEach(([url, fileData]) => {
        allFiles.push([url, fileData]);
      });
    });

    // Remove duplicates (files that appear in multiple graphs)
    const uniqueFiles = new Map();
    allFiles.forEach(([url, fileData]) => {
      if (!uniqueFiles.has(url)) {
        uniqueFiles.set(url, fileData);
      }
    });

    allFiles = Array.from(uniqueFiles.entries());

    allFiles = allFiles.filter(([url, fileData]) => {
      if (this.filters.entrypointOnly && !fileData.entrypoint) {
        return false;
      }

      if (this.filters.barrelFiles && !fileData.barrelFile) {
        return false;
      }

      // Filter for top-level await
      if (this.filters.tla && !fileData.tla) {
        return false;
      }

      // Filter for side effects
      if (this.filters.sideEffects && !fileData.sideEffects) {
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
    // Count entrypoints from the graph
    const totalEntrypoints = Object.keys(this.graph).length;
    const totalFiles = Object.entries(this.files).length;
    const filteredCount = this.filteredFiles.length;
    const hasSearchQuery = this.searchQuery.trim().length > 0;

    // Remove the sorting that groups entrypoints together
    const sortedFiles = this.filteredFiles;

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
                  Entrypoint
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
                  Barrel file
                </label>
                <label for="tla">
                  <input
                    id="tla"
                    name="tla"
                    type="checkbox"
                    .checked=${this.filters.tla}
                    @change=${(e) =>
                      this.onFilterChange("tla", e.target.checked)}
                  />
                  Top level await
                </label>
                <label for="side-effects-only">
                  <input
                    id="side-effects-only"
                    name="side-effects-only"
                    type="checkbox"
                    .checked=${this.filters.sideEffects}
                    @change=${(e) =>
                      this.onFilterChange("sideEffects", e.target.checked)}
                  />
                  Side effects
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
                } loaded, ${totalEntrypoints} entrypoint${
                  totalEntrypoints !== 1 ? "s" : ""
                }`}
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
                    <span class="file-details">
                      ${fileData.entrypoint ? "Loaded from html" : ""}</span
                    >
                  </div>

                  <div class="file-initiator">
                    <span
                      class="initiator-type ${fileData.initiator.type ===
                        "script-tag" ||
                      fileData.initiator.type === "inline-script"
                        ? "parser"
                        : "script"}"
                    >
                      ${when(
                        fileData.initiator.type === "script-tag",
                        () => html` Script tag `
                      )}
                      ${when(
                        fileData.initiator.type === "inline-script",
                        () => html` Inline script `
                      )}
                      ${when(
                        fileData.initiator.type === "module",
                        () => html`
                          ${fileData.initiator.kind === "dynamic"
                            ? "Dynamic import"
                            : "Module"}
                        `
                      )}
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
                    ${fileData.sideEffects
                      ? html`<span class="initiator-type other"
                          >Side effects</span
                        >`
                      : ""}
                    ${fileData.tla
                      ? html`<span class="initiator-type other"
                          >Top level await</span
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
                ${this.renderInitiatorView()}
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
