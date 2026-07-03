
const fs = require('fs');
const graphPath = process.argv[2];
const outputPath = process.argv[3];
try {
  const graph = JSON.parse(fs.readFileSync(graphPath, 'utf8'));
  const issues = [], warnings = [];
  if (!Array.isArray(graph.nodes)) { issues.push('graph.nodes is missing or not an array'); graph.nodes = []; }
  if (!Array.isArray(graph.edges)) { issues.push('graph.edges is missing or not an array'); graph.edges = []; }
  const nodeIds = new Set();
  const seen = new Map();
  graph.nodes.forEach((n, i) => {
    if (!n.id) { issues.push(`Node[${i}] missing id`); return; }
    if (!n.type) issues.push(`Node[${i}] '${n.id}' missing type`);
    if (!n.name) issues.push(`Node[${i}] '${n.id}' missing name`);
    if (!n.summary) { n.summary = '暂无摘要'; issues.push(`Node[${i}] '${n.id}' missing summary`); }
    if (!n.tags || !n.tags.length) { n.tags = ['untagged']; issues.push(`Node[${i}] '${n.id}' missing tags`); }
    if (seen.has(n.id)) issues.push(`Duplicate node ID '${n.id}' at indices ${seen.get(n.id)} and ${i}`);
    else seen.set(n.id, i);
    nodeIds.add(n.id);
  });
  graph.edges = graph.edges.filter((e, i) => {
    let ok = true;
    if (!nodeIds.has(e.source)) { issues.push(`Edge[${i}] source '${e.source}' not found`); ok = false; }
    if (!nodeIds.has(e.target)) { issues.push(`Edge[${i}] target '${e.target}' not found`); ok = false; }
    return ok;
  });
  const fileLevelTypes = new Set(['file', 'config', 'document', 'service', 'pipeline', 'table', 'schema', 'resource', 'endpoint']);
  const fileNodes = graph.nodes.filter(n => fileLevelTypes.has(n.type)).map(n => n.id);
  const assigned = new Map();
  if (!Array.isArray(graph.layers)) { if (graph.layers) warnings.push('graph.layers is not an array'); graph.layers = []; }
  if (!Array.isArray(graph.tour)) { if (graph.tour) warnings.push('graph.tour is not an array'); graph.tour = []; }
  graph.layers.forEach(layer => {
    layer.nodeIds = (layer.nodeIds || []).filter(id => {
      if (!nodeIds.has(id)) { issues.push(`Layer '${layer.id}' refs missing node '${id}'`); return false; }
      if (assigned.has(id)) { issues.push(`Node '${id}' appears in multiple layers`); return false; }
      assigned.set(id, layer.id);
      return true;
    });
  });
  fileNodes.forEach(id => {
    if (!assigned.has(id)) {
      const orphanLayer = graph.layers.find(l => l.id === 'layer:other');
      if (orphanLayer) orphanLayer.nodeIds.push(id);
      else graph.layers.push({ id: 'layer:other', name: '其他', description: '自动归入未分类文件', nodeIds: [id] });
      assigned.set(id, 'layer:other');
    }
  });
  graph.tour.forEach((step, i) => {
    step.nodeIds = (step.nodeIds || []).filter(id => {
      if (!nodeIds.has(id)) { issues.push(`Tour step[${i}] refs missing node '${id}'`); return false; }
      return true;
    });
  });
  const withEdges = new Set([...graph.edges.map(e => e.source), ...graph.edges.map(e => e.target)]);
  graph.nodes.forEach(n => {
    if (!withEdges.has(n.id)) warnings.push(`Node '${n.id}' has no edges (orphan)`);
  });
  const stats = {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    totalLayers: graph.layers.length,
    tourSteps: graph.tour.length,
    nodeTypes: graph.nodes.reduce((a, n) => { a[n.type] = (a[n.type]||0)+1; return a; }, {}),
    edgeTypes: graph.edges.reduce((a, e) => { a[e.type] = (a[e.type]||0)+1; return a; }, {})
  };
  fs.writeFileSync(graphPath, JSON.stringify(graph, null, 2));
  fs.writeFileSync(outputPath, JSON.stringify({ issues, warnings, stats }, null, 2));
  process.exit(0);
} catch (err) { process.stderr.write(err.message + '\n'); process.exit(1); }
