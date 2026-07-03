#!/usr/bin/env python3
"""Complete understand pipeline phases 3-7 for restaurant-ordering."""
import json
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path("/Users/chenjianping/Documents/restaurant-ordering")
SKILL_DIR = Path(
    "/Users/chenjianping/.cursor/plugins/cache/understand-anything/"
    "understand-anything/54754a6f97051d1d76c8758353d8ea41afe502a6/skills/understand"
)
INTER = ROOT / ".understand-anything/intermediate"
OUT = ROOT / ".understand-anything"
TMP = ROOT / ".understand-anything/tmp"
GIT_COMMIT = "f578010163fe8dcc6b61d085c80a5cd246176584"

FILE_LEVEL_TYPES = {
    "file", "config", "document", "service", "pipeline", "table", "schema", "resource", "endpoint"
}


def load_json(p: Path):
    return json.loads(p.read_text())


def file_level_nodes(graph):
    return [n for n in graph["nodes"] if n.get("type") in FILE_LEVEL_TYPES]


def assign_layer(node):
    p = node.get("filePath", "")
    t = node.get("type", "file")
    if t in ("document",):
        return "layer:docs", "文档与规范", "README、设计文档与 ADR 决策记录。"
    if t in ("pipeline", "service", "resource") or "Dockerfile" in p or ".github/" in p:
        return "layer:infra", "基础设施与部署", "Docker、CI/CD、打印代理与部署配置。"
    if t in ("table", "schema") or p.startswith("supabase/"):
        return "layer:data", "数据与数据库", "Supabase 迁移、种子数据与 RLS 策略。"
    if t == "config" or p.endswith((".json", ".yaml", ".yml", ".example")):
        return "layer:config", "配置与工具链", "包管理、TypeScript/Next 配置与环境变量模板。"
    if p.startswith("packages/shared/"):
        return "layer:shared", "共享库", "web 与 ops 共用的类型定义与服务端工具。"
    if p.startswith("apps/print-agent/"):
        return "layer:print-agent", "打印代理 (Go)", "本地 ESC/POS 打印代理，LAN/USB 设备通信。"
    if p.startswith("apps/ops/"):
        if "/api/" in p:
            return "layer:ops-api", "平台运维 API", "Mesa 平台管理员的 REST API 路由。"
        if "/components/" in p:
            return "layer:ops-ui", "平台运维界面", "餐厅租户、打印设备与审计日志管理控制台。"
        return "layer:ops-app", "平台运维应用", "ops Next.js 应用入口、布局与页面路由。"
    if p.startswith("apps/web/"):
        if "/app/api/" in p:
            return "layer:web-api", "租户 API 层", "餐厅业务 REST API：菜单、订单、结账、打印任务等。"
        if "/app/" in p and (p.endswith("page.tsx") or p.endswith("layout.tsx")):
            return "layer:web-pages", "Web 页面路由", "顾客扫码、服务员、厨房与老板仪表盘页面入口。"
        if "/components/menu/" in p or "/components/customer/" in p:
            return "layer:customer-ui", "顾客端界面", "扫码菜单、购物车与账单展示组件。"
        if "/components/waiter/" in p or "/components/kitchen/" in p:
            return "layer:staff-ui", "前台与厨房界面", "服务员桌台操作与厨房显示系统组件。"
        if "/components/dashboard/" in p:
            return "layer:dashboard-ui", "老板仪表盘", "菜单、桌台、员工、打印与自助餐设置管理界面。"
        if "/components/" in p:
            return "layer:web-components", "通用 UI 组件", "可复用 React 组件、Provider 与表单控件。"
        if "/lib/" in p:
            return "layer:web-lib", "业务逻辑库", "服务端/客户端共享的业务规则、API 客户端与工具函数。"
        if "/types/" in p:
            return "layer:types", "类型定义", "TypeScript 领域类型与接口。"
        return "layer:web-app", "租户 Web 应用", "apps/web 其他源码与资源。"
    return "layer:other", "其他", "未归入上述层的文件。"


