import { useState } from 'react'
import { useChatSocket } from './hooks/useChatSocket'
import ChatBox from './components/ChatBox'
import AgentStatusPanel from './components/AgentStatusPanel'
import ChatHistorySidebar from './components/ChatHistorySidebar'

export default function App() {
  const { connected, messages, chats, activeChatId, agents, thinking, sendMessage, startNewChat, selectChat, deleteChat } =
    useChatSocket()
  const [showHistory, setShowHistory] = useState(false)
  const [showAgentPanel, setShowAgentPanel] = useState(false)

  const closeAll = () => { setShowHistory(false); setShowAgentPanel(false) }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[#f0f4f8] text-slate-900">
      {/* Header */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b-2 border-blue-900/20 bg-white px-6 shadow-sm">

        {/* Left — History toggle */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setShowAgentPanel(false); setShowHistory((v) => !v) }}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold tracking-wide transition ${
              showHistory
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-blue-700 hover:bg-blue-50 hover:text-blue-900'
            }`}
          >
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
            </svg>
            History
          </button>

          <div className="flex items-center gap-2.5">
            <span className="font-serif-display text-xl font-semibold text-slate-900">
              Tumor<span className="text-blue-600">Board</span>
            </span>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700">
              Beta
            </span>
          </div>
        </div>

        {/* Right — Agents toggle */}
        <button
          onClick={() => { setShowHistory(false); setShowAgentPanel((v) => !v) }}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold tracking-wide transition ${
            showAgentPanel
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-blue-700 hover:bg-blue-50 hover:text-blue-900'
          }`}
        >
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h3l3-9 4 18 3-9h5" />
          </svg>
          Agents
          {thinking && (
            <span className="h-2 w-2 animate-pulse rounded-full bg-white/80" />
          )}
        </button>
      </header>

      {/* Chat */}
      <main className="relative min-h-0 flex-1">
        <ChatBox messages={messages} thinking={thinking} connected={connected} onSend={sendMessage} />

        {/* Backdrop */}
        {(showHistory || showAgentPanel) && (
          <div className="absolute inset-0 z-20 bg-black/10 backdrop-blur-[1px]" onClick={closeAll} />
        )}

        {/* Left drawer — Chat History */}
        <div
          className={`absolute left-0 top-0 z-30 h-full w-72 border-r border-slate-200 bg-white shadow-2xl transition-transform duration-200 ${
            showHistory ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2 text-slate-700">
                <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
                <span className="text-sm font-semibold">Chat History</span>
              </div>
              <button onClick={() => setShowHistory(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatHistorySidebar
                chats={chats}
                activeChatId={activeChatId}
                onSelect={(id) => { selectChat(id); setShowHistory(false) }}
                onNewChat={() => { startNewChat(); setShowHistory(false) }}
                onDelete={deleteChat}
              />
            </div>
          </div>
        </div>

        {/* Right drawer — Agent Activity */}
        <div
          className={`absolute right-0 top-0 z-30 h-full w-[400px] border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 ${
            showAgentPanel ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2 text-slate-700">
                <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h3l3-9 4 18 3-9h5" />
                </svg>
                <span className="text-sm font-semibold">Agent Activity</span>
              </div>
              <button onClick={() => setShowAgentPanel(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <AgentStatusPanel agents={agents} />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
