// ========================================
// API: Check-in Close/Reopen
// POST /api/checkin-close
// ========================================
import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { guildId, userId, sessionId, action } = req.body

  if (!guildId || !userId || !sessionId || !action) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  try {
    const close = action === 'close'
    const reopen = action === 'reopen'

    if (!close && !reopen) {
      return res.status(400).json({ error: 'Action must be "close" or "reopen"' })
    }

    // Find active roll calls for this session
    const { data: rollCalls, error: rcError } = await supabase
      .from('roll_calls')
      .select('id')
      .eq('guild_id', guildId)
      .contains('war_session_ids', [sessionId])

    if (rcError) throw rcError

    if (rollCalls && rollCalls.length > 0) {
      const rollCallIds = rollCalls.map(rc => rc.id)
      
      if (close) {
        // Close all roll calls
        await supabase
          .from('roll_calls')
          .update({ closed_at: new Date().toISOString() })
          .in('id', rollCallIds)
          .is('closed_at', null)
      } else if (reopen) {
        // Reopen all roll calls
        await supabase
          .from('roll_calls')
          .update({ closed_at: null })
          .in('id', rollCallIds)
      }
    }

    res.status(200).json({ ok: true })
  } catch (error) {
    console.error('[checkin-close] Error:', error)
    res.status(500).json({ error: error.message })
  }
}
