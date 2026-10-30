import { NextResponse } from 'next/server';
import { loadWritableOperationalContext, menuApiError } from '@/lib/dashboard-menu-api';
import { setMenuItemImage } from '@/lib/dashboard-menu-server';
import { loadDishVideoGateRestaurant, resolveDishVideoAccess } from '@/lib/menu-dish-video-access';
import { loadPrincipalWithCapabilities } from '@/lib/permissions/principal';

export const runtime = 'nodejs';

interface Props {
  params: Promise<{ id: string }>;
}

function formFile(form: FormData, key: string): File | null {
  const entry = form.get(key);
  return entry instanceof File && entry.size > 0 ? entry : null;
}

export async function POST(req: Request, { params }: Props) {
  const ctx = await loadWritableOperationalContext('dashboard.menu.view');
  if (ctx instanceof NextResponse) return ctx;

  const { id } = await params;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }

  const stripImage = form.get('strip_image') === '1';
  const stripVideo = form.get('strip_video') === '1';
  const file = formFile(form, 'file');
  const videoDetail = formFile(form, 'video');
  const videoRail = formFile(form, 'rail_video');
  const videoEffect = form.get('video_effect');
  if ((videoDetail == null) !== (videoRail == null)) {
    return NextResponse.json({ error: 'invalid_video' }, { status: 400 });
  }
  const video =
    videoDetail && videoRail
      ? { detail: videoDetail, rail: videoRail, effect: typeof videoEffect === 'string' ? videoEffect : '' }
      : null;

  if (!stripImage && !file && !video && !stripVideo) {
    return NextResponse.json({ error: 'image_required' }, { status: 400 });
  }

  let canManageVideo = false;
  if (video || stripVideo) {
    const [restaurant, principal] = await Promise.all([
      loadDishVideoGateRestaurant(ctx.admin, ctx.restaurantId),
      loadPrincipalWithCapabilities(),
    ]);
    if (restaurant) {
      canManageVideo = (await resolveDishVideoAccess(restaurant, principal?.capabilities ?? null)).canManage;
    }
  }

  const result = await setMenuItemImage(ctx.admin, ctx.restaurantId, id, {
    file,
    stripImage,
    video,
    stripVideo,
    canManageVideo,
  });
  if ('error' in result) return menuApiError(result);
  return NextResponse.json({ item: result.item });
}
