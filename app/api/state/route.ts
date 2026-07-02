import { NextResponse } from 'next/server';
import { getState } from '@/lib/vhost';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.json(await getState(url.searchParams.get('baseDir') || undefined));
}
