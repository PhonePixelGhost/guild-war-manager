import React, { createContext, useContext, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { getMyGuilds, getMyPendingRequest } from './modules/guild'
import { PERMISSIONS } from './modules/guild'

// ========================================
// Auth Context - Free Version
// No plan/subscription checks
// ========================================
const AuthContext = createContext({
  session: null,
  user: null,
  guild: null,
  guilds: [],
  loading: true,
  avatarUrl: null,
  pendingJoinRequest: null,
  permissions: PERMISSIONS.member,
  permissionsLoaded: true,
  refreshGuild: async () => {},
  switchGuild: () => {}
})

export function useAuth() {
  return useContext(AuthContext)
}

// ========================================
// Auth Provider
// ========================================
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [guild, setGuild] = useState(null)
  const [guilds, setGuilds] = useState([])
  const [loading, setLoading] = useState(true)
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [pendingJoinRequest, setPendingJoinRequest] = useState(null)
  const [selectedGuildId, setSelectedGuildId] = useState(() => localStorage.getItem('gpm_selected_guild_id'))
  const [permissions, setPermissions] = useState(PERMISSIONS.member)
  const [permissionsLoaded, setPermissionsLoaded] = useState(true)

  useEffect(() => {
    let mounted = false

    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!mounted) {
        await handleSession(session)
        setLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) return
      if (event === 'SIGNED_OUT' || !session?.user) {
        setSession(null)
        setUser(null)
        setGuild(null)
        setGuilds([])
        setAvatarUrl(null)
        setPendingJoinRequest(null)
        setPermissions(PERMISSIONS.member)
        return
      }
      if (session.user.id === user?.id) {
        setSession(session)
        setUser(session.user)
        return
      }
      setTimeout(async () => {
        if (!mounted) await handleSession(session)
      }, 0)
    })

    return () => {
      mounted = true
      subscription.unsubscribe()
    }
  }, [])

  const handleSession = async (session) => {
    if (!session?.user) {
      setSession(null)
      setUser(null)
      setGuilds([])
      setGuild(null)
      return
    }

    setSession(session)
    setUser(session.user)
    setAvatarUrl(session.user.user_metadata?.avatar_url)

    // Load guilds
    const guildsList = await getMyGuilds()
    setGuilds(guildsList)

    // Check pending join request
    const pendingReq = await getMyPendingRequest()
    if (pendingReq) setPendingJoinRequest(pendingReq)

    // Select guild
    if (guildsList.length > 0) {
      const savedGuild = guildsList.find(g => g.id === selectedGuildId)
      const currentGuild = savedGuild || guildsList[0]
      setGuild(currentGuild)
      setSelectedGuildId(currentGuild.id)
      localStorage.setItem('gpm_selected_guild_id', currentGuild.id)
      setPermissions(PERMISSIONS[currentGuild.role] || PERMISSIONS.member)
    }

    setPermissionsLoaded(true)
  }

  const refreshGuild = async () => {
    if (user && guild) {
      const guildsList = await getMyGuilds()
      setGuilds(guildsList)
      const updatedGuild = guildsList.find(g => g.id === guild.id)
      if (updatedGuild) {
        setGuild(updatedGuild)
        setPermissions(PERMISSIONS[updatedGuild.role] || PERMISSIONS.member)
      }
    }
  }

  const switchGuild = (guildId) => {
    const newGuild = guilds.find(g => g.id === guildId)
    if (newGuild) {
      setGuild(newGuild)
      setSelectedGuildId(guildId)
      localStorage.setItem('gpm_selected_guild_id', guildId)
      setPermissions(PERMISSIONS[newGuild.role] || PERMISSIONS.member)
    }
  }

  return (
    <AuthContext.Provider value={{
      session,
      user,
      guild,
      guilds,
      loading,
      avatarUrl,
      pendingJoinRequest,
      permissions,
      permissionsLoaded,
      refreshGuild,
      switchGuild
    }}>
      {children}
    </AuthContext.Provider>
  )
}

// ========================================
// Protected Route
// ========================================
function ProtectedRoute({ children }) {
  const { user, guild, pendingJoinRequest, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    
    // Check for invite token in sessionStorage
    const inviteToken = sessionStorage.getItem('gpm_invite_token')
    if (inviteToken) {
      navigate(`/join?token=${inviteToken}`, { replace: true })
      return
    }
    
    const bundleToken = sessionStorage.getItem('gpm_invite_bundle_token')
    if (bundleToken) {
      navigate(`/join?bundle=${bundleToken}`, { replace: true })
      return
    }

    if (!guild) {
      navigate(pendingJoinRequest ? '/join' : '/onboarding', { replace: true })
      return
    }

    navigate('/overview', { replace: true })
  }, [loading, user, guild, pendingJoinRequest])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-game-grid">
        <div className="text-slate-600 text-xs animate-pulse uppercase tracking-[0.3em]">
          Authenticating...
        </div>
      </div>
    )
  }

  return children
}

