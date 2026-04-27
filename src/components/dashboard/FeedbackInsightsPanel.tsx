interface FeedbackIssue {
  menu_item_id: string;
  dish_name: string;
  down_count: number;
}

interface FeedbackInsightsProps {
  title: string;
  touchedLabel: string;
  completedLabel: string;
  actionableLabel: string;
  coverageLabel: string;
  topIssuesLabel: string;
  noIssuesLabel: string;
  touchedRate: number;
  completedRate: number;
  actionableRate: number;
  sessionsWithFeedback: number;
  billedSessions: number;
  topIssues: FeedbackIssue[];
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

export function FeedbackInsightsPanel({
  title,
  touchedLabel,
  completedLabel,
  actionableLabel,
  coverageLabel,
  topIssuesLabel,
  noIssuesLabel,
  touchedRate,
  completedRate,
  actionableRate,
  sessionsWithFeedback,
  billedSessions,
  topIssues,
}: FeedbackInsightsProps) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-2xl p-5 mb-6">
      <h2 className="font-heading text-2xl text-brand-gold">{title}</h2>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-xl border border-brand-border p-3">
          <p className="text-[13px] text-brand-text-muted">{touchedLabel}</p>
          <p className="mt-1 text-2xl font-heading text-brand-text">{formatPercent(touchedRate)}</p>
        </div>
        <div className="rounded-xl border border-brand-border p-3">
          <p className="text-[13px] text-brand-text-muted">{completedLabel}</p>
          <p className="mt-1 text-2xl font-heading text-brand-text">{formatPercent(completedRate)}</p>
        </div>
        <div className="rounded-xl border border-brand-border p-3">
          <p className="text-[13px] text-brand-text-muted">{actionableLabel}</p>
          <p className="mt-1 text-2xl font-heading text-brand-text">{formatPercent(actionableRate)}</p>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-brand-text-muted">
        {coverageLabel}: {sessionsWithFeedback} / {billedSessions}
      </p>

      <div className="mt-4 pt-4 border-t border-brand-border">
        <p className="text-sm text-brand-text mb-2">{topIssuesLabel}</p>
        {topIssues.length === 0 ? (
          <p className="text-[13px] text-brand-text-muted">{noIssuesLabel}</p>
        ) : (
          <div className="space-y-2">
            {topIssues.map((issue) => (
              <div key={issue.menu_item_id} className="flex items-center justify-between rounded-lg border border-brand-border px-3 py-2">
                <p className="text-sm text-brand-text">{issue.dish_name}</p>
                <span className="text-[13px] px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/35 text-red-700">
                  👎 {issue.down_count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
