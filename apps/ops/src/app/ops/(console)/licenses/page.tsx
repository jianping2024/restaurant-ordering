import { LicensesListClient } from './LicensesListClient';

export default function LicensesPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">授权</h1>
      <p className="mt-2 text-sm text-zinc-500">
        续期、暂停/恢复、本地安装码签发与认领状态。餐厅详情不再放这些操作。
      </p>
      <div className="mt-6">
        <LicensesListClient />
      </div>
    </div>
  );
}
