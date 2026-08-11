/**
 * Sole Ops copy + health view-model for restaurant list, license list/detail, and
 * suspended summary counts. Runtime gate remains restaurants.suspended_at (ADR-004);
 * this module is display-only except that primary.canResume mirrors whether
 * suspended_at is already written.
 */
import {
  SUSPENSION_REASON_LICENSE_CLOCK_REGRESSED,
  SUSPENSION_REASON_LICENSE_EXPIRED,
  SUSPENSION_REASON_LICENSE_LEASE_INVALID,
  SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED,
  isRestaurantSuspended,
  normalizeOfflineGraceDays,
  type DeploymentMode,
} from '@mesa/shared';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Sole user-visible labels for installation phase / row status. */
export const INSTALLATION_STATUS_LABEL = {
  none: '未签发',
  pending: '待认领',
  claimed: '已认领',
  revoked: '已吊销',
} as const;

export type InstallationStatusKey = keyof typeof INSTALLATION_STATUS_LABEL;

/** Sole business open/paused nouns (actions may still say 暂停营业 / 恢复营业). */
export const BUSINESS_STATUS_LABEL = {
  open: '营业中',
  suspended: '已暂停',
} as const;

const SUSPENSION_REASON_LABEL: Record<string, string> = {
  [SUSPENSION_REASON_LICENSE_EXPIRED]: '授权到期',
  [SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED]: '离线超时',
  [SUSPENSION_REASON_LICENSE_CLOCK_REGRESSED]: '时钟异常',
  [SUSPENSION_REASON_LICENSE_LEASE_INVALID]: '授权凭证无效',
};

export type InstallPhase = 'none' | 'pending' | 'claimed';

export type OpsPrimaryBadge =
  | {
      kind: 'suspended';
      label: string;
      reasonLabel: string;
      /** True only when suspended_at is set — resume button allowed. */
      canResume: boolean;
      observationOnly: boolean;
    }
  | { kind: 'install'; phase: 'none' | 'pending'; label: string }
  | { kind: 'open'; label: string };

export type OpsLastOnline = {
  at: string;
  daysAgo: number;
  /** e.g. 最近在线：2026/8/2 19:09 · 0 天未在线 */
  line: string;
  tone: 'ok' | 'warn' | 'danger';
};

export type OpsLicenseHealth = {
  primary: OpsPrimaryBadge;
  installPhase: InstallPhase;
  lastOnline: OpsLastOnline | null;
  offlineGraceDays: number;
};

export function installationStatusLabel(status: string): string {
  return INSTALLATION_STATUS_LABEL[status as InstallationStatusKey] ?? status;
}

export function suspensionReasonLabel(reason: string | null | undefined): string {
  if (!reason) return '平台暂停';
  return SUSPENSION_REASON_LABEL[reason] ?? (reason.trim() ? reason : '平台暂停');
}

/** Sole user-visible primary line (includes observation suffix when needed). */
export function formatOpsPrimaryLabel(primary: OpsPrimaryBadge): string {
  if (primary.kind === 'suspended' && primary.observationOnly) {
    return `${primary.label}（观察）`;
  }
  return primary.label;
}

export function isOpsPrimarySuspended(health: OpsLicenseHealth): boolean {
  return health.primary.kind === 'suspended';
}

/** Sole gate: 营业中 (primary.kind === 'open') cannot be hard-deleted from Ops. */
export function isOpsRestaurantDeletable(health: OpsLicenseHealth): boolean {
  return health.primary.kind !== 'open';
}

export function resolveInstallPhase(input: {
  claimed: boolean;
  pending: boolean;
}): InstallPhase {
  if (input.claimed) return 'claimed';
  if (input.pending) return 'pending';
  return 'none';
}

function daysSince(iso: string, now: Date): number {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return 0;
  return Math.max(0, Math.floor((now.getTime() - ms) / MS_PER_DAY));
}

function formatLastOnlineLine(at: string, daysAgo: number): string {
  const when = new Date(at).toLocaleString('zh-CN');
  return `最近在线：${when} · ${daysAgo} 天未在线`;
}

