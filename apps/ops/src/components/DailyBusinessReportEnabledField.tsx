/** Sole Ops UI for restaurants.daily_business_report_enabled (on_prem only). */
export function DailyBusinessReportEnabledField(props: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
}) {
  return (
    <label className={`flex items-start gap-2 text-sm text-zinc-300 ${props.className || ''}`}>
      <input
        type="checkbox"
        className="mt-1"
        checked={props.checked}
        onChange={(e) => props.onChange(e.target.checked)}
      />
      <span>
        启用每日经营日报上报
        <span className="mt-0.5 block text-xs text-zinc-500">
          平台策略（非店主功能开关）。默认关闭；勾选后店内日切上传昨日营业额、客流、Top10 到「经营日报」。
        </span>
      </span>
    </label>
  );
}
