import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type DealUpdatePayload = {
  evaluationStatus?: string;
};

function resolveMatchId(rawId: string): string | number {
  const numericId = Number(rawId);
  return Number.isFinite(numericId) && String(numericId) === rawId ? numericId : rawId;
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseServerClient();
    const matchId = resolveMatchId(params.id);
    const { error } = await supabase
      .schema('deals')
      .from('deals')
      .delete()
      .eq('id', matchId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Unable to delete deal.' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const payload = (await request.json()) as DealUpdatePayload;
    if (!payload.evaluationStatus) {
      return NextResponse.json(
        { error: 'evaluationStatus is required.' },
        { status: 400 }
      );
    }
    const allowedStatuses = new Set(['ACTIVE', 'MISSING_INFO', 'REJECTED']);
    if (!allowedStatuses.has(payload.evaluationStatus)) {
      return NextResponse.json(
        { error: 'evaluationStatus must be ACTIVE, MISSING_INFO, or REJECTED.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();
    const matchId = resolveMatchId(params.id);
    const { error } = await supabase
      .schema('deals')
      .from('deals')
      .update({
        evaluation_status: payload.evaluationStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', matchId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Unable to update deal.' },
      { status: 500 }
    );
  }
}
