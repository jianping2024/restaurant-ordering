#!/usr/bin/env python3
"""Generate batch-N.json knowledge graphs for all batches from extract results."""
import json
import math
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path("/Users/chenjianping/Documents/restaurant-ordering")
SKILL_DIR = Path(
    "/Users/chenjianping/.cursor/plugins/cache/understand-anything/"
    "understand-anything/54754a6f97051d1d76c8758353d8ea41afe502a6/skills/understand"
)
INTER = ROOT / ".understand-anything/intermediate"
TMP = ROOT / ".understand-anything/tmp"
BATCHES_JSON = INTER / "batches.json"
EXTRACT_SCRIPT = SKILL_DIR / "extract-structure.mjs"

NODE_TYPE_BY_CATEGORY = {
    "code": "file",
    "script": "file",
    "markup": "file",
    "config": "config",
    "docs": "document",
    "data": "table",
    "infra": "service",
}


def complexity_from_lines(n: int) -> str:
    if n < 50:
        return "simple"
    if n <= 200:
        return "moderate"
    return "complex"


def node_prefix(file_category: str, path: str) -> str:
    if file_category == "infra":
        if ".github/workflows" in path or "gitlab-ci" in path:
            return "pipeline"
        if path.endswith(".tf") or "terraform" in path:
            return "resource"
        return "service"
    if file_category == "data":
        if path.endswith((".graphql", ".proto", ".prisma")):
            return "schema"
        if "openapi" in path.lower() or "swagger" in path.lower():
            return "endpoint"
        return "table"
    t = NODE_TYPE_BY_CATEGORY.get(file_category, "file")
    return t


def infer_file_summary(path: str, file_category: str, name: str, metrics: dict) -> str:
    base = Path(path).name
    parts = path.split("/")

    if file_category == "docs":
        if "README" in base.upper():
            return "项目说明文档，介绍系统架构、安装部署与使用指南。"
        return f"项目文档 {base}，记录相关设计与实现说明。"

    if file_category == "config":
        if base == "package.json":
            return "npm 工作区包清单，声明依赖、脚本与构建配置。"
        if base.startswith("tsconfig"):
            return "TypeScript 编译配置，定义严格模式与路径别名。"
        if base in (".env.local.example", ".env.example"):
            return "环境变量示例文件，列出本地/云端运行所需配置项。"
        if "next.config" in base:
            return "Next.js 应用构建与运行时配置。"
        if base.endswith(".yaml") or base.endswith(".yml"):
            return f"YAML 配置文件 {base}，定义服务或工具链参数。"
        return f"配置文件 {base}，控制项目构建或运行时行为。"

    if file_category == "infra":
        if "Dockerfile" in base:
            return "Docker 镜像构建定义，打包应用运行环境。"
        if "docker-compose" in base:
            return "Docker Compose 编排文件，定义多容器本地开发栈。"
        if ".github/workflows" in path:
            return "GitHub Actions CI/CD 工作流，自动化测试与发布。"
        return f"基础设施定义文件 {base}。"

    if file_category == "data" or path.endswith(".sql"):
        if "migration" in path or "migrations" in path:
            return f"数据库迁移脚本 {base}，定义表结构变更与 RLS 策略。"
        if base == "seed.sql":
            return "数据库种子数据，用于本地开发与演示环境初始化。"
        return f"SQL 数据定义文件 {base}。"

    if "route.ts" in path or "route.tsx" in path:
        area = "仪表盘" if "/dashboard/" in path else "API"
        if "/api/" in path:
            seg = path.split("/api/")[-1].replace("/route.ts", "").replace("/route.tsx", "")
            return f"Next.js API 路由 {seg}，处理 HTTP 请求与租户隔离校验。"
        return f"Next.js {area} API 路由处理器。"

    if path.endswith("/page.tsx") or path.endswith("/page.ts"):
        seg = "/".join(parts[-3:-1]) if len(parts) >= 3 else "应用"
        return f"Next.js 页面入口 {seg}，服务端加载数据并渲染主组件。"

    if path.endswith("/layout.tsx"):
        return "Next.js 布局组件，包裹子路由并提供共享 Provider 与样式。"

    if "/components/ui/" in path:
        return f"可复用 UI 基础组件 {name}，供业务页面组合使用。"

    if "Manager" in name:
        domain = name.replace("Manager", "")
        return f"仪表盘 {domain} 管理器，提供 CRUD、排序与表单校验的客户端界面。"

    if name.endswith("Provider"):
        return f"React Context Provider {name}，向子树注入共享状态或配置。"

    if "/lib/" in path:
        return f"服务端/客户端共享工具库 {name}，封装业务逻辑与数据访问。"

    if path.endswith(".go"):
        if "main.go" in path:
            return "Go 打印代理主程序入口，启动 HTTP 服务与打印机轮询。"
        if "_test.go" in path:
            return f"Go 单元测试 {name}，验证打印代理核心逻辑。"
        return f"Go 模块 {name}，实现 ESC/POS 打印与设备通信。"

    if "/packages/shared/" in path:
        return f"monorepo 共享包模块 {name}，供 web 与 ops 应用复用类型与工具。"

    if "/apps/ops/" in path:
        return f"Mesa 平台运维控制台模块 {name}。"

    if "test" in base.lower() or base.endswith(".test.ts"):
        return f"单元测试 {name}，验证相邻业务模块行为。"

    return f"源码文件 {path}，参与餐厅点餐系统业务实现。"


