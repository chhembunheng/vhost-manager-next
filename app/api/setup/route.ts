import { NextResponse } from 'next/server';
import { saveSetup, setupState, type SetupFieldValues } from '@/lib/setup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json(await setupState());
}

export async function POST(request: Request) {
  const payload = (await request.json()) as SetupFieldValues;
  const result = await saveSetup(payload);
  return NextResponse.json({ ...result, state: await setupState() });
}
