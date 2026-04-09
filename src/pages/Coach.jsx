import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Bot, Send, Loader2, Sparkles } from 'lucide-react'

const SYSTEM_PROMPT = `You are a fitness and nutrition coach for Mudit, a 27-year-old vegetarian male in Biratnagar, Nepal.
His stats: 5'5" (165cm), starting weight 60kg, goal is body recomposition with visible abs by June 9, 2026.
Daily targets: 1,950 kcal, 130g protein, 175g carbs, 55g fat.
He's vegetarian (no direct eggs outside home, rarely chicken).
Give practical, specific advice. Suggest Indian vegetarian high-protein meals.
Keep responses concise and motivating. Use metric units.`

export default function Coach() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [hasApiKey, setHasApiKey] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    const key = import.meta.env.VITE_ANTHROPIC_API_KEY
    setHasApiKey(!!key)
    if (user) loadMessages()
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadMessages() {
    const { data } = await supabase
      .from('coach_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at')
      .limit(50)
    setMessages(data || [])
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    // Save user message
    await supabase.from('coach_messages').insert({
      user_id: user.id,
      role: 'user',
      content: userMsg.content,
    })

    try {
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
      if (!apiKey) throw new Error('No API key')

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1024,
          system: SYSTEM_PROMPT,
          messages: [...messages.slice(-10), userMsg].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      const data = await response.json()
      const assistantContent = data.content?.[0]?.text || 'Sorry, I could not generate a response.'

      const assistantMsg = { role: 'assistant', content: assistantContent }
      setMessages(prev => [...prev, assistantMsg])

      await supabase.from('coach_messages').insert({
        user_id: user.id,
        role: 'assistant',
        content: assistantContent,
      })
    } catch (err) {
      const fallback = {
        role: 'assistant',
        content: getOfflineResponse(userMsg.content),
      }
      setMessages(prev => [...prev, fallback])
      await supabase.from('coach_messages').insert({
        user_id: user.id,
        role: 'assistant',
        content: fallback.content,
      })
    }

    setLoading(false)
  }

  function getOfflineResponse(question) {
    const q = question.toLowerCase()
    if (q.includes('protein') || q.includes('food') || q.includes('eat')) {
      return `Great question about nutrition! Here are some high-protein vegetarian options:\n\n• Paneer (18g per 100g) — try paneer bhurji or grilled paneer\n• Soya chunks (52g per 100g dry!) — the protein king\n• Greek yogurt (20g per cup) — great for breakfast\n• Dal + rice combo gives complete protein\n• Whey protein shake (24g per scoop)\n\nWith your 130g target, aim for ~30-35g per meal across 4 meals. Would you like a sample meal plan?`
    }
    if (q.includes('workout') || q.includes('exercise') || q.includes('gym')) {
      return `For body recomp at 60kg, I'd recommend:\n\n• Push/Pull/Legs split, 4-5x per week\n• Focus on progressive overload — add weight or reps each week\n• Compound lifts first: squat, deadlift, bench, OHP\n• Keep rest between sets: 2-3 min for compounds, 60-90s for isolation\n• Don't skip core work — planks, leg raises, cable crunches\n\nFor visible abs, body fat needs to drop below ~12-14%. Your nutrition is more important than ab exercises!`
    }
    if (q.includes('sleep') || q.includes('recovery')) {
      return `Sleep is crucial for recomp! Aim for 7-8 hours:\n\n• Keep a consistent sleep schedule\n• No screens 30 min before bed\n• Keep room cool and dark\n• Avoid caffeine after 2pm\n• Magnesium supplement can help\n\nPoor sleep increases cortisol which promotes fat storage — especially around the belly.`
    }
    return `I'm your AI fitness coach! I can help with:\n\n• **Meal planning** — vegetarian, high-protein options\n• **Workout advice** — programming for body recomp\n• **Sleep tips** — recovery optimization\n• **Progress analysis** — are you on track?\n\nNote: Connect an Anthropic API key for smarter, personalized responses. For now I'll do my best with pre-built advice!\n\nWhat would you like help with?`
  }

  const suggestions = [
    'What should I eat for 130g protein today?',
    'Give me a push day workout plan',
    'Am I eating enough for recomp?',
    'How to improve my sleep?',
  ]

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <Bot className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">AI Coach</h1>
          <p className="text-xs text-gray-500">
            {hasApiKey ? 'Powered by Claude' : 'Offline mode — add API key for AI responses'}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <Sparkles className="w-12 h-12 text-emerald-400/30 mx-auto mb-4" />
            <p className="text-gray-500 mb-6">Ask me anything about your recomp journey!</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => setInput(s)}
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-xs text-gray-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === 'user'
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-800 text-gray-200'
            }`}>
              <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl px-4 py-3">
              <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your coach..."
          className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-4 py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl transition-colors"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  )
}
