// ========================================
// Guild Module - Free Version
// All plan limits removed
// ========================================
import { supabase } from '../lib/supabase'

// No plan limits - everyone gets max
export const LIMITS = {
  players: 200,
  sessions: Infinity,
  members: Infinity,
  historyDays: 180
}

// Role hierarchy
export const ROLES = {
  LEADER: 'leader',
  COMMANDER: 'commander',
  PARTY_LEADER: 'party_leader',
  MEMBER: 'member'
}

// Permissions - all features unlocked
export const PERMISSIONS = {
  [ROLES.LEADER]: [
    'view_active_wars',
    'view_stats',
    'manage_wars',
    'arrange_party',
    'edit_stats',
    'ocr_import',
    'manage_checkin',
    'manage_players',
    'edit_guild',
    'manage_members'
  ],
  [ROLES.COMMANDER]: [
    'view_active_wars',
    'view_stats',
    'manage_wars',
    'arrange_party',
    'edit_stats',
    'ocr_import',
    'manage_checkin',
    'manage_players',
    'edit_guild',
    'manage_members'
  ],
  [ROLES.PARTY_LEADER]: [
    'view_active_wars',
    'view_stats',
    'edit_stats',
    'ocr_import',
    'manage_checkin',
    'manage_players'
  ],
  [ROLES.MEMBER]: [
    'view_active_wars',
    'view_stats'
  ]
}

// Get user's guilds
export async function getMyGuilds() {
  const { data, error } = await supabase.rpc('get_my_guilds')
  if (error) {
    console.error('[getMyGuilds] Error:', error)
    return []
  }
  return data || []
}

// Create a new guild
export async function createGuild(name, gameConfigId = 'SOJ') {
  const { data, error } = await supabase.rpc('create_guild', {
    p_name: name,
    p_game_config_id: gameConfigId
  })
  if (error) throw new Error(error.message)
  return data
}

// Get guild members
export async function getGuildMembers(guildId) {
  const { data, error } = await supabase.rpc('get_guild_members', {
    p_guild_id: guildId
  })
  if (error) {
    console.error('[getGuildMembers] Error:', error)
    return []
  }
  return data || []
}

// Set member role
export async function setMemberRole(guildId, userId, role) {
  const { data, error } = await supabase.rpc('set_member_role', {
    p_guild_id: guildId,
    p_user_id: userId,
    p_role: role
  })
  if (error) throw new Error(error.message)
  if (data === 'forbidden') throw new Error('คุณไม่มีสิทธิ์เปลี่ยน role ของสมาชิกคนนี้')
  if (data !== 'ok') throw new Error('เปลี่ยน role ไม่สำเร็จ')
}

// Set member nickname
export async function setMemberNickname(guildId, userId, nickname) {
  const { data, error } = await supabase.rpc('set_member_nickname', {
    p_guild_id: guildId,
    p_user_id: userId,
    p_nickname: nickname
  })
  if (error) throw new Error(error.message)
  if (data === 'forbidden') throw new Error('ไม่มีสิทธิ์แก้ชื่อเล่นของสมาชิกคนนี้')
  if (data !== 'ok') throw new Error('ตั้งชื่อเล่นไม่สำเร็จ')
}

// Kick member
export async function kickMember(guildId, userId) {
  const { data, error } = await supabase.rpc('kick_member', {
    p_guild_id: guildId,
    p_user_id: userId
  })
  if (error) throw new Error(error.message)
  if (data === 'forbidden') throw new Error('คุณไม่มีสิทธิ์เตะสมาชิกคนนี้')
  if (data !== 'ok') throw new Error('เตะสมาชิกไม่สำเร็จ')
}

// Leave guild
export async function leaveGuild(guildId) {
  const { data, error } = await supabase.rpc('leave_guild', {
    p_guild_id: guildId
  })
  if (error) throw new Error(error.message)
}

