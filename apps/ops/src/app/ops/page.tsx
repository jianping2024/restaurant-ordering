import { MESA_MONOREPO } from '@mesa/shared';

export default function OpsDashboardPlaceholder() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm uppercase tracking-wide text-zinc-500">Mesa Platform</p>
      <h1 className="mt-2 text-3xl font-semibold">运营后台</h1>
      <p className="mt-4 text-zinc-400">
        独立部署于 <code className="text-zinc-300">@mesa/ops</code>，与租户产品{' '}
        <code className="text-zinc-300">{MESA_MONOREPO.webApp}</code> 分离。功能实施见{' '}
        <code className="text-zinc-300">docs/platform-admin-plan.zh.md</code>。
      </p>
    </main>
  );
}