def infer_file_tags(path: str, file_category: str, name: str) -> list:
    tags = []
    if file_category == "docs":
        tags = ["documentation"]
    elif file_category == "config":
        tags = ["configuration", "build-system"]
    elif file_category == "infra":
        tags = ["infrastructure", "deployment"]
    elif file_category == "data":
        tags = ["database", "migration"]
    else:
        tags = ["utility"]

    if "route.ts" in path or "/api/" in path:
        tags = ["api-handler", "nextjs"]
    elif path.endswith("page.tsx"):
        tags = ["entry-point", "component", "nextjs"]
    elif "/components/" in path:
        tags = ["component", "react"]
    elif "/lib/" in path:
        tags = ["utility", "service"]
    elif path.endswith(".go"):
        tags = ["printing", "service"]
    elif "/supabase/" in path:
        tags = ["database", "supabase"]

    if "dashboard" in path:
        tags.append("dashboard")
    if "waiter" in path:
        tags.append("waiter")
    if "kitchen" in path:
        tags.append("kitchen")
    if "menu" in path.lower():
        tags.append("menu")
    if "print" in path.lower():
        tags.append("printing")
    if ".test." in path or "_test." in path:
        tags = ["test"] + [t for t in tags if t != "utility"]

    # dedupe preserve order
    seen = set()
    out = []
    for t in tags:
        if t not in seen:
            seen.add(t)
            out.append(t)
    return out[:5]


def infer_func_summary(path: str, fn_name: str, exported: bool) -> str:
    if fn_name in ("GET", "POST", "PUT", "PATCH", "DELETE"):
        return f"处理 HTTP {fn_name} 请求的 API 处理器。"
    if fn_name.endswith("Page") or fn_name.endswith("Layout"):
        return f"React 页面/布局组件 {fn_name}。"
    if fn_name.startswith("use") and fn_name[3:4].isupper():
        return f"React Hook {fn_name}，封装可复用状态与副作用逻辑。"
    if exported and fn_name[0].isupper():
        return f"导出的 React 组件或类 {fn_name}。"
    if fn_name.startswith("parse") or fn_name.startswith("normalize"):
        return f"解析/规范化工具函数 {fn_name}。"
    if fn_name.startswith("load") or fn_name.startswith("fetch"):
        return f"数据加载函数 {fn_name}，从 API 或数据库获取上下文。"
    if fn_name.startswith("create") or fn_name.startswith("update") or fn_name.startswith("delete"):
        return f"CRUD 操作函数 {fn_name}。"
    return f"函数 {fn_name}，实现 {Path(path).stem} 中的局部业务逻辑。"