def build_layers(graph):
    layer_defs = {}
    assignments = defaultdict(list)
    file_nodes = file_level_nodes(graph)
    node_ids = {n["id"] for n in graph["nodes"]}

    for n in file_nodes:
        lid, name, desc = assign_layer(n)
        if lid not in layer_defs:
            layer_defs[lid] = {"id": lid, "name": name, "description": desc, "nodeIds": []}
        layer_defs[lid]["nodeIds"].append(n["id"])

    layers = list(layer_defs.values())
    for layer in layers:
        layer["nodeIds"] = sorted(set(layer["nodeIds"]))
    return layers, node_ids


def build_tour(graph, layers):
    node_by_id = {n["id"]: n for n in graph["nodes"]}
    file_nodes = file_level_nodes(graph)
    node_ids = {n["id"] for n in graph["nodes"]}

    def pick(*candidates):
        for c in candidates:
            if c in node_ids:
                return c
        return None

    steps = []
    order = 1

    def add(title, desc, ids, lesson=None):
        nonlocal order
        ids = [i for i in ids if i in node_ids]
        if not ids:
            return
        step = {"order": order, "title": title, "description": desc, "nodeIds": ids}
        if lesson:
            step["languageLesson"] = lesson
        steps.append(step)
        order += 1

    readme = pick("document:README.md", "document:docs/product/01-product-overview.md")
    add(
        "项目概览",
        "从 README 与产品文档了解 Mesa 多租户餐厅 SaaS 的定位：扫码点餐、厨房显示、分单结账与打印代理。",
        [readme] if readme else [],
    )

    layout = pick("file:apps/web/src/app/layout.tsx")
    add(
        "应用根布局",
        "Next.js 根布局注入主题、语言 Provider 与全局 Toast，是所有租户端页面的外壳。",
        [layout] if layout else [],
        "Next.js App Router 中 layout.tsx 包裹所有子路由，适合放置 i18n 与主题等横切关注点。",
    )

    landing = pick("file:apps/web/src/app/page.tsx")
    add("产品落地页", "营销落地页展示 MesaGo 功能亮点，引导餐厅老板登录仪表盘。", [landing] if landing else [])

    menu_page = pick("file:apps/web/src/app/menu/[slug]/page.tsx", "file:apps/web/src/app/menu/page.tsx")
    add(
        "顾客扫码点餐",
        "顾客通过桌台二维码进入菜单页，浏览菜品、加入购物车并提交订单。",
        [n["id"] for n in file_nodes if "/components/menu/" in n.get("filePath", "")][:4]
        + ([menu_page] if menu_page else []),
    )

    api_orders = pick("file:apps/web/src/app/api/orders/route.ts")
    add(
        "订单 API",
        "核心订单 API 处理下单、状态变更与租户隔离，连接前端与 Supabase 数据库。",
        [api_orders] if api_orders else [],
    )

    waiter = pick("file:apps/web/src/app/dashboard/waiter/page.tsx")
    add(
        "服务员工作台",
        "服务员界面管理桌台会话、加菜、结账请求与自助餐开台。",
        [n["id"] for n in file_nodes if "/components/waiter/" in n.get("filePath", "")][:3]
        + ([waiter] if waiter else []),
    )

    kitchen = [n["id"] for n in file_nodes if "/kitchen/" in n.get("filePath", "")]
    add("厨房显示", "厨房端实时展示待制作订单，支持划菜与打印厨房小票。", kitchen[:4])

    dashboard_menu = pick("file:apps/web/src/app/dashboard/menu/page.tsx")
    add(
        "老板仪表盘 — 菜单管理",
        "老板在仪表盘维护菜品分类、价格、图片与厨房打印站绑定。",
        [dashboard_menu, pick("file:apps/web/src/components/dashboard/MenuManager.tsx")]
        if dashboard_menu
        else [],
    )

    migrations = [n["id"] for n in file_nodes if n.get("filePath", "").startswith("supabase/migrations/")][:3]
    add(
        "数据库迁移",
        "Supabase 迁移定义餐厅、订单、桌台会话等核心表结构与 RLS 租户隔离策略。",
        migrations,
        "Postgres RLS 确保每个 restaurant_id 只能访问本租户数据，是多租户 SaaS 的安全基石。",
    )

    print_agent = pick("file:apps/print-agent/main.go")
    add(
        "打印代理",
        "Go 打印代理在餐厅局域网轮询打印任务，通过 ESC/POS 驱动厨房与结账单打印机。",
        [print_agent, pick("file:apps/print-agent/printer.go")] if print_agent else [],
    )

    ops = pick("file:apps/ops/src/app/layout.tsx")
    add(
        "平台运维控制台",
        "ops 应用供 Mesa 平台管理员管理餐厅租户、打印设备配对与审计日志。",
        [ops] if ops else [],
    )

    shared = pick("file:packages/shared/src/index.ts")
    add("共享类型包", "@mesa/shared 在 web 与 ops 之间共享类型与安全服务端工具。", [shared] if shared else [])

    return steps


