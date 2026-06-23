'use client';

type Props = {
  reason?: string | null;
};

export function RestaurantSuspensionBanner({ reason }: Props) {
  return (
    <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
      <p className="font-medium">餐厅已暂停营业</p>
      <p className="mt-1 text-amber-900/80">
        当前仅可查看数据，无法修改设置、员工账号或打印相关配置。
      </p>
      {reason ? <p className="mt-2 text-xs text-amber-900/70">{reason}</p> : null}
    </div>
  );
}
