import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const root = '/Users/chenjianping/Documents/restaurant-ordering';
const graph = JSON.parse(
  readFileSync(join(root, '.understand-anything/intermediate/assembled-graph.json'), 'utf8')
);
const layersPath = join(root, '.understand-anything/.trash-1782856069/layers.json');
let layers = [];
try {
  const raw = JSON.parse(readFileSync(layersPath, 'utf8'));
  layers = raw.map(({ id, name, description }) => ({ id, name, description }));
} catch {
  layers = graph.layers ?? [];
}

writeFileSync(
  join(root, '.understand-anything/tmp/ua-tour-input.json'),
  JSON.stringify({ nodes: graph.nodes, edges: graph.edges, layers })
);
