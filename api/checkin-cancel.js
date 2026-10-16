// ========================================
// API: Check-in Cancel
// POST /api/checkin-cancel
// ========================================
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { guildId, userId, sessionId } = req.body

  if (!guildId || !userId || !sessionId) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    // Find active roll calls for this session
    const { data: rollCalls, error: rcError } = await supabase
      .from('roll_calls')
      .select('id')
      .eq('guild_id', guildId)
      .contains('war_session_ids', [sessionId])
      .is('closed_at', null)

    if (rcError) throw rcError

    if (rollCalls && rollCalls.length > 0) {
      const rollCallIds = rollCalls.map(rc => rc.id)
      
      // Delete user's responses
      await supabase
        .from('roll_call_responses')
        .delete()
        .in('roll_call_id', rollCallIds)
        .eq('player_id', userId)
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('[checkin-cancel] Error:', error)
    res.status(500).json({ error: error.message })
  }
}