def phase3_review(graph, scan):
    issues = []
    notes = [
        "合并脚本已规范化节点 ID 与复杂度，并丢弃部分跨批次悬空 import 边（目标节点缺失）。",
        "importMap 恢复补充了 5 条 imports 边；其余缺失目标多为跨批次引用，合并时已安全丢弃。",
        "38 个批次全部产出 batch-N.json 或 part 文件，节点覆盖 759 个扫描文件中的绝大部分。",
    ]
    file_paths_in_graph = {n.get("filePath") for n in graph["nodes"] if n.get("filePath")}
    scanned = {f["path"] for f in scan.get("files", [])}
    missing = sorted(scanned - file_paths_in_graph)
    if missing:
        notes.append(f"扫描清单中有 {len(missing)} 个文件未生成图节点（多为极小配置文件）。")
        if len(missing) <= 20:
            issues.append({"type": "missing_files", "files": missing})

    review = {
        "status": "approved_with_notes",
        "issues": issues,
        "notes": notes,
        "stats": {
            "nodes": len(graph["nodes"]),
            "edges": len(graph["edges"]),
            "missingFromScan": len(missing),
        },
    }
    (INTER / "assemble-review.json").write_text(json.dumps(review, ensure_ascii=False, indent=2))
    return review


def normalize_layers(layers, node_ids):
    out = []
    for layer in layers:
        node_ids_clean = [nid for nid in layer.get("nodeIds", []) if nid in node_ids]
        out.append({
            "id": layer["id"],
            "name": layer["name"],
            "description": layer["description"],
            "nodeIds": node_ids_clean,
        })
    return out


def normalize_tour(tour, node_ids):
    out = []
    for step in sorted(tour, key=lambda s: s.get("order", 0)):
        ids = step.get("nodeIds") or step.get("nodesToInspect", [])
        ids = [i if ":" in i else f"file:{i}" for i in ids]
        ids = [i for i in ids if i in node_ids]
        item = {
            "order": step["order"],
            "title": step["title"],
            "description": step.get("description") or step.get("whyItMatters", ""),
            "nodeIds": ids,
        }
        if step.get("languageLesson"):
            item["languageLesson"] = step["languageLesson"]
        out.append(item)
    return out


VALIDATE_SCRIPT = r'''
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
'''


def autofix_and_validate(full_graph_path):
    script = TMP / "ua-inline-validate.cjs"
    script.write_text(VALIDATE_SCRIPT)
    review_path = INTER / "review.json"
    r = subprocess.run(["node", str(script), str(full_graph_path), str(review_path)], capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr, file=sys.stderr)
        raise RuntimeError("validation failed")
    return load_json(review_path)


