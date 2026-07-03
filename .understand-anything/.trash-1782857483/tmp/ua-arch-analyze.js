#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const FILE_LEVEL_TYPES = new Set([
  'file', 'config', 'document', 'service', 'pipeline',
  'table', 'schema', 'resource', 'endpoint',
]);

const DIR_PATTERNS = {
  routes: 'api', api: 'api', controllers: 'api', endpoints: 'api', handlers: 'api',
  services: 'service', core: 'service', lib: 'service', domain: 'service', logic: 'service',
  models: 'data', db: 'data', data: 'data', persistence: 'data', repository: 'data', entities: 'data',
  components: 'ui', views: 'ui', pages: 'ui', ui: 'ui', layouts: 'ui', screens: 'ui', app: 'ui',
  middleware: 'middleware', plugins: 'middleware', interceptors: 'middleware', guards: 'middleware',
  utils: 'utility', helpers: 'utility', common: 'utility', shared: 'utility', tools: 'utility',
  config: 'config', constants: 'config', env: 'config', settings: 'config',
  __tests__: 'test', test: 'test', tests: 'test', spec: 'test', specs: 'test',
  types: 'types', interfaces: 'types', schemas: 'types', contracts: 'types', dtos: 'types',
  hooks: 'hooks', store: 'state', state: 'state', reducers: 'state', actions: 'state', slices: 'state',
  assets: 'assets', static: 'assets', public: 'assets', migrations: 'data',
  management: 'config', commands: 'config', templatetags: 'utility', signals: 'service',
  serializers: 'api', cmd: 'entry', internal: 'service', pkg: 'utility',
  composables: 'service', blueprints: 'api', mailers: 'service', jobs: 'service', channels: 'service',
  bin: 'entry', docs: 'documentation', documentation: 'documentation', wiki: 'documentation',
  deploy: 'infrastructure', deployment: 'infrastructure', infra: 'infrastructure', infrastructure: 'infrastructure',
  '.github': 'ci-cd', '.gitlab': 'ci-cd', '.circleci': 'ci-cd',
  k8s: 'infrastructure', kubernetes: 'infrastructure', helm: 'infrastructure', charts: 'infrastructure',
  terraform: 'infrastructure', tf: 'infrastructure', docker: 'infrastructure',
  sql: 'data', database: 'data', schema: 'data', supabase: 'data',
  scripts: 'utility', packages: 'utility',
};

function getFilePath(node) {
  return node.filePath || node.id.replace(/^[^:]+:/, '');
}

function computeCommonPrefix(paths) {
  if (paths.length === 0) return '';
  const parts = paths.map((p) => p.split('/'));
  const minLen = Math.min(...parts.map((p) => p.length));
  const common = [];
  for (let i = 0; i < minLen; i++) {
    const seg = parts[0][i];
    if (parts.every((p) => p[i] === seg)) common.push(seg);
    else break;
  }
  if (common.length === 0) return '';
  const prefix = common.join('/') + '/';
  return prefix;
}

function groupByDirectory(fileNodes) {
  const paths = fileNodes.map(getFilePath);
  const commonPrefix = computeCommonPrefix(paths);

  const groups = {};
  for (const node of fileNodes) {
    const fp = getFilePath(node);
    let rel = fp;
    if (commonPrefix && fp.startsWith(commonPrefix)) {
      rel = fp.slice(commonPrefix.length);
    }
    const segments = rel.split('/').filter(Boolean);
    let groupKey;
    if (segments.length <= 1) {
      const ext = path.extname(fp);
      if (/\.(test|spec)\./.test(fp) || /_test\.|test_/.test(fp)) groupKey = 'test';
      else if (/\.config\./.test(fp) || fp.endsWith('.json') || fp.endsWith('.toml')) groupKey = 'config';
      else groupKey = 'root';
    } else {
      groupKey = segments[0];
    }
    if (!groups[groupKey]) groups[groupKey] = [];
    groups[groupKey].push(node.id);
  }
  return { groups, commonPrefix };
}