// ========================================
// App Routes - Free Version
// All routes accessible, no billing
// ========================================
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
          <Route path="/join" element={<JoinGuildPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          
          {/* Protected Routes - All features unlocked */}
          <Route path="/overview" element={<ProtectedRoute><OverviewPage /></ProtectedRoute>} />
          <Route path="/wars" element={<ProtectedRoute><WarsPage /></ProtectedRoute>} />
          <Route path="/war/:sessionId" element={<ProtectedRoute><WarDetailPage /></ProtectedRoute>} />
          <Route path="/players" element={<ProtectedRoute><PlayersPage /></ProtectedRoute>} />
          <Route path="/stats" element={<ProtectedRoute><StatsPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="/profile/setup" element={<ProtectedRoute><ProfileSetupPage /></ProtectedRoute>} />
          
          {/* Redirects */}
          <Route path="/home" element={<Navigate to="/overview" replace />} />
          
          {/* Public shared pages */}
          <Route path="/w/:token" element={<PublicStatsPage />} />
          <Route path="/l/:token" element={<PublicLeavePage />} />
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

// ========================================
// Placeholder Components
// Replace with your actual page components
// ========================================

function LandingPage() {
  return (
    <div className="min-h-screen bg-game-grid flex items-center justify-center">
      <h1 className="text-4xl font-bold text-amber-500">Guild War Manager</h1>
      <p className="text-slate-400 mt-4">จัดทีมสงครามกิลด์ จัดปาร์ตี้ด้วย Drag & Drop</p>
      <a href="/login" className="mt-6 px-6 py-3 bg-amber-500 text-black rounded-lg font-bold">
        Sign In with Discord
      </a>
    </div>
  )
}

function LoginPage() {
  const navigate = useNavigate()

  const signInWithDiscord = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) console.error('Discord login error:', error)
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    })
    if (error) console.error('Google login error:', error)
  }

  return (
    <div className="min-h-screen bg-game-grid flex items-center justify-center">
      <div className="bg-slate-800 p-8 rounded-lg max-w-md w-full">
        <h1 className="text-2xl font-bold text-amber-500 mb-6">Guild War Manager</h1>
        <p className="text-slate-400 mb-6">Guild War Party Management — Assemble & Conquer</p>
        
        <button
          onClick={signInWithDiscord}
          className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold mb-3 hover:bg-indigo-700"
        >
          Sign in with Discord
        </button>
        
        <button
          onClick={signInWithGoogle}
          className="w-full py-3 bg-white text-gray-800 rounded-lg font-bold hover:bg-gray-100"
        >
          Sign in with Google
        </button>
        
        <p className="text-xs text-slate-500 mt-4 text-center">
          One account can join multiple guilds
        </p>
      </div>
    </div>
  )
}

function AuthCallback() {
  const navigate = useNavigate()
  const { user, guild, pendingJoinRequest, loading } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate('/login', { replace: true })
      return
    }
    
    const inviteToken = sessionStorage.getItem('gpm_invite_token')
    if (inviteToken) {
      navigate(`/join?token=${inviteToken}`, { replace: true })
      return
    }
    
    const bundleToken = sessionStorage.getItem('gpm_invite_bundle_token')
    if (bundleToken) {
      navigate(`/join?bundle=${bundleToken}`, { replace: true })
      return
    }

    if (!guild) {
      navigate(pendingJoinRequest ? '/join' : '/onboarding', { replace: true })
      return
    }

    navigate('/overview', { replace: true })
  }, [loading, user, guild, pendingJoinRequest])

  return (
    <div className="min-h-screen flex items-center justify-center bg-game-grid">
      <div className="text-slate-600 text-xs animate-pulse uppercase tracking-[0.3em]">
        Authenticating...
      </div>
    </div>
  )
}

function OnboardingPage() { return <div>Onboarding - Create Guild</div> }
function JoinGuildPage() { return <div>Join Guild via Invite</div> }
function PrivacyPage() { return <div>Privacy Policy</div> }
function OverviewPage() { return <div>Guild Overview - All features unlocked</div> }
function WarsPage() { return <div>Wars & Party Management</div> }
function WarDetailPage() { return <div>War Session Detail</div> }
function PlayersPage() { return <div>Player List Management</div> }
function StatsPage() { return <div>Statistics - All tabs unlocked (Pro features now free)</div> }
function SettingsPage() { return <div>Guild Settings - No billing tab</div> }
function ProfileSetupPage() { return <div>Profile Setup</div> }
function PublicStatsPage() { return <div>Public Stats (shared link)</div> }
function PublicLeavePage() { return <div>Public Leave (shared link)</div> }
