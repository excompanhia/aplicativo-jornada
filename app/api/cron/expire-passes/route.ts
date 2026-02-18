import { NextResponse } from 'next/server'
import { getSupabaseAdmin } from '@/app/lib/supabaseAdmin'

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const now = new Date().toISOString()

    const { error } = await supabaseAdmin
      .from('passes')
      .update({ status: 'expired_without_start' })
      .eq('status', 'purchased_not_started')
      .lt('start_deadline', now)

    if (error) {
      console.error('Expire job error:', error)
      return NextResponse.json({ ok: false }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Unexpected error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
