import { spawn } from 'node:child_process';
import { commandFromPayload } from '@/lib/vhost';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const encoder = new TextEncoder();

function line(text: string) {
  return encoder.encode(text);
}

export async function POST(request: Request) {
  const payload = (await request.json()) as Record<string, unknown>;
  const prepared = await commandFromPayload(payload);

  if (prepared.errors.length > 0) {
    return new Response(`${prepared.errors.join('\n')}\n__VHOST_EXIT_CODE:1\n`, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(line('Starting...\n'));

      const [command, ...args] = prepared.command;
      const child = spawn(command, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '0' },
      });

      child.stdout.on('data', (chunk: Buffer) => controller.enqueue(chunk));
      child.stderr.on('data', (chunk: Buffer) => controller.enqueue(chunk));
      child.on('error', (error) => {
        controller.enqueue(line(`${error.message}\n__VHOST_EXIT_CODE:1\n`));
        controller.close();
      });
      child.on('close', (code) => {
        controller.enqueue(line(`\n__VHOST_EXIT_CODE:${code ?? 1}\n`));
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Accel-Buffering': 'no',
    },
  });
}
