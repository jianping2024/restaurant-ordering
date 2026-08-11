import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import type { PremiumKey } from '@mesa/shared';
import type { PremiumGateResult, PremiumLoaderError } from '@/lib/premium/access';

export type LoaderError = {
  error: string;
  status: number;
  premiumKey?: PremiumKey;
  message?: string;
};

export function redirectIfPremiumRequired(gate: PremiumGateResult): void {
  if (gate.ok) return;
  redirect(`/dashboard/upgrade?feature=${encodeURIComponent(gate.premiumKey)}`);
}

export function redirectForLoaderError(ctx: LoaderError): never {
  if (ctx.status === 401) redirect('/auth/login');
  if (ctx.error === 'pro_required' && ctx.premiumKey) {
    redirect(`/dashboard/upgrade?feature=${encodeURIComponent(ctx.premiumKey)}`);
  }
  redirect('/dashboard');
}

export function premiumApiError(gate: PremiumGateResult) {
  if (gate.ok) return null;
  return {
    status: 403 as const,
    body: {
      error: 'pro_required' as const,
      feature: gate.premiumKey,
    },
  };
}

export function jsonForLoaderError(ctx: LoaderError) {
  if (ctx.error === 'pro_required' && ctx.premiumKey) {
    return NextResponse.json(
      { error: 'pro_required', feature: ctx.premiumKey },
      { status: 403 },
    );
  }
  return NextResponse.json(
    { error: ctx.error, ...(ctx.message ? { message: ctx.message } : {}) },
    { status: ctx.status },
  );
}

export function isPremiumLoaderError(ctx: LoaderError): ctx is PremiumLoaderError {
  return ctx.error === 'pro_required' && ctx.status === 403 && Boolean(ctx.premiumKey);
}