def is_significant(fn: dict, exports: list) -> bool:
    lines = fn["endLine"] - fn["startLine"] + 1
    exported = any(e.get("name") == fn["name"] for e in exports)
    return lines >= 10 or exported


def ensure_extract(batch_index: int, batch: dict) -> Path:
    extract_path = TMP / f"ua-file-extract-results-{batch_index}.json"
    input_path = TMP / f"ua-file-analyzer-input-{batch_index}.json"

    input_data = {
        "projectRoot": str(ROOT),
        "batchFiles": batch["files"],
        "batchImportData": batch.get("batchImportData", {}),
    }
    input_path.write_text(json.dumps(input_data, ensure_ascii=False, indent=2))

    if not extract_path.exists() or extract_path.stat().st_size < 10:
        print(f"  Running extract-structure for batch {batch_index}...", flush=True)
        r = subprocess.run(
            ["node", str(EXTRACT_SCRIPT), str(input_path), str(extract_path)],
            capture_output=True,
            text=True,
        )
        if r.returncode != 0:
            print(r.stderr, file=sys.stderr)
            raise RuntimeError(f"extract-structure failed for batch {batch_index}")

    return extract_path


def build_batch_graph(batch_index: int, batch: dict, extract: dict) -> tuple:
    batch_import = batch.get("batchImportData", {})
    file_meta = {f["path"]: f for f in batch["files"]}

    nodes = []
    edges = []
    node_ids = set()

    for r in extract.get("results", []):
        path = r["path"]
        fmeta = file_meta.get(path, {})
        file_category = fmeta.get("fileCategory", r.get("fileCategory", "code"))
        prefix = node_prefix(file_category, path)
        file_id = f"{prefix}:{path}"
        name = Path(path).name
        non_empty = r.get("nonEmptyLines", r.get("totalLines", 50))
        metrics = r.get("metrics", {})

        node = {
            "id": file_id,
            "type": prefix if prefix != "file" else "file",
            "name": name,
            "filePath": path,
            "summary": infer_file_summary(path, file_category, name, metrics),
            "tags": infer_file_tags(path, file_category, name),
            "complexity": complexity_from_lines(non_empty),
        }
        nodes.append(node)
        node_ids.add(file_id)

        exports = r.get("exports", [])
        exported_names = {e["name"] for e in exports if e.get("name") not in ("metadata", "runtime")}

        if file_category == "code":
            for fn in r.get("functions", []):
                if not is_significant(fn, exports):
                    continue
                fid = f"function:{path}:{fn['name']}"
                fnode = {
                    "id": fid,
                    "type": "function",
                    "name": fn["name"],
                    "filePath": path,
                    "lineRange": [fn["startLine"], fn["endLine"]],
                    "summary": infer_func_summary(path, fn["name"], fn["name"] in exported_names),
                    "tags": ["api-handler"] if fn["name"] in ("GET", "POST", "PUT", "PATCH", "DELETE") else ["utility"],
                    "complexity": complexity_from_lines(fn["endLine"] - fn["startLine"] + 1),
                }
                if fn["name"][0].isupper() and fn["name"] in exported_names:
                    fnode["tags"] = ["component", "react"]
                nodes.append(fnode)
                node_ids.add(fid)
                edges.append({"source": file_id, "target": fid, "type": "contains", "direction": "forward", "weight": 1.0})
                if fn["name"] in exported_names:
                    edges.append({"source": file_id, "target": fid, "type": "exports", "direction": "forward", "weight": 0.8})

            for cls in r.get("classes", []):
                lines = cls.get("endLine", cls["startLine"]) - cls["startLine"] + 1
                methods = cls.get("methods", [])
                if lines < 20 and len(methods) < 2:
                    continue
                cid = f"class:{path}:{cls['name']}"
                cnode = {
                    "id": cid,
                    "type": "class",
                    "name": cls["name"],
                    "filePath": path,
                    "lineRange": [cls["startLine"], cls.get("endLine", cls["startLine"])],
                    "summary": f"类 {cls['name']}，封装 {Path(path).stem} 中的状态与行为。",
                    "tags": ["data-model", "typescript"],
                    "complexity": complexity_from_lines(lines),
                }
                nodes.append(cnode)
                node_ids.add(cid)
                edges.append({"source": file_id, "target": cid, "type": "contains", "direction": "forward", "weight": 1.0})
                if cls["name"] in exported_names:
                    edges.append({"source": file_id, "target": cid, "type": "exports", "direction": "forward", "weight": 0.8})

            for imp in batch_import.get(path, []):
                imp_prefix = "file"
                imp_cat = file_meta.get(imp, {}).get("fileCategory")
                if imp_cat:
                    imp_prefix = node_prefix(imp_cat, imp)
                edges.append({
                    "source": file_id,
                    "target": f"{imp_prefix}:{imp}",
                    "type": "imports",
                    "direction": "forward",
                    "weight": 0.7,
                })

            # call graph internal
            for cg in r.get("callGraph", []):
                caller = cg.get("caller")
                callee = cg.get("callee")
                src = f"function:{path}:{caller}"
                # try same-file callee first
                tgt = f"function:{path}:{callee}"
                if src in node_ids and tgt in node_ids:
                    edges.append({"source": src, "target": tgt, "type": "calls", "direction": "forward", "weight": 0.8})

        # non-code edges
        if file_category == "config":
            for imp in batch_import.get(path, []):
                edges.append({"source": file_id, "target": f"file:{imp}", "type": "configures", "direction": "forward", "weight": 0.6})
        if file_category == "docs" and "README" in name.upper():
            edges.append({"source": file_id, "target": "file:apps/web/src/app/layout.tsx", "type": "documents", "direction": "forward", "weight": 0.5})
        if file_category == "infra" and "Dockerfile" in name:
            edges.append({"source": file_id, "target": "file:apps/web/src/app/layout.tsx", "type": "deploys", "direction": "forward", "weight": 0.7})

    return nodes, edges


