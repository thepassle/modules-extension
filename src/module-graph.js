import { getFileName } from "./utils.js";

export function findInitiatorPath(targetUrl, graph, files) {
  const paths = [];

  Object.entries(graph).forEach(([entrypointUrl, moduleGraph]) => {
    if (moduleGraph[targetUrl]) {
      const foundPaths = findAllPathsToTarget(
        entrypointUrl,
        targetUrl,
        moduleGraph,
        files
      );
      paths.push(...foundPaths);
    }
  });

  return paths;
}

function findAllPathsToTarget(startUrl, targetUrl, moduleGraph, files) {
  const allPaths = [];
  const seenPaths = new Set();

  function dfs(currentUrl, currentPath, visited) {
    if (visited.has(currentUrl)) {
      return;
    }

    const moduleData = moduleGraph[currentUrl];
    if (!moduleData) {
      return;
    }

    const newPath = [
      ...currentPath,
      {
        url: currentUrl,
        fileName: getFileName(currentUrl),
        isEntrypoint: moduleData.entrypoint,
        fileObj: files[currentUrl] || moduleData,
      },
    ];

    if (currentUrl === targetUrl) {
      const pathSignature = newPath.map((p) => p.url).join("|");

      if (!seenPaths.has(pathSignature)) {
        seenPaths.add(pathSignature);
        allPaths.push(newPath);
      }
      return;
    }

    if (moduleData.imports && moduleData.imports.length > 0) {
      const newVisited = new Set(visited);
      newVisited.add(currentUrl);

      moduleData.imports.forEach((importData) => {
        const resolvedUrl = importData.module;
        if (resolvedUrl && moduleGraph[resolvedUrl]) {
          dfs(resolvedUrl, newPath, newVisited);
        }
      });
    }
  }

  dfs(startUrl, [], new Set());

  return allPaths;
}

export function buildTreeData(graphEntry, graphs, files) {
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
export function buildModuleGraphs(modulesObj) {
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

      // Handle redirectedFrom - find modules that were redirected to this one
      for (const [url, mod] of Object.entries(modulesObj)) {
        if (mod.redirectedFrom === moduleUrl) {
          // This module (url) was redirected from moduleUrl
          // So moduleUrl should have url as a dependency
          graph[moduleUrl].dependencies.push({
            url: url,
            redirectedFrom: moduleUrl,
            isRedirect: true,
          });
          traverse(url);
        }
      }

      // Find all modules that have this module as their initiator
      for (const [url, mod] of Object.entries(modulesObj)) {
        if (mod.initiator && mod.initiator.url === moduleUrl) {
          // This module was initiated by moduleUrl
          graph[moduleUrl].dependencies.push({
            url: url,
            initiator: mod.initiator,
          });
          traverse(url);
        }
      }

      // Handle imports from inline scripts by resolving import paths
      if (module.imports && module.imports.length > 0) {
        for (const imp of module.imports) {
          // Resolve the import path relative to the module URL
          try {
            const resolvedUrl = new URL(imp.module, moduleUrl).href;
            
            // Check if this resolved URL exists in our modules
            if (modulesObj[resolvedUrl] && !graph[moduleUrl].dependencies.some(dep => dep.url === resolvedUrl)) {
              graph[moduleUrl].dependencies.push({
                url: resolvedUrl,
                importType: imp.kind || 'static',
                isInlineScriptImport: module.isInline || false
              });
              traverse(resolvedUrl);
            }
          } catch (e) {
            // If URL resolution fails, it might be a bare module specifier
            // In a real implementation, you might want to handle this differently
            console.warn(`Failed to resolve import ${imp.module} from ${moduleUrl}`, e);
          }
        }
      }

      // Also traverse importsFiles if they exist
      if (module.importsFiles && module.importsFiles.length > 0) {
        for (const importedUrl of module.importsFiles) {
          if (!graph[moduleUrl].dependencies.some(dep => dep.url === importedUrl)) {
            graph[moduleUrl].dependencies.push({
              url: importedUrl,
              fromImportsFiles: true
            });
            traverse(importedUrl);
          }
        }
      }
    }

    traverse(entrypoint);
    graphs[entrypoint] = graph;
  }

  return graphs;
}

