export const dynamic = 'force-static';

const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#101826"/>
  <path d="M16 20h32v24H16z" fill="#34d399"/>
  <path d="M22 27l6 5-6 5" fill="none" stroke="#101826" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 38h10" fill="none" stroke="#101826" stroke-width="4" stroke-linecap="round"/>
</svg>`;

export function GET() {
  return new Response(icon, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
