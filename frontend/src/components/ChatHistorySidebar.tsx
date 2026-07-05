import type { Chat } from '../types'

interface Props {
  chats: Chat[]
  activeChatId: string
  onSelect: (id: string) => void
  onNewChat: () => void
  onDelete: (id: string) => void
  onDeleteAll: () => void
}

export default function ChatHistorySidebar({ chats, activeChatId, onSelect, onNewChat, onDelete, onDeleteAll }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-3">
      <button
        onClick={onDeleteAll}
        className="flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-600 shadow-sm transition hover:bg-rose-100 hover:text-rose-700"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
        </svg>
        Delete all chats
      </button>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">
        {chats.map((chat) => (
          <div key={chat.id} className="group relative">
            <button
              onClick={() => onSelect(chat.id)}
              className={`block w-full rounded-lg py-2 pl-3 pr-9 text-left text-sm transition ${
                chat.id === activeChatId
                  ? 'bg-blue-50 font-medium text-blue-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="block truncate">{chat.title}</span>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(chat.id) }}
              title="Delete chat"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-slate-300 opacity-0 transition hover:bg-rose-100 hover:text-rose-600 group-hover:opacity-100"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
