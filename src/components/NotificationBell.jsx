import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Bell, X, Dumbbell, CreditCard, MessageSquare, Calendar, Check } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'

const ICONS = {
  workout_reminder: Dumbbell,
  workout_assigned: Calendar,
  payment_due: CreditCard,
  payment_late: CreditCard,
  coach_message: MessageSquare,
  attendance_marked: Check,
}

const COLORS = {
  workout_reminder: 'text-blue-400',
  workout_assigned: 'text-emerald-400',
  payment_due: 'text-yellow-400',
  payment_late: 'text-red-400',
  coach_message: 'text-purple-400',
  attendance_marked: 'text-emerald-400',
}

export default function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState([])
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef(null)

  useEffect(() => {
    if (user) loadNotifications()
    // Poll every 30s
    const interval = setInterval(() => { if (user) loadNotifications() }, 30000)
    return () => clearInterval(interval)
  }, [user])

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function loadNotifications() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setNotifications(data || [])
    setUnreadCount((data || []).filter(n => !n.is_read).length)
  }

  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    loadNotifications()
  }

  async function markRead(id) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    loadNotifications()
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setOpen(!open); if (!open && unreadCount > 0) markAllRead() }}
        className="relative p-2 hover:bg-gray-800 rounded-lg transition-colors">
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-emerald-400' : 'text-gray-400'}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl z-50 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h3 className="text-sm font-medium text-white">Notifications</h3>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {notifications.length > 0 ? (
            <div>
              {notifications.map(n => {
                const Icon = ICONS[n.type] || Bell
                const color = COLORS[n.type] || 'text-gray-400'
                return (
                  <div key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`px-4 py-3 border-b border-gray-800/50 last:border-0 hover:bg-gray-800/50 cursor-pointer ${!n.is_read ? 'bg-gray-800/30' : ''}`}>
                    <div className="flex items-start gap-3">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm ${!n.is_read ? 'text-white font-medium' : 'text-gray-300'}`}>{n.title}</div>
                        {n.message && <div className="text-xs text-gray-500 mt-0.5">{n.message}</div>}
                        <div className="text-xs text-gray-600 mt-1">
                          {formatDistanceToNow(parseISO(n.created_at), { addSuffix: true })}
                        </div>
                      </div>
                      {!n.is_read && <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center text-sm text-gray-600">No notifications</div>
          )}
        </div>
      )}
    </div>
  )
}
