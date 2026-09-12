import { useState, useRef, useEffect, type FormEvent } from 'react'
import { api } from '../api/http'
import { useAuth } from '../auth/AuthContext'
import './FloatingSupportWidget.css'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  time: string
}

export default function FloatingSupportWidget() {
  const { user, membership } = useAuth()
  const [openMenu, setOpenMenu] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [roleTitle, setRoleTitle] = useState('Khách vãng lai / Khách hàng tiềm năng')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Determine initial role persona display
  const orgType = membership?.organizationType
  const orgName = membership?.organizationName
  const isDriver = Boolean(membership?.roles?.includes('DRIVER'))

  const currentRoleName = !user
    ? 'Khách vãng lai'
    : orgType === 'RESTAURANT'
      ? `Nhà hàng: ${orgName || 'Bếp ăn'}`
      : orgType === 'SUPPLIER'
        ? `Hợp tác xã: ${orgName || 'Vùng trồng'}`
        : isDriver
          ? 'Tài xế Xe Lạnh'
          : 'Điều hành & QC FreshLink'

  // Default initial message tailored to role
  useEffect(() => {
    const welcomeText = !user
      ? 'Xin chào! Tôi là Trợ lý AI FreshLink (Gemini). Bạn cần tìm hiểu về giải pháp chuỗi lạnh B2B, quy cách rau củ VietGAP hay cách thức đăng ký hợp tác?'
      : orgType === 'RESTAURANT'
        ? `Xin chào ${user.fullName || 'quý khách'}! Trợ lý Bếp & Thu mua sẵn sàng hỗ trợ đặt hàng, giờ chốt 17:00, quy định khiếu nại hoặc kiểm tra hóa đơn của ${orgName || 'nhà hàng'}.`
        : orgType === 'SUPPLIER'
          ? `Xin chào ${user.fullName || 'đối tác'}! Trợ lý HTX sẵn sàng hỗ trợ tiếp nhận yêu cầu cung ứng, hướng dẫn tạo lô & in mã QR VietGAP, chuẩn tiếp nhận Gate QC.`
          : isDriver
            ? `Chào bác tài ${user.fullName || ''}! Trợ lý Đội xe sẵn sàng hỗ trợ về lộ trình, chuẩn nhiệt độ thùng xe (+2°C ~ +6°C) và quy trình bàn giao thùng SmartCrate.`
            : 'Xin chào! Trợ lý Điều hành Chuỗi cung ứng FreshLink sẵn sàng hỗ trợ nghiệp vụ phân bổ đơn, QC cổng Gate và đối soát 3 bên.'

    const defaultSuggestions = !user
      ? ['FreshLink hoạt động như thế nào?', 'Làm sao để đăng ký đối tác?', 'Tiêu chuẩn chuỗi lạnh VietGAP?', 'Hotline và Zalo tư vấn?']
      : orgType === 'RESTAURANT'
        ? ['Giờ chốt đơn hàng ngày?', 'Quy định khiếu nại hàng dập nát?', 'Bảo quản thùng SmartCrate?', 'Số điện thoại Hotline CSKH?']
        : orgType === 'SUPPLIER'
          ? ['Tiêu chuẩn kiểm nhận tại Gate?', 'Cách tạo lô hàng và in mã QR?', 'Chính sách đối soát thu mua?', 'Liên hệ điều phối thu mua?']
          : isDriver
            ? ['Nhiệt độ thùng xe đạt chuẩn?', 'Cách bàn giao và thu hồi thùng?', 'Xử lý khi nhà hàng chưa mở cửa?', 'Hotline hỗ trợ khẩn cấp?']
            : ['Quy trình kiểm hàng KCS?', 'Xử lý ngoại lệ đơn hàng?', 'Đối soát công nợ định kỳ?', 'Hotline hỗ trợ điều phối?']

    setMessages([
      {
        id: 'init-1',
        role: 'assistant',
        content: welcomeText,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ])
    setSuggestions(defaultSuggestions)
  }, [user, orgType, orgName, isDriver])

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, busy])

  async function handleSendMessage(textToSend?: string) {
    const text = (textToSend ?? input).trim()
    if (!text || busy) return

    const userMsg: Message = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      role: 'user',
      content: text,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setBusy(true)

    try {
      const historyPayload = messages.map(m => ({
        role: m.role,
        content: m.content,
      }))

      const res = await api<{
        reply: string
        role: string
        organizationName: string
        suggestions: string[]
      }>('/public/chat', 'POST', {
        message: text,
        history: historyPayload,
      })

      if (res?.reply) {
        const botMsg: Message = {
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + 1),
          role: 'assistant',
          content: res.reply,
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        }
        setMessages(prev => [...prev, botMsg])
        if (res.role) setRoleTitle(res.role)
        if (res.suggestions && res.suggestions.length > 0) {
          setSuggestions(res.suggestions)
        }
      }
    } catch {
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 2),
          role: 'assistant',
          content:
            'Đang có sự cố kết nối tới máy chủ AI. Quý khách vui lòng gọi trực tiếp Hotline CSKH **0123456789** hoặc nhắn tin Zalo để được hỗ trợ tức thì!',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault()
    void handleSendMessage()
  }

  function handleResetChat() {
    setMessages([
      {
        id: 'reset-1',
        role: 'assistant',
        content: `Đã làm mới cuộc hội thoại. Tôi là Trợ lý AI FreshLink (${currentRoleName}). Tôi có thể hỗ trợ gì cho bạn?`,
        time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      },
    ])
  }

  // Format simple markdown (bold text **bold**)
  function renderFormattedContent(content: string) {
    const parts = content.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  return (
    <div className="floating-support-container" aria-label="Trung tâm hỗ trợ FreshLink">
      {/* 1. Chatbot Interactive Window */}
      {chatOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-avatar">
                <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
                  smart_toy
                </span>
                <span className="chatbot-status-dot" />
              </div>
              <div>
                <h4 className="chatbot-title">
                  <span>Trợ lý AI FreshLink</span>
                  <span className="chatbot-badge-gemini">GEMINI</span>
                </h4>
                <div className="chatbot-role-desc" title={roleTitle}>
                  {currentRoleName}
                </div>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button
                type="button"
                className="chatbot-btn-icon"
                onClick={handleResetChat}
                title="Làm mới cuộc trò chuyện"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                  refresh
                </span>
              </button>
              <button
                type="button"
                className="chatbot-btn-icon"
                onClick={() => setChatOpen(false)}
                title="Thu nhỏ cửa sổ"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                  close
                </span>
              </button>
            </div>
          </div>

          <div className="chatbot-guardrail-banner">
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              shield
            </span>
            <span>Hỗ trợ tự động trong thẩm quyền vai trò của bạn • Hotline: 0123456789</span>
          </div>

          <div className="chatbot-messages">
            {messages.map(m => (
              <div key={m.id} className={`chat-bubble-row ${m.role}`}>
                <div className={`chat-bubble ${m.role}`}>
                  <div>{renderFormattedContent(m.content)}</div>
                  <div
                    style={{
                      fontSize: 10,
                      marginTop: 4,
                      opacity: 0.7,
                      textAlign: m.role === 'user' ? 'right' : 'left',
                    }}
                  >
                    {m.time}
                  </div>
                </div>
              </div>
            ))}

            {busy && (
              <div className="chat-bubble-row assistant">
                <div className="chat-bubble assistant">
                  <div className="typing-dots">
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                    <div className="typing-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {suggestions.length > 0 && (
            <div className="chatbot-suggestions-section">
              <div className="chatbot-suggestions-label">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  tips_and_updates
                </span>
                Gợi ý câu hỏi nhanh:
              </div>
              <div className="chatbot-suggestions-list">
                {suggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="suggestion-pill"
                    onClick={() => void handleSendMessage(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form className="chatbot-footer" onSubmit={handleFormSubmit}>
            <input
              type="text"
              className="chatbot-input"
              placeholder="Nhập câu hỏi cần hỗ trợ..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              className="chatbot-send-btn"
              disabled={busy || !input.trim()}
              title="Gửi tin nhắn"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                send
              </span>
            </button>
          </form>
        </div>
      )}

      {/* 2. Expandable Speed-Dial Actions */}
      <div className={`fab-menu-list ${openMenu ? 'open' : ''}`}>
        {/* Option 1: AI Chatbot */}
        <button
          type="button"
          className="fab-item-row"
          onClick={() => {
            setChatOpen(true)
            setOpenMenu(false)
          }}
          title="Trợ lý ảo AI (Google Gemini)"
        >
          <span className="fab-item-label">Trợ lý AI (Google Gemini)</span>
          <div className="fab-item-circle circle-chatbot">
            <span className="material-symbols-outlined">smart_toy</span>
          </div>
        </button>

        {/* Option 2: Hotline Call 0123456789 */}
        <a
          href="tel:0123456789"
          className="fab-item-row"
          onClick={() => setOpenMenu(false)}
          title="Gọi Hotline CSKH 0123456789"
        >
          <span className="fab-item-label">Gọi Hotline: 0123.456.789</span>
          <div className="fab-item-circle circle-phone">
            <span className="material-symbols-outlined">call</span>
          </div>
        </a>

        {/* Option 3: Zalo Chat */}
        <a
          href="https://zalo.me/0123456789"
          target="_blank"
          rel="noopener noreferrer"
          className="fab-item-row"
          onClick={() => setOpenMenu(false)}
          title="Nhắn tin Zalo 0123456789"
        >
          <span className="fab-item-label">Nhắn tin Zalo: 0123.456.789</span>
          <div className="fab-item-circle circle-zalo">
            {/* Official Zalo Icon SVG */}
            <svg viewBox="0 0 48 48">
              <path d="M24 4C12.95 4 4 12.51 4 23.01c0 5.43 2.4 10.32 6.27 13.82L8.2 43.18c-.28.98.66 1.87 1.6 1.5l7.39-2.92c2.14.73 4.43 1.15 6.81 1.15 11.05 0 20-8.51 20-19.01S35.05 4 24 4zm8.25 24.88c-.37.37-.96.37-1.33 0l-3.32-3.32c-.17-.17-.46-.17-.63 0l-2.06 2.06c-.37.37-.96.37-1.33 0l-4.5-4.5c-.37-.37-.37-.96 0-1.33l2.06-2.06c.17-.17.17-.46 0-.63l-3.32-3.32c-.37-.37-.37-.96 0-1.33l1.39-1.39c.9-.9 2.37-.9 3.27 0l1.19 1.19c.35.35.92.35 1.27 0l1.45-1.45c.9-.9 2.37-.9 3.27 0l4.06 4.06c.9.9.9 2.37 0 3.27l-1.39 1.39c-.37.37-.37.96 0 1.33l1.83 1.83c.9.9.9 2.37 0 3.27l-2.05 2.05z" />
            </svg>
          </div>
        </a>
      </div>

      {/* 3. Master FAB Trigger Button */}
      <button
        type="button"
        className={`fab-master-btn ${openMenu ? 'open' : ''}`}
        onClick={() => setOpenMenu(!openMenu)}
        aria-label="Mở kênh hỗ trợ FreshLink"
        title="Trung tâm hỗ trợ CSKH, Zalo & Trợ lý AI"
      >
        <span className="fab-pulse-ring" />
        <span className="material-symbols-outlined" style={{ fontSize: 30 }}>
          {openMenu ? 'close' : 'support_agent'}
        </span>
      </button>
    </div>
  )
}