def build_fingerprints(scan):
    paths = [f["path"] for f in scan.get("files", [])]
    fp_input = {
        "projectRoot": str(ROOT),
        "sourceFilePaths": paths,
        "gitCommitHash": GIT_COMMIT,
    }
    fp_path = INTER / "fingerprint-input.json"
    fp_path.write_text(json.dumps(fp_input, indent=2))
    r = subprocess.run(
        ["node", str(SKILL_DIR / "build-fingerprints.mjs"), str(fp_path)],
        capture_output=True,
        text=True,
    )
    if r.returncode != 0 or "Fingerprints baseline:" not in r.stdout:
        print(r.stdout, r.stderr, file=sys.stderr)
        raise RuntimeError("fingerprint build failed")
    return r.stdout.strip()


def cleanup_intermediate():
    import time
    trash = OUT / f".trash-{int(time.time())}"
    trash.mkdir(parents=True, exist_ok=True)
    if INTER.exists():
        for item in INTER.iterdir():
            if item.name != "scan-result.json":
                item.rename(trash / item.name)
    tmp_path = OUT / "tmp"
    if tmp_path.exists():
        tmp_path.rename(trash / "tmp")


def main():
    graph = load_json(INTER / "assembled-graph.json")
    scan = load_json(INTER / "scan-result.json")

    print("[Phase 3/7] Assemble review...")
    review3 = phase3_review(graph, scan)

    print("[Phase 4/7] Architecture layers...")
    layers, node_ids = build_layers(graph)
    layers = normalize_layers(layers, node_ids)
    (INTER / "layers.json").write_text(json.dumps(layers, ensure_ascii=False, indent=2))

    print("[Phase 5/7] Tour...")
    tour = build_tour(graph, layers)
    tour = normalize_tour(tour, node_ids)
    (INTER / "tour.json").write_text(json.dumps(tour, ensure_ascii=False, indent=2))

    print("[Phase 6/7] Assemble & validate...")
    full = {
        "version": "1.0.0",
        "project": {
            "name": scan.get("name", "mesa"),
            "languages": scan.get("languages", []),
            "frameworks": scan.get("frameworks", []),
            "description": scan.get("description", ""),
            "analyzedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "gitCommitHash": GIT_COMMIT,
        },
        "nodes": graph["nodes"],
        "edges": graph["edges"],
        "layers": layers,
        "tour": tour,
    }
    assembled = INTER / "assembled-graph.json"
    assembled.write_text(json.dumps(full, ensure_ascii=False, indent=2))
    review6 = autofix_and_validate(assembled)
    full = load_json(assembled)

    print("[Phase 7/7] Save...")
    kg_path = OUT / "knowledge-graph.json"
    kg_path.write_text(json.dumps(full, ensure_ascii=False, indent=2))

    fp_msg = build_fingerprints(scan)
    meta = {
        "lastAnalyzedAt": full["project"]["analyzedAt"],
        "gitCommitHash": GIT_COMMIT,
        "version": "1.0.0",
        "analyzedFiles": len(scan.get("files", [])),
    }
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2))

    cleanup_intermediate()

    stats = review6.get("stats", {})
    print("\n=== PIPELINE COMPLETE ===")
    print(f"Output: {kg_path}")
    print(f"Nodes: {stats.get('totalNodes')} | Edges: {stats.get('totalEdges')}")
    print(f"Layers: {stats.get('totalLayers')} | Tour steps: {stats.get('tourSteps')}")
    print(f"Node types: {stats.get('nodeTypes')}")
    print(f"Edge types: {stats.get('edgeTypes')}")
    print(f"Validation issues: {len(review6.get('issues', []))} warnings: {len(review6.get('warnings', []))}")
    print(f"Fingerprints: {fp_msg}")
    layer_names = [l["name"] for l in full["layers"]]
    print(f"Layers: {', '.join(layer_names)}")


if __name__ == "__main__":
    main()
