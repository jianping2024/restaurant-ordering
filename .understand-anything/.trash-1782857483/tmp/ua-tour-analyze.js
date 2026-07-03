#!/usr/bin/env node
'use strict';

const fs = require('fs');

const ENTRY_FILENAMES = new Set([
  'index.ts', 'index.js', 'main.ts', 'main.js', 'app.ts', 'app.js',
  'server.ts', 'server.js', 'mod.rs', 'main.go', 'main.py', 'main.rs',
  'manage.py', 'app.py', 'wsgi.py', 'asgi.py', 'run.py', '__main__.py',
  'Application.java', 'Main.java', 'Program.cs', 'config.ru', 'index.php',
  'App.swift', 'Application.kt', 'main.cpp', 'main.c', 'layout.tsx',
]);

function fatal(msg) {
  process.stderr.write(String(msg) + '\n');
  process.exit(1);
}

function isCodeFile(node) {
  return node.type === 'file' || node.type === 'function' || node.type === 'class';
}

function getFilePath(node) {
  return node.filePath || node.name || '';
}

function depthFromRoot(filePath) {
  if (!filePath) return 99;
  const parts = filePath.split('/').filter(Boolean);
  return parts.length <= 2 ? 1 : parts.length > 4 ? 3 : 2;
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  const bfsOverride = process.argv[4] || process.env.BFS_START_NODE || '';

  if (!inputPath || !outputPath) {
    fatal('Usage: node ua-tour-analyze.js <input.json> <output.json> [bfsStartNodeId]');
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch (e) {
    fatal('Failed to read input: ' + e.message);
  }

  const nodes = data.nodes || [];
  const edges = data.edges || [];
  const layers = data.layers || [];

  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const fanIn = new Map();
  const fanOut = new Map();
  for (const n of nodes) {
    fanIn.set(n.id, 0);
    fanOut.set(n.id, 0);
  }
  for (const e of edges) {
    if (nodeById.has(e.target)) fanIn.set(e.target, (fanIn.get(e.target) || 0) + 1);
    if (nodeById.has(e.source)) fanOut.set(e.source, (fanOut.get(e.source) || 0) + 1);
  }

  const fanInRanking = [...fanIn.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([id, count]) => ({
      id,
      fanIn: count,
      name: nodeById.get(id)?.name || id,
    }));

  const fanOutRanking = [...fanOut.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([id, count]) => ({
      id,
      fanOut: count,
      name: nodeById.get(id)?.name || id,
    }));

  const fanOutValues = [...fanOut.values()].sort((a, b) => a - b);
  const fanInValues = [...fanIn.values()].sort((a, b) => a - b);
  const top10FanOutThreshold =
    fanOutValues[Math.floor(fanOutValues.length * 0.9)] ?? 0;
  const bottom25FanInThreshold =
    fanInValues[Math.floor(fanInValues.length * 0.25)] ?? 0;

  const entryScores = [];

  for (const node of nodes) {
    let score = 0;
    const fp = getFilePath(node);

    if (node.type === 'document') {
      if (node.name === 'README.md' && !fp.includes('/')) score += 5;
      else if (node.name?.endsWith('.md') && !fp.includes('/')) score += 2;
      if (score > 0) {
        entryScores.push({
          id: node.id,
          score,
          name: node.name,
          summary: node.summary || '',
        });
      }
      continue;
    }

    if (node.type !== 'file') continue;

    if (ENTRY_FILENAMES.has(node.name)) score += 3;
    if (depthFromRoot(fp) <= 2) score += 1;
    if ((fanOut.get(node.id) || 0) >= top10FanOutThreshold) score += 1;
    if ((fanIn.get(node.id) || 0) <= bottom25FanInThreshold) score += 1;

    if (score > 0) {
      entryScores.push({
        id: node.id,
        score,
        name: node.name,
        summary: node.summary || '',
      });
    }
  }

  entryScores.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  const entryPointCandidates = entryScores.slice(0, 5);

  const bfsEdgeTypes = new Set(['imports', 'calls']);
  const adjacency = new Map();
  for (const n of nodes) adjacency.set(n.id, []);
  for (const e of edges) {
    if (bfsEdgeTypes.has(e.type) && nodeById.has(e.source) && nodeById.has(e.target)) {
      adjacency.get(e.source).push(e.target);
    }
  }

  let startNode = bfsOverride;
  if (!startNode || !nodeById.has(startNode)) {
    startNode = entryPointCandidates.find((c) => {
      const n = nodeById.get(c.id);
      return n && n.type === 'file';
    })?.id;
  }
  if (!startNode) startNode = nodes.find((n) => n.type === 'file')?.id;

  const order = [];
  const depthMap = {};
  const byDepth = {};
  const visited = new Set();

  if (startNode) {
    const queue = [{ id: startNode, depth: 0 }];
    visited.add(startNode);
    depthMap[startNode] = 0;
    if (!byDepth['0']) byDepth['0'] = [];
    byDepth['0'].push(startNode);

    while (queue.length > 0) {
      const { id, depth } = queue.shift();
      order.push(id);
      for (const next of adjacency.get(id) || []) {
        if (visited.has(next)) continue;
        visited.add(next);
        const d = depth + 1;
        depthMap[next] = d;
        const key = String(d);
        if (!byDepth[key]) byDepth[key] = [];
        byDepth[key].push(next);
        queue.push({ id: next, depth: d });
      }
    }
  }

  const nonCodeFiles = {
    documentation: [],
    infrastructure: [],
    data: [],
    config: [],
  };

  for (const node of nodes) {
    const entry = {
      id: node.id,
      name: node.name,
      type: node.type,
      summary: node.summary || '',
    };
    switch (node.type) {
      case 'document':
        nonCodeFiles.documentation.push(entry);
        break;
      case 'service':
      case 'pipeline':
      case 'resource':
        nonCodeFiles.infrastructure.push(entry);
        break;
      case 'table':
      case 'schema':
      case 'endpoint':
        nonCodeFiles.data.push(entry);
        break;
      case 'config':
        nonCodeFiles.config.push(entry);
        break;
      default:
        break;
    }
  }

  const mutualPairs = new Map();
  const edgeKey = (a, b) => `${a}\0${b}`;
  const edgeSet = new Set();
  const reverseEdgeSet = new Set();

  for (const e of edges) {
    if (!['imports', 'calls'].includes(e.type)) continue;
    edgeSet.add(edgeKey(e.source, e.target));
    reverseEdgeSet.add(edgeKey(e.target, e.source));
  }

  for (const e of edges) {
    if (!['imports', 'calls'].includes(e.type)) continue;
    const rev = edgeKey(e.target, e.source);
    if (edgeSet.has(rev) || reverseEdgeSet.has(edgeKey(e.source, e.target))) {
      const pairKey = [e.source, e.target].sort().join('\0');
      mutualPairs.set(pairKey, (mutualPairs.get(pairKey) || 0) + 1);
    }
  }

  const clusterMap = new Map();
  for (const [pairKey, count] of mutualPairs) {
    const [a, b] = pairKey.split('\0');
    let clusterId = clusterMap.get(a) ?? clusterMap.get(b);
    if (!clusterId) {
      clusterId = pairKey;
      clusterMap.set(a, clusterId);
      clusterMap.set(b, clusterId);
    } else {
      clusterMap.set(a, clusterId);
      clusterMap.set(b, clusterId);
    }
  }

  const clustersRaw = new Map();
  for (const [nodeId, clusterId] of clusterMap) {
    if (!clustersRaw.has(clusterId)) clustersRaw.set(clusterId, new Set());
    clustersRaw.get(clusterId).add(nodeId);
  }

  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const cluster of clustersRaw.values()) {
      const members = [...cluster];
      for (const e of edges) {
        if (!['imports', 'calls'].includes(e.type)) continue;
        const connects =
          (cluster.has(e.source) && !cluster.has(e.target)) ||
          (cluster.has(e.target) && !cluster.has(e.source));
        if (!connects) continue;
        const other = cluster.has(e.source) ? e.target : e.source;
        let otherCount = 0;
        for (const m of members) {
          if (
            edgeSet.has(edgeKey(m, other)) ||
            edgeSet.has(edgeKey(other, m))
          ) {
            otherCount++;
          }
        }
        if (otherCount >= 2 && !cluster.has(other)) {
          cluster.add(other);
          expanded = true;
        }
      }
    }
  }

  const clusters = [...clustersRaw.values()]
    .map((set) => {
      const nodesList = [...set].slice(0, 5);
      let edgeCount = 0;
      for (let i = 0; i < nodesList.length; i++) {
        for (let j = i + 1; j < nodesList.length; j++) {
          const a = nodesList[i];
          const b = nodesList[j];
          if (
            edgeSet.has(edgeKey(a, b)) ||
            edgeSet.has(edgeKey(b, a))
          ) {
            edgeCount++;
          }
        }
      }
      return { nodes: nodesList, edgeCount };
    })
    .filter((c) => c.nodes.length >= 2)
    .sort((a, b) => b.edgeCount - a.edgeCount || b.nodes.length - a.nodes.length)
    .slice(0, 10);

  const nodeSummaryIndex = {};
  for (const node of nodes) {
    nodeSummaryIndex[node.id] = {
      name: node.name,
      type: node.type,
      summary: node.summary || '',
    };
  }

  const result = {
    scriptCompleted: true,
    entryPointCandidates,
    fanInRanking,
    fanOutRanking,
    bfsTraversal: {
      startNode,
      order,
      depthMap,
      byDepth,
    },
    nonCodeFiles,
    clusters,
    layers: {
      count: layers.length,
      list: layers,
    },
    nodeSummaryIndex,
    totalNodes: nodes.length,
    totalEdges: edges.length,
  };

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
}

main();
