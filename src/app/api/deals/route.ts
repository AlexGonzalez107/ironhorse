import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { mapDealRow } from '@/lib/supabase/mappers';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseServerClient();
    const { data, error } = await supabase
      .schema('deals')
      .from('deals')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deals: data.map(mapDealRow) });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Unable to load deals.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = getSupabaseServerClient();
    const { error } = await supabase
      .schema('deals')
      .from('deals')
      .delete()
      .not('id', 'is', null);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Unable to clear deals.' },
      { status: 500 }
    );
  }
}