/**
 * Single primary badge: suspended (with reason) > unfinished install > 营业中.
 * Healthy claimed+open does not also surface「已认领」as primary.
 */
export function resolveOpsLicenseHealth(input: {
  now?: Date;
  deploymentMode: DeploymentMode | string;
  suspendedAt: string | null | undefined;
  suspensionReason: string | null | undefined;
  licenseValidUntil: string | null | undefined;
  licenseCheckedAt: string | null | undefined;
  lastCheckinAt: string | null | undefined;
  installPhase: InstallPhase;
  offlineGraceDays?: unknown;
}): OpsLicenseHealth {
  const now = input.now ?? new Date();
  const onPrem = input.deploymentMode === 'on_prem';
  const graceDays = normalizeOfflineGraceDays(input.offlineGraceDays);
  const installPhase = onPrem ? input.installPhase : 'none';

  const onlineAt =
    (input.licenseCheckedAt && input.licenseCheckedAt.trim()) ||
    (input.lastCheckinAt && input.lastCheckinAt.trim()) ||
    null;

  let lastOnline: OpsLastOnline | null = null;
  if (onPrem && installPhase === 'claimed') {
    if (onlineAt) {
      const daysAgo = daysSince(onlineAt, now);
      let tone: OpsLastOnline['tone'] = 'ok';
      if (daysAgo >= graceDays) tone = 'danger';
      else if (daysAgo >= Math.max(1, Math.ceil(graceDays * 0.7))) tone = 'warn';
      lastOnline = {
        at: onlineAt,
        daysAgo,
        line: formatLastOnlineLine(onlineAt, daysAgo),
        tone,
      };
    } else {
      lastOnline = {
        at: '',
        daysAgo: graceDays,
        line: '最近在线：从未在线',
        tone: 'danger',
      };
    }
  }

  const dbSuspended = isRestaurantSuspended(input.suspendedAt);
  const pastValidUntil = (() => {
    if (!input.licenseValidUntil) return false;
    const untilMs = Date.parse(input.licenseValidUntil);
    return Number.isFinite(untilMs) && now.getTime() > untilMs;
  })();
  const offlineExceeded =
    onPrem &&
    installPhase === 'claimed' &&
    (lastOnline == null ||
      !lastOnline.at ||
      lastOnline.daysAgo >= graceDays);

  let primary: OpsPrimaryBadge;
  if (dbSuspended) {
    const reasonLabel = suspensionReasonLabel(input.suspensionReason);
    primary = {
      kind: 'suspended',
      label: `${BUSINESS_STATUS_LABEL.suspended} · ${reasonLabel}`,
      reasonLabel,
      canResume: true,
      observationOnly: false,
    };
  } else if (pastValidUntil) {
    const reasonLabel = suspensionReasonLabel(SUSPENSION_REASON_LICENSE_EXPIRED);
    primary = {
      kind: 'suspended',
      label: `${BUSINESS_STATUS_LABEL.suspended} · ${reasonLabel}`,
      reasonLabel,
      canResume: false,
      observationOnly: true,
    };
  } else if (offlineExceeded) {
    const reasonLabel = suspensionReasonLabel(SUSPENSION_REASON_LICENSE_OFFLINE_GRACE_EXCEEDED);
    primary = {
      kind: 'suspended',
      label: `${BUSINESS_STATUS_LABEL.suspended} · ${reasonLabel}`,
      reasonLabel,
      canResume: false,
      observationOnly: true,
    };
  } else if (onPrem && (installPhase === 'none' || installPhase === 'pending')) {
    primary = {
      kind: 'install',
      phase: installPhase,
      label: INSTALLATION_STATUS_LABEL[installPhase],
    };
  } else {
    primary = { kind: 'open', label: BUSINESS_STATUS_LABEL.open };
  }

  return {
    primary,
    installPhase,
    lastOnline,
    offlineGraceDays: graceDays,
  };
}
