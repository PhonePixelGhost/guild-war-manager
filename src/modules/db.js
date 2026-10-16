// ========================================
// Database Module - Free Version
// All features unlocked, no plan checks
// ========================================
import { supabase } from '../lib/supabase'

// Limits - everyone gets the max (no plan differentiation)
export const LIMITS = {
  players: 200,
  sessions: Infinity,
  members: Infinity,
  historyDays: 180
}

// Check if player limit reached
export function canAddPlayer(currentCount) {
  return currentCount < LIMITS.players
}

// Check if session limit reached
export function canAddSession(currentCount) {
  return currentCount < LIMITS.sessions
}

// Get history cutoff date
export function getHistoryCutoffDate() {
  const date = new Date()
  date.setDate(date.getDate() - LIMITS.historyDays)
  return date
}

// ========================================
// Players
// ========================================

export async function getPlayers(guildId) {
  const { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('guild_id', guildId)
    .is('deleted_at', null)
    .order('created_at')
  
  if (error || !data) return []
  return data.map(p => ({
    id: p.id,
    name: p.name,
    classId: p.class_id,
    note: p.note,
    createdAt: p.created_at
  }))
}

export async function savePlayer(player, guildId) {
  const { error } = await supabase
    .from('players')
    .upsert({
      id: player.id,
      name: player.name,
      class_id: player.classId,
      guild_id: guildId,
      note: player.note ?? null
    })
  
  if (error) {
    if (error.message?.includes('PLAN_LIMIT')) {
      throw new Error('Player limit reached for this plan.')
    }
    throw new Error(`Save player failed: ${error.message}`)
  }
}

export async function deletePlayer(playerId) {
  const { error, count } = await supabase
    .from('players')
    .update({ deleted_at: new Date().toISOString() }, { count: 'exact' })
    .eq('id', playerId)
    .is('deleted_at', null)
  
  if (error) throw new Error(`Delete player failed: ${error.message}`)
  if (count === 0) throw new Error('Delete player failed: permission denied or not found')
}

export async function restorePlayer(playerId) {
  const { error } = await supabase
    .from('players')
    .update({ deleted_at: null })
    .eq('id', playerId)
    .not('deleted_at', 'is', null)
  
  if (error) throw new Error(`Restore player failed: ${error.message}`)
}

export async function getDeletedPlayers(guildId) {
  const { data, error } = await supabase
    .from('players')
    .select('id, name, class_id, deleted_at')
    .eq('guild_id', guildId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  
  if (error || !data) return []
  return data.map(p => ({
    id: p.id,
    name: p.name,
    classId: p.class_id,
    deletedAt: p.deleted_at
  }))
}

// ========================================
// War Sessions
// ========================================

export async function getWarSessions(guildId) {
  const since = getHistoryCutoffDate().toISOString().slice(0, 10)
  
  // Load sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from('war_sessions')
    .select('*')
    .eq('guild_id', guildId)
    .gte('date', since)
    .order('date')
  
  if (sessionsError || !sessions) return null
  
  // Load groups for all sessions
  const sessionIds = sessions.map(s => s.id)
  const { data: groupsData } = await supabase
    .from('groups')
    .select('*')
    .eq('guild_id', guildId)
    .in('session_id', sessionIds)
    .order('sort_order')
    .order('id')
  
  // Load battle stats
  const { data: statsData } = await supabase
    .from('battle_stats')
    .select('*')
    .eq('guild_id', guildId)
    .in('session_id', sessionIds)
    .order('session_id')
    .order('player_id')
  
  // Load settings
  const { data: settingsData } = await supabase
    .from('settings')
    .select('*')
    .eq('guild_id', guildId)
  
  // Organize data
  const statsByVersion = {}
  for (const stat of statsData || []) {
    if (!statsByVersion[stat.session_id]) statsByVersion[stat.session_id] = {}
    statsByVersion[stat.session_id][stat.player_id] = stat.data || {
      kills: stat.kills ?? 0,
      humanDmg: stat.human_dmg ?? 0,
      towerDmg: stat.tower_dmg ?? 0,
      healPts: stat.heal_pts ?? 0,
      resourcePts: stat.resource_pts ?? 0,
      receiveDmg: stat.receive_dmg ?? 0,
      revivePts: stat.revive_pts ?? 0,
      deaths: stat.deaths ?? 0,
      assists: stat.assists ?? 0
    }
  }
  
  const groupsBySession = {}
  for (const group of groupsData || []) {
    if (!groupsBySession[group.session_id]) groupsBySession[group.session_id] = []
    groupsBySession[group.session_id].push({
      id: group.id,
      name: group.name,
      section: group.section,
      memberIds: group.member_ids ?? []
    })
  }
  
  const playerIds = new Set(sessions.flatMap(s => [
    ...(s.leave_player_ids || []),
    ...(s.absent_player_ids || []),
    ...(s.confirmed_player_ids || [])
  ]))
  
  const formattedSessions = sessions.map(session => ({
    id: session.id,
    date: session.date,
    label: session.label,
    warType: session.war_type,
    leavePlayerIds: session.leave_player_ids ?? [],
    absentPlayerIds: session.absent_player_ids ?? [],
    confirmedPlayerIds: session.confirmed_player_ids ?? [],
    playerRoleTags: session.player_role_tags ?? {},
    playerSkillTags: session.player_skill_tags ?? {},
    sectionOverrides: session.section_overrides ?? [],
    result: session.result,
    shareToken: session.share_token,
    leaveToken: session.leave_token,
    groups: groupsBySession[session.id] || [],
    stats: statsByVersion[session.id] || {}
  }))
  
  const currentSessionId = settingsData?.find(s => s.key === 'current_session_id')?.value 
    || formattedSessions[formattedSessions.length - 1]?.id 
    || ''
  
  return {
    sessions: formattedSessions,
    currentSessionId,
    sessionOrder: []
  }
}

export async function saveWarSession(session, guildId) {
  const { error } = await supabase
    .from('war_sessions')
    .upsert({
      id: session.id,
      date: session.date,
      label: session.label,
      war_type: session.warType,
      leave_player_ids: session.leavePlayerIds,
      absent_player_ids: session.absentPlayerIds ?? [],
      player_role_tags: session.playerRoleTags ?? {},
      player_skill_tags: session.playerSkillTags ?? {},
      section_overrides: session.sectionOverrides ?? {},
      result: session.result ?? null,
      player_snapshot: session.playerSnapshot ?? null,
      guild_id: guildId,
      share_token: session.shareToken ?? null,
      leave_token: session.leaveToken ?? null
    })
  
  if (error) {
    if (error.message?.includes('RATE_LIMIT')) {
      throw new Error('Rate limit: max 20 new war sessions per day. Please try again tomorrow.')
    }
    if (error.message?.includes('PLAN_LIMIT')) {
      throw new Error('War limit reached for this plan.')
    }
    throw new Error(`Save session failed: ${error.message}`)
  }
  
  // Save groups
  if (session.groups.length > 0) {
    const groupIds = session.groups.map(g => g.id)
    
    // Delete stale groups
    await supabase
      .from('groups')
      .delete()
      .eq('session_id', session.id)
      .eq('guild_id', guildId)
      .not('id', 'in', `(${groupIds.join(',')})`)
    
    // Upsert current groups
    const { error: groupsError } = await supabase
      .from('groups')
      .upsert(session.groups.map((group, index) => ({
        id: group.id,
        session_id: session.id,
        name: group.name,
        section: group.section,
        member_ids: group.memberIds,
        sort_order: index,
        guild_id: guildId
      })), { onConflict: 'id,session_id' })
    
    if (groupsError) throw new Error(`Save groups failed: ${groupsError.message}`)
  }
}

export async function deleteWarSession(sessionId) {
  const { error } = await supabase
    .from('war_sessions')
    .delete()
    .eq('id', sessionId)
  
  if (error) throw new Error(`Delete session failed: ${error.message}`)
}

export async function setCurrentSessionId(sessionId, guildId) {
  await supabase
    .from('settings')
    .upsert({
      key: 'current_session_id',
      value: sessionId,
      guild_id: guildId
    }, { onConflict: 'key,guild_id' })
}

export async function setSessionOrder(order, guildId) {
  await supabase
    .from('settings')
    .upsert({
      key: 'session_order',
      value: JSON.stringify(order),
      guild_id: guildId
    }, { onConflict: 'key,guild_id' })
}

// ========================================
// Battle Stats
// ========================================

export async function saveBattleStats(sessionId, playerId, stats, guildId) {
  const { data, error } = await supabase
    .from('battle_stats')
    .upsert({
      session_id: sessionId,
      player_id: playerId,
      data: stats,
      guild_id: guildId
    }, { onConflict: 'session_id,player_id' })
    .select('updated_at')
    .single()
  
  if (error) throw new Error(`Save stats failed: ${error.message}`)
  return data?.updated_at ?? null
}

export async function saveBattleStatsCAS(sessionId, playerId, stats, guildId, expectedVersion) {
  const { data, error } = await supabase.rpc('save_stats_cas', {
    p_session_id: sessionId,
    p_player_id: playerId,
    p_data: stats,
    p_guild_id: guildId,
    p_expected: expectedVersion
  })
  
  if (error) throw new Error(`Save stats failed: ${error.message}`)
  
  const result = Array.isArray(data) ? data[0] : data
  return result ? {
    ok: result.ok,
    version: result.version,
    serverData: result.server_data
  } : { ok: false, version: null, serverData: null }
}

// ========================================
// Share/Leave Tokens
// ========================================

export async function generateShareToken(sessionId, guildId) {
  const token = crypto.randomUUID()
  const { error } = await supabase
    .from('war_sessions')
    .update({ share_token: token })
    .eq('id', sessionId)
    .eq('guild_id', guildId)
  
  return error ? null : token
}

export async function revokeShareToken(sessionId, guildId) {
  await supabase
    .from('war_sessions')
    .update({ share_token: null })
    .eq('id', sessionId)
    .eq('guild_id', guildId)
}

export async function generateLeaveToken(sessionId, guildId) {
  const token = crypto.randomUUID()
  const { error } = await supabase
    .from('war_sessions')
    .update({ leave_token: token })
    .eq('id', sessionId)
    .eq('guild_id', guildId)
  
  return error ? null : token
}

export async function revokeLeaveToken(sessionId, guildId) {
  await supabase
    .from('war_sessions')
    .update({ leave_token: null })
    .eq('id', sessionId)
    .eq('guild_id', guildId)
}

// ========================================
// Activity Log
// ========================================

export async function logPlayerActivity(guildId, playerId, playerName, classId, action, actorName, newValue) {
  await supabase
    .from('player_activity_log')
    .insert({
      guild_id: guildId,
      player_id: playerId,
      player_name: playerName,
      class_id: classId,
      action: action,
      actor_name: actorName ?? null,
      new_value: newValue ?? null
    })
}

export async function getActivityLog(guildId, limit = 200) {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  
  const { data, error } = await supabase
    .from('player_activity_log')
    .select('*')
    .eq('guild_id', guildId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error || !data) return []
  return data.map(entry => ({
    id: entry.id,
    playerId: entry.player_id,
    playerName: entry.player_name,
    classId: entry.class_id,
    action: entry.action,
    actorName: entry.actor_name,
    newValue: entry.new_value,
    createdAt: entry.created_at
  }))
}

// ========================================
// Roll Calls (Check-in)
// ========================================

export async function getRollCallResponses(sessionId, guildId) {
  const { data: rollCalls, error } = await supabase
    .from('roll_calls')
    .select('id')
    .eq('guild_id', guildId)
    .contains('war_session_ids', [sessionId])
  
  if (error || !rollCalls || rollCalls.length === 0) return []
  
  const rollCallIds = rollCalls.map(rc => rc.id)
  
  const { data: responses, error: respError } = await supabase
    .from('roll_call_responses')
    .select('player_id, response, responded_by_discord_user_id, responded_at')
    .in('roll_call_id', rollCallIds)
    .order('responded_at', { ascending: false })
  
  if (respError || !responses) return []
  
  const seen = new Set()
  const unique = []
  for (const resp of responses) {
    if (!seen.has(resp.player_id)) {
      seen.add(resp.player_id)
      unique.push({
        playerId: resp.player_id,
        response: resp.response,
        respondedByDiscordUserId: resp.responded_by_discord_user_id,
        respondedAt: resp.responded_at
      })
    }
  }
  
  return unique
}

export async function getRollCallStatus(sessionId, guildId) {
  const { data, error } = await supabase
    .from('roll_calls')
    .select('closed_at')
    .eq('guild_id', guildId)
    .contains('war_session_ids', [sessionId])
  
  if (error) {
    console.error('[db] getRollCallStatus failed:', error)
    return { active: false, ended: false }
  }
  
  const rollCalls = data ?? []
  if (rollCalls.length === 0) return { active: false, ended: false }
  
  return {
    active: true,
    ended: rollCalls.every(rc => rc.closed_at !== null)
  }
}

export async function cancelCheckin(guildId, userId, sessionId) {
  const apiUrl = import.meta.env.VITE_API_URL
  const response = await fetch(`${apiUrl}/api/checkin-cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guildId, userId, sessionId })
  })
  
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    if (response.status === 404) {
      throw new Error('API ไม่พบ — เปิด .env.local แล้วเพิ่ม VITE_API_URL=http://localhost:PORT')
    }
    let message = 'Failed to cancel check-in'
    try { message = JSON.parse(text).error ?? message } catch {}
    throw new Error(`[${response.status}] ${message}`)
  }
}

export async function closeCheckin(guildId, userId, sessionId, close = true) {
  const apiUrl = import.meta.env.VITE_API_URL
  const response = await fetch(`${apiUrl}/api/checkin-close`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guildId, userId, sessionId, action: close ? 'close' : 'reopen' })
  })
  
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    if (response.status === 404) {
      throw new Error('API ไม่พบ — เปิด .env.local แล้วเพิ่ม VITE_API_URL=http://localhost:PORT')
    }
    let message = 'Failed to update check-in'
    try { message = JSON.parse(text).error ?? message } catch {}
    throw new Error(`[${response.status}] ${message}`)
  }
}