def write_batch(batch_index: int, nodes: list, edges: list):
    node_count = len(nodes)
    edge_count = len(edges)

    if node_count <= 80 and edge_count <= 150:
        out = INTER / f"batch-{batch_index}.json"
        out.write_text(json.dumps({"nodes": nodes, "edges": edges}, ensure_ascii=False, indent=2))
        return [out]

    files = sorted({n["filePath"] for n in nodes if n.get("type") == "file" or n.get("filePath")})
    parts = max(2, math.ceil(max(node_count / 80, edge_count / 150)))
    chunk = math.ceil(len(files) / parts)
    file_chunks = [files[i : i + chunk] for i in range(0, len(files), chunk)]

    written = []
    for i, fchunk in enumerate(file_chunks, 1):
        fset = set(fchunk)
        part_nodes = [n for n in nodes if n.get("filePath") in fset]
        part_ids = {n["id"] for n in part_nodes}
        part_edges = [e for e in edges if e["source"] in part_ids]
        out = INTER / f"batch-{batch_index}-part-{i}.json"
        out.write_text(json.dumps({"nodes": part_nodes, "edges": part_edges}, ensure_ascii=False, indent=2))
        written.append(out)
    return written


def main():
    batches_data = json.loads(BATCHES_JSON.read_text())
    batches = {b["batchIndex"]: b for b in batches_data["batches"]}
    total = batches_data["totalBatches"]

    for i in range(1, total + 1):
        out_single = INTER / f"batch-{i}.json"
        out_parts = list(INTER.glob(f"batch-{i}-part-*.json"))
        if out_single.exists() or out_parts:
            print(f"Analyzing batch {i}/{total} — SKIP (exists)", flush=True)
            continue

        print(f"Analyzing batch {i}/{total}", flush=True)
        batch = batches[i]
        extract_path = ensure_extract(i, batch)
        extract = json.loads(extract_path.read_text())
        nodes, edges = build_batch_graph(i, batch, extract)
        paths = write_batch(i, nodes, edges)
        print(f"  -> {len(nodes)} nodes, {len(edges)} edges -> {[p.name for p in paths]}", flush=True)

    print("All batches complete.", flush=True)


if __name__ == "__main__":
    main()
