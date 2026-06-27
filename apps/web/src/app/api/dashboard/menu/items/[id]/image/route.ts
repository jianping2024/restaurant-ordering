import { NextResponse } from 'next/server';
import { loadWritableMenuContext, menuApiError } from '@/lib/dashboard-menu-api';
import { setMenuItemImage } from '@/lib/dashboard-menu-server';

export const runtime = 'nodejs';

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, { params }: Props) {
  const ctx = await loadWritableMenuContext();
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const stripImage = form.get('strip_image') === '1';
  const fileEntry = form.get('file');
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;

  if (!stripImage && !file) {
    return NextResponse.json({ error: 'image_required' }, { status: 400 });
  }

  const result = await setMenuItemImage(ctx.admin, ctx.restaurantId, id, file, stripImage);
  if ('error' in result) return menuApiError(result);
  return NextResponse.json({ item: result.item });
}
