import { sessionToken } from '@/lib/auth';
import { tx } from '@/lib/db';
import { isUuid } from '@/lib/queries';
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; if (!isUuid(id)) return new Response(null, { status: 404 });
  const token = await sessionToken();
  const [b] = await tx(token, (q) => q('select * from event_banner($1)', [id]));
  if (!b) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(b.data), { headers: { 'content-type': b.mime, 'cache-control': token ? 'private, max-age=60' : 'public, max-age=86400', 'content-disposition': 'inline', 'content-security-policy': "default-src 'none'" } });
}
