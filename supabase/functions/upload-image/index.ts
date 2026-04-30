// Deploy:  supabase functions deploy upload-image
import 'https://deno.land/x/xhr@0.3.0/mod.ts';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method', { status: 405 });
  const accountId = Deno.env.get('CF_ACCOUNT_ID')!;
  const token     = Deno.env.get('CF_IMAGES_TOKEN')!;
  const variant   = Deno.env.get('CF_IMAGE_VARIANT') ?? 'public';

  const form = await req.formData();
  const file = form.get('file');
  if (!file || !(file instanceof File)) return new Response('No file', { status: 400 });

  const cfForm = new FormData();
  cfForm.append('file', file);

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/images/v1`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: cfForm },
  );
  const cfJson = await cfRes.json();
  if (!cfJson.success) return new Response(JSON.stringify(cfJson.errors), { status: 500 });

  const variants: string[] = cfJson.result.variants || [];
  const url = variants.find((v) => v.endsWith('/' + variant)) || variants[0];
  return new Response(JSON.stringify({ url }), { headers: { 'Content-Type': 'application/json' } });
});