// Delete guild (leader only)
export async function deleteGuild(guildId) {
  const { data, error } = await supabase.rpc('delete_own_guild', {
    p_guild_id: guildId
  })
  if (error) throw new Error(error.message)
  if (data === 'forbidden') throw new Error('เฉพาะเจ้าของกิลด์เท่านั้นที่ลบได้')
  if (data !== 'ok') throw new Error('ลบกิลด์ไม่สำเร็จ')
}

// Create invite link
export async function createInviteLink(guildId) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user) throw new Error('Not authenticated')
  
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  
  const { data, error } = await supabase
    .from('guild_invites')
    .insert({
      guild_id: guildId,
      created_by: session.user.id,
      expires_at: expiresAt,
      max_uses: null
    })
    .select('token')
    .single()
  
  if (error || !data) throw new Error(error?.message || 'Failed to create invite')
  
  return `${window.location.origin}/join?token=${data.token}`
}

// Redeem invite
export async function redeemInvite(token) {
  const { data, error } = await supabase.rpc('redeem_invite', { p_token: token })
  if (error) throw new Error(error.message)
  
  const result = data?.[0]
  if (!result) throw new Error('Invite link ไม่ถูกต้อง')
  
  switch (result.status) {
    case 'already_member':
      return { status: 'already_member', guildId: result.out_guild_id }
    case 'joined':
      return { status: 'joined', guildId: result.out_guild_id, guildName: result.out_guild_name }
    case 'expired':
      throw new Error('Invite link หมดอายุแล้ว')
    case 'guild_full':
      throw new Error('กิลด์นี้มีสมาชิกครบแล้ว')
    default:
      throw new Error('Invite link ไม่ถูกต้อง')
  }
}

// Get pending join requests
export async function getPendingJoinRequests(guildId) {
  const { data, error } = await supabase.rpc('get_pending_join_requests', {
    p_guild_id: guildId
  })
  if (error || !data) return []
  return data.map(req => ({
    userId: req.user_id,
    email: req.email,
    avatarUrl: req.avatar_url,
    providerName: req.provider_name,
    usernameHandle: req.username_handle,
    requestedAt: req.requested_at
  }))
}

// Approve join request
export async function approveJoinRequest(guildId, userId) {
  const { data, error } = await supabase.rpc('approve_join_request', {
    p_guild_id: guildId,
    p_user_id: userId
  })
  if (error) throw new Error(error.message)
  if (data === 'forbidden') throw new Error('คุณไม่มีสิทธิ์อนุมัติคำขอเข้ากิลด์')
  if (data === 'guild_full') throw new Error('กิลด์นี้มีสมาชิกครบแล้ว')
  if (data !== 'ok') throw new Error('อนุมัติไม่สำเร็จ')
}

// Reject join request
export async function rejectJoinRequest(guildId, userId) {
  const { data, error } = await supabase.rpc('reject_join_request', {
    p_guild_id: guildId,
    p_user_id: userId
  })
  if (error) throw new Error(error.message)
  if (data === 'forbidden') throw new Error('คุณไม่มีสิทธิ์ปฏิเสธคำขอเข้ากิลด์')
  if (data !== 'ok') throw new Error('ปฏิเสธไม่สำเร็จ')
}

// Get my pending request
export async function getMyPendingRequest() {
  const { data, error } = await supabase.rpc('get_my_pending_request')
  if (error || !data) return null
  const req = data[0]
  return req ? {
    guildId: req.guild_id,
    guildName: req.guild_name,
    requestedAt: req.requested_at
  } : null
}

// Set display name
export async function setMyDisplayName(displayName) {
  const { error } = await supabase.rpc('set_my_display_name', {
    p_display_name: displayName
  })
  if (error) throw new Error(error.message)
}

// Get display name
export async function getMyDisplayName() {
  const { data, error } = await supabase.rpc('get_my_display_name')
  if (error) return null
  return data
}

// Get my nickname in guild
export async function getMyNicknameInGuild(guildId) {
  const { data, error } = await supabase.rpc('get_my_nickname_in_guild', {
    p_guild_id: guildId
  })
  if (error) return null
  return data
}
