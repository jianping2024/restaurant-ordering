import { NextResponse } from 'next/server';
import {
  DEPENDENCY_UNAVAILABLE,
  isDependencyFailure,
} from '@/lib/dependency-unavailable';

export function dependencyUnavailableJsonResponse(): NextResponse {
  return NextResponse.json({ error: DEPENDENCY_UNAVAILABLE }, { status: 503 });
}

/** Map transport/gateway failures to 503; rethrow unexpected errors. */
export function responseForCaughtDependency(err: unknown): NextResponse | null {
  if (!isDependencyFailure(err)) return null;
  return dependencyUnavailableJsonResponse();
}