function classifyFilePattern(fp) {
  const base = path.basename(fp);
  if (/\.(test|spec)\./.test(fp) || /_test\.(go|py|ts|js)$/.test(fp) || /test_.*\.py$/.test(fp)) return 'test';
  if (/\.d\.ts$/.test(fp)) return 'types';
  if (/Dockerfile/.test(base) || /^docker-compose/.test(base)) return 'infrastructure';
  if (/\.(tf|tfvars)$/.test(fp)) return 'infrastructure';
  if (/\.github\/workflows\//.test(fp) || base === '.gitlab-ci.yml' || base === 'Jenkinsfile') return 'ci-cd';
  if (/\.sql$/.test(fp)) return 'data';
  if (/\.(graphql|gql|proto|prisma)$/.test(fp)) return 'types';
  if (/\.(md|rst)$/.test(fp)) return 'documentation';
  if (base === 'Makefile') return 'infrastructure';
  if (/^(package\.json|tsconfig.*\.json|go\.mod|Cargo\.toml|Gemfile|pom\.xml|build\.gradle|composer\.json)$/.test(base)) return 'config';
  if (base === 'main.go' && /\/cmd\//.test(fp)) return 'entry';
  if ((base === 'main.rs' || base === 'lib.rs') && fp.startsWith('src/')) return 'entry';
  if (base === 'index.ts' || base === 'index.js' || base === '__init__.py') return 'entry';
  return null;
}

function matchDirPattern(groupKey, samplePath) {
  const lower = groupKey.toLowerCase();
  if (DIR_PATTERNS[lower]) return DIR_PATTERNS[lower];
  const filePattern = classifyFilePattern(samplePath || groupKey);
  if (filePattern) return filePattern;
  return 'unknown';
}

function buildAdjacency(importEdges) {
  const fanOut = {};
  const fanIn = {};
  const adj = {};
  for (const e of importEdges) {
    if (!adj[e.source]) adj[e.source] = new Set();
    adj[e.source].add(e.target);
    fanOut[e.source] = (fanOut[e.source] || 0) + 1;
    fanIn[e.target] = (fanIn[e.target] || 0) + 1;
  }
  return { adj, fanOut, fanIn };
}

function nodeToGroup(nodeId, dirGroups) {
  for (const [group, ids] of Object.entries(dirGroups)) {
    if (ids.includes(nodeId)) return group;
  }
  return 'unknown';
}

function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  if (!inputPath || !outputPath) {
    console.error('Usage: node ua-arch-analyze.js <input.json> <output.json>');
    process.exit(1);
  }

  let input;
  try {
    input = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch (err) {
    console.error('Failed to read input:', err.message);
    process.exit(1);
  }

  const { fileNodes, importEdges = [], allEdges = [] } = input;
  const { groups: directoryGroups, commonPrefix } = groupByDirectory(fileNodes);

  const nodeTypeGroups = {};
  for (const n of fileNodes) {
    if (!nodeTypeGroups[n.type]) nodeTypeGroups[n.type] = [];
    nodeTypeGroups[n.type].push(n.id);
  }

  const { fanOut, fanIn } = buildAdjacency(importEdges);

  const interGroupCounts = {};
  for (const e of importEdges) {
    const fromG = nodeToGroup(e.source, directoryGroups);
    const toG = nodeToGroup(e.target, directoryGroups);
    const key = `${fromG} -> ${toG}`;
    interGroupCounts[key] = (interGroupCounts[key] || 0) + 1;
  }
  const interGroupImports = Object.entries(interGroupCounts).map(([k, count]) => {
    const [from, to] = k.split(' -> ');
    return { from, to, count };
  });

  const intraGroupDensity = {};
  for (const group of Object.keys(directoryGroups)) {
    let internal = 0;
    let total = 0;
    for (const e of importEdges) {
      const fromG = nodeToGroup(e.source, directoryGroups);
      const toG = nodeToGroup(e.target, directoryGroups);
      if (fromG === group || toG === group) {
        total++;
        if (fromG === group && toG === group) internal++;
      }
    }
    intraGroupDensity[group] = {
      internalEdges: internal,
      totalEdges: total,
      density: total > 0 ? Math.round((internal / total) * 1000) / 1000 : 0,
    };
  }

  const crossCatMap = {};
  for (const e of allEdges) {
    const srcNode = fileNodes.find((n) => n.id === e.source);
    const tgtNode = fileNodes.find((n) => n.id === e.target);
    if (!srcNode || !tgtNode) continue;
    const key = `${srcNode.type}|${tgtNode.type}|${e.type}`;
    crossCatMap[key] = (crossCatMap[key] || 0) + 1;
  }
  const crossCategoryEdges = Object.entries(crossCatMap).map(([k, count]) => {
    const [fromType, toType, edgeType] = k.split('|');
    return { fromType, toType, edgeType, count };
  });

  const idToPath = {};
  for (const n of fileNodes) idToPath[n.id] = getFilePath(n);

  const patternMatches = {};
  for (const [group, ids] of Object.entries(directoryGroups)) {
    const samplePath = ids.length ? idToPath[ids[0]] : group;
    patternMatches[group] = matchDirPattern(group, samplePath);
  }

  const infraPatterns = [/Dockerfile/i, /docker-compose/i, /\.tf$/, /k8s\//, /kubernetes\//, /helm\//];
  const ciPatterns = [/\.github\/workflows\//, /\.gitlab-ci\.yml$/, /Jenkinsfile$/];
  const infraFiles = fileNodes
    .filter((n) => {
      const fp = getFilePath(n);
      return infraPatterns.some((p) => p.test(fp)) || ciPatterns.some((p) => p.test(fp)) ||
        n.type === 'service' || n.type === 'pipeline';
    })
    .map((n) => getFilePath(n));

  const deploymentTopology = {
    hasDockerfile: fileNodes.some((n) => /Dockerfile/i.test(getFilePath(n))),
    hasCompose: fileNodes.some((n) => /docker-compose/i.test(getFilePath(n))),
    hasK8s: fileNodes.some((n) => /k8s\/|kubernetes\//.test(getFilePath(n))),
    hasTerraform: fileNodes.some((n) => /\.tf$/.test(getFilePath(n))),
    hasCI: fileNodes.some((n) => ciPatterns.some((p) => p.test(getFilePath(n)))),
    infraFiles: [...new Set(infraFiles)],
  };

  const schemaFiles = fileNodes.filter((n) => /\.(graphql|gql|proto|prisma|sql)$/.test(getFilePath(n)) || n.type === 'schema').map((n) => getFilePath(n));
  const migrationFiles = fileNodes.filter((n) => /migrations?\//.test(getFilePath(n)) || (n.type === 'table')).map((n) => getFilePath(n));
  const dataModelFiles = fileNodes.filter((n) => /models?\//.test(getFilePath(n)) || n.type === 'table').map((n) => getFilePath(n));
  const apiHandlerFiles = fileNodes.filter((n) => /\/api\//.test(getFilePath(n)) || /routes?\//.test(getFilePath(n))).map((n) => getFilePath(n));

  const dataPipeline = { schemaFiles, migrationFiles, dataModelFiles, apiHandlerFiles };

  const docFilePaths = new Set(
    fileNodes.filter((n) => n.type === 'document' || /\.(md|rst)$/.test(getFilePath(n))).map((n) => getFilePath(n))
  );
  const groupsWithDocs = Object.entries(directoryGroups).filter(([group, ids]) => {
    return ids.some((id) => {
      const fp = idToPath[id];
      return docFilePaths.has(fp) || /README\.md$/i.test(fp) || fp.startsWith('docs/');
    });
  }).map(([g]) => g);

  const totalGroups = Object.keys(directoryGroups).length;
  const docCoverage = {
    groupsWithDocs: groupsWithDocs.length,
    totalGroups,
    coverageRatio: totalGroups > 0 ? Math.round((groupsWithDocs.length / totalGroups) * 1000) / 1000 : 0,
    undocumentedGroups: Object.keys(directoryGroups).filter((g) => !groupsWithDocs.includes(g)),
  };

  const pairDeps = {};
  for (const { from, to, count } of interGroupImports) {
    if (from === to) continue;
    const key = [from, to].sort().join('|');
    if (!pairDeps[key]) pairDeps[key] = {};
    pairDeps[key][from] = (pairDeps[key][from] || 0) + count;
  }
  const dependencyDirection = [];
  for (const [key, counts] of Object.entries(pairDeps)) {
    const [a, b] = key.split('|');
    const aToB = counts[a] || 0;
    const bToA = counts[b] || 0;
    if (aToB > bToA) dependencyDirection.push({ dependent: a, dependsOn: b });
    else if (bToA > aToB) dependencyDirection.push({ dependent: b, dependsOn: a });
  }

  const filesPerGroup = {};
  for (const [g, ids] of Object.entries(directoryGroups)) filesPerGroup[g] = ids.length;

  const nodeTypeCounts = {};
  for (const [t, ids] of Object.entries(nodeTypeGroups)) nodeTypeCounts[t] = ids.length;

  const result = {
    scriptCompleted: true,
    commonPrefix,
    directoryGroups,
    nodeTypeGroups,
    crossCategoryEdges,
    interGroupImports,
    intraGroupDensity,
    patternMatches,
    deploymentTopology,
    dataPipeline,
    docCoverage,
    dependencyDirection,
    fileStats: {
      totalFileNodes: fileNodes.length,
      filesPerGroup,
      nodeTypeCounts,
    },
    fileFanIn: fanIn,
    fileFanOut: fanOut,
  };

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.error(`Wrote ${outputPath} (${fileNodes.length} file nodes)`);
}

main();
