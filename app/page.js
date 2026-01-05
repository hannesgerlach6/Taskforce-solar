'use client'

import { useState, useEffect, useRef } from 'react'

export default function TaskforceCRM() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [leads, setLeads] = useState([
    { id: 1, name: 'Thomas Müller', phone: '+491721234567', email: 'thomas.mueller@email.de', status: 'neu', interesse: 'PV-Anlage + Speicher', quelle: 'Website', score: 85, stadt: 'Duisburg' },
    { id: 2, name: 'Sarah Schmidt', phone: '+491639876543', email: 'sarah.schmidt@gmail.com', status: 'kontaktiert', interesse: 'Komplettpaket', quelle: 'Google Ads', score: 92, stadt: 'Moers' },
    { id: 3, name: 'Michael Weber', phone: '+491515555666', email: 'm.weber@web.de', status: 'termin', interesse: 'PV-Anlage', quelle: 'Empfehlung', score: 78, stadt: 'Krefeld' },
    { id: 4, name: 'Anna Fischer', phone: '+491701112233', email: 'anna.f@outlook.de', status: 'angebot', interesse: 'Speicherlösung', quelle: 'Tag der offenen Tür', score: 88, stadt: 'Düsseldorf' },
    { id: 5, name: 'Klaus Becker', phone: '+491764445566', email: 'k.becker@t-online.de', status: 'abgeschlossen', interesse: 'PV + Wallbox', quelle: 'Messe', score: 95, stadt: 'Essen' },
    { id: 6, name: 'Julia Hoffmann', phone: '+491577778899', email: 'julia.h@gmx.de', status: 'neu', interesse: 'Balkonkraftwerk', quelle: 'Instagram', score: 65, stadt: 'Oberhausen' },
  ])
  const [selectedLead, setSelectedLead] = useState(null)
  const [notification, setNotification] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('alle')
  const [showNewLeadModal, setShowNewLeadModal] = useState(false)
  const [newLead, setNewLead] = useState({ name: '', phone: '', email: '', stadt: '', interesse: 'PV-Anlage' })
  const [isVoiceAgentActive, setIsVoiceAgentActive] = useState(false)
  
  // Twilio State
  const [twilioReady, setTwilioReady] = useState(false)
  const [twilioError, setTwilioError] = useState(null)
  const [isRinging, setIsRinging] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [currentCallLead, setCurrentCallLead] = useState(null)
  
  const twilioDeviceRef = useRef(null)
  const currentCallRef = useRef(null)
  const callTimerRef = useRef(null)

  const statusConfig = {
    'neu': { label: 'Neu', bg: '#10B981' },
    'kontaktiert': { label: 'Kontaktiert', bg: '#3B82F6' },
    'termin': { label: 'Termin', bg: '#F59E0B' },
    'angebot': { label: 'Angebot', bg: '#A855F7' },
    'abgeschlossen': { label: 'Abgeschlossen', bg: '#22C55E' }
  }

  // Twilio initialisieren
  useEffect(() => {
    initTwilio()
    return () => {
      if (twilioDeviceRef.current) twilioDeviceRef.current.destroy()
      if (callTimerRef.current) clearInterval(callTimerRef.current)
    }
  }, [])

  const initTwilio = async () => {
    try {
      // Erst prüfen ob die API konfiguriert ist
      const checkRes = await fetch('/api/twilio/token')
      const checkData = await checkRes.json()
      
      if (!checkData.configured) {
        setTwilioError('Twilio API Keys nicht konfiguriert')
        console.log('Twilio not configured, using tel: fallback')
        return
      }

      const { Device } = await import('@twilio/voice-sdk')
      
      const res = await fetch('/api/twilio/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity: 'taskforce-crm-agent' })
      })

      if (!res.ok) {
        const err = await res.json()
        setTwilioError(err.error || 'Token Fehler')
        console.error('Token error:', err)
        return
      }

      const { token, identity } = await res.json()
      console.log('Twilio token received for:', identity)
      
      const device = new Device(token, { 
        logLevel: 1, 
        codecPreferences: ['opus', 'pcmu'],
        edge: 'frankfurt'
      })

      device.on('registered', () => {
        console.log('Twilio Device registered!')
        setTwilioReady(true)
        setTwilioError(null)
      })

      device.on('error', (error) => {
        console.error('Twilio Device error:', error)
        setTwilioError(error.message || 'Verbindungsfehler')
      })

      device.on('unregistered', () => {
        console.log('Twilio Device unregistered')
        setTwilioReady(false)
      })

      await device.register()
      twilioDeviceRef.current = device
      
    } catch (e) {
      console.error('Twilio init error:', e)
      setTwilioError('Twilio Initialisierung fehlgeschlagen')
    }
  }

  const startCall = async (lead) => {
    if (!twilioDeviceRef.current) {
      window.open(`tel:${lead.phone}`, '_self')
      return
    }

    try {
      setIsRinging(true)
      setCurrentCallLead(lead)
      
      const call = await twilioDeviceRef.current.connect({ params: { To: lead.phone } })
      currentCallRef.current = call

      call.on('accept', () => {
        setIsRinging(false)
        setIsConnected(true)
        callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
      })

      call.on('disconnect', endCallCleanup)
      call.on('cancel', endCallCleanup)
    } catch (e) {
      setIsRinging(false)
      showMsg('Anruf fehlgeschlagen', 'error')
    }
  }

  const hangUp = () => {
    if (currentCallRef.current) currentCallRef.current.disconnect()
    endCallCleanup()
  }

  const endCallCleanup = () => {
    if (callTimerRef.current) clearInterval(callTimerRef.current)
    callTimerRef.current = null
    currentCallRef.current = null
    setIsRinging(false)
    setIsConnected(false)
    setIsMuted(false)
    setCallDuration(0)
    setCurrentCallLead(null)
  }

  const toggleMute = () => {
    if (currentCallRef.current) {
      currentCallRef.current.mute(!isMuted)
      setIsMuted(!isMuted)
    }
  }

  const showMsg = (message, type = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 3000)
  }

  const addNewLead = () => {
    if (!newLead.name || !newLead.phone) {
      showMsg('Name und Telefon erforderlich!', 'error')
      return
    }
    const lead = {
      id: Date.now(),
      ...newLead,
      phone: newLead.phone.replace(/\s/g, ''),
      status: 'neu',
      quelle: 'Manuell',
      score: 70
    }
    setLeads(prev => [lead, ...prev])
    setNewLead({ name: '', phone: '', email: '', stadt: '', interesse: 'PV-Anlage' })
    setShowNewLeadModal(false)
    showMsg(`Lead "${lead.name}" hinzugefügt!`)
  }

  const updateLeadStatus = (id, status) => {
    setLeads(prev => prev.map(l => l.id === id ? { ...l, status } : l))
    if (selectedLead?.id === id) setSelectedLead(prev => ({ ...prev, status }))
    showMsg('Status aktualisiert')
  }

  const filteredLeads = leads.filter(lead => {
    const matchSearch = lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || lead.email.toLowerCase().includes(searchTerm.toLowerCase())
    const matchStatus = statusFilter === 'alle' || lead.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total: leads.length,
    neu: leads.filter(l => l.status === 'neu').length,
    termine: leads.filter(l => l.status === 'termin').length,
    abgeschlossen: leads.filter(l => l.status === 'abgeschlossen').length
  }

  const formatDuration = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // Styles
  const card = { background: 'rgba(13, 0, 37, 0.6)', border: '1px solid rgba(0, 229, 185, 0.1)', borderRadius: 16, padding: 24, backdropFilter: 'blur(10px)' }
  const btnPrimary = { background: '#00E5B9', color: '#1B004E', border: 'none', padding: '12px 24px', borderRadius: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }
  const btnSecondary = { background: 'transparent', border: '1px solid rgba(0, 229, 185, 0.3)', color: '#00E5B9', padding: '12px 24px', borderRadius: 12, fontWeight: 600, cursor: 'pointer' }
  const input = { width: '100%', padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(0, 229, 185, 0.2)', background: 'rgba(13, 0, 37, 0.8)', color: 'white', fontSize: 14, outline: 'none' }

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Notification */}
      {notification && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 100, padding: '12px 24px', borderRadius: 12, background: notification.type === 'error' ? '#EF4444' : '#00E5B9', color: notification.type === 'error' ? 'white' : '#1B004E', fontWeight: 500 }}>
          {notification.message}
        </div>
      )}

      {/* Active Call Banner */}
      {(isRinging || isConnected) && currentCallLead && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, background: isConnected ? '#22C55E' : '#F59E0B', padding: '16px 24px' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                {currentCallLead.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <p style={{ fontWeight: 'bold', fontSize: 18 }}>{currentCallLead.name}</p>
                <p style={{ opacity: 0.8 }}>{currentCallLead.phone}</p>
              </div>
              {isRinging && <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 14 }}>🔔 Klingelt...</span>}
              {isConnected && (
                <>
                  <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 14 }}>🟢 Verbunden</span>
                  <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: 20, fontSize: 14, fontFamily: 'monospace', fontWeight: 'bold' }}>{formatDuration(callDuration)}</span>
                </>
              )}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {isConnected && (
                <button onClick={toggleMute} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: isMuted ? '#EF4444' : 'rgba(255,255,255,0.2)', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                  {isMuted ? '🔇 Stumm' : '🎤 Mikro'}
                </button>
              )}
              <button onClick={hangUp} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#DC2626', color: 'white', cursor: 'pointer', fontWeight: 600 }}>
                📵 Auflegen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Twilio Error */}
      {twilioError && !isConnected && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 90, background: '#F97316', color: 'white', padding: '8px 16px', textAlign: 'center', fontSize: 14 }}>
          ⚠️ {twilioError} - Anrufe werden über Telefon-App gestartet
        </div>
      )}

      {/* New Lead Modal */}
      {showNewLeadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div style={{ ...card, maxWidth: 480, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
              <h3 style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>+ Neuer Lead</h3>
              <button onClick={() => setShowNewLeadModal(false)} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 24, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', color: '#9CA3AF', marginBottom: 8, fontSize: 14 }}>Name *</label>
                <input style={input} value={newLead.name} onChange={e => setNewLead(p => ({ ...p, name: e.target.value }))} placeholder="Max Mustermann" />
              </div>
              <div>
                <label style={{ display: 'block', color: '#9CA3AF', marginBottom: 8, fontSize: 14 }}>Telefon *</label>
                <input style={input} value={newLead.phone} onChange={e => setNewLead(p => ({ ...p, phone: e.target.value }))} placeholder="+49 172 1234567" />
              </div>
              <div>
                <label style={{ display: 'block', color: '#9CA3AF', marginBottom: 8, fontSize: 14 }}>E-Mail</label>
                <input style={input} value={newLead.email} onChange={e => setNewLead(p => ({ ...p, email: e.target.value }))} placeholder="max@beispiel.de" />
              </div>
              <div>
                <label style={{ display: 'block', color: '#9CA3AF', marginBottom: 8, fontSize: 14 }}>Stadt</label>
                <input style={input} value={newLead.stadt} onChange={e => setNewLead(p => ({ ...p, stadt: e.target.value }))} placeholder="Moers" />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button onClick={() => setShowNewLeadModal(false)} style={{ ...btnSecondary, flex: 1 }}>Abbrechen</button>
                <button onClick={addNewLead} style={{ ...btnPrimary, flex: 1, justifyContent: 'center' }}>Hinzufügen</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header style={{ borderBottom: '1px solid rgba(0, 229, 185, 0.1)', background: 'rgba(13, 0, 37, 0.5)', position: 'sticky', top: twilioError ? 36 : 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #00E5B9, #00C9A7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>☀️</div>
              <div>
                <h1 style={{ margin: 0, fontSize: 20, fontWeight: 'bold' }}>TASK-FORCE</h1>
                <p style={{ margin: 0, fontSize: 12, color: '#00E5B9' }}>Meisterbetrieb für Photovoltaik</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 8, background: twilioReady ? 'rgba(34, 197, 94, 0.2)' : 'rgba(249, 115, 22, 0.2)', fontSize: 13 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: twilioReady ? '#22C55E' : '#F97316' }} />
                <span style={{ color: twilioReady ? '#22C55E' : '#F97316' }}>{twilioReady ? 'Telefonie bereit' : 'Lädt...'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 12, background: 'rgba(0, 229, 185, 0.1)' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: isVoiceAgentActive ? '#00E5B9' : '#6B7280' }} />
                <span style={{ fontSize: 14 }}>Voice Agent {isVoiceAgentActive ? 'Aktiv' : 'Inaktiv'}</span>
              </div>
              <button onClick={() => setIsVoiceAgentActive(!isVoiceAgentActive)} style={{ ...btnPrimary, background: isVoiceAgentActive ? 'rgba(239, 68, 68, 0.2)' : '#00E5B9', color: isVoiceAgentActive ? '#EF4444' : '#1B004E' }}>
                {isVoiceAgentActive ? '🔇' : '🎤'} {isVoiceAgentActive ? 'Deaktivieren' : 'Aktivieren'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
            {[{ id: 'dashboard', label: '📊 Dashboard' }, { id: 'leads', label: '👥 Leads' }, { id: 'voice', label: '📞 Voice AI' }, { id: 'erfolge', label: '📈 Erfolge' }].map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                padding: '10px 20px', borderRadius: '12px 12px 0 0', border: 'none',
                background: activeTab === tab.id ? 'rgba(13, 0, 37, 0.5)' : 'transparent',
                color: activeTab === tab.id ? '#00E5B9' : '#9CA3AF',
                cursor: 'pointer', fontWeight: 500, fontSize: 14,
                borderTop: activeTab === tab.id ? '2px solid #00E5B9' : '2px solid transparent'
              }}>{tab.label}</button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
        
        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Gesamt Leads', value: stats.total, icon: '👥', color: '#00E5B9' },
                { label: 'Neue Leads', value: stats.neu, icon: '✨', color: '#00E5B9' },
                { label: 'Termine', value: stats.termine, icon: '📅', color: '#F59E0B' },
                { label: 'Abgeschlossen', value: stats.abgeschlossen, icon: '✅', color: '#22C55E' }
              ].map((stat, i) => (
                <div key={i} style={card}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 24 }}>{stat.icon}</span>
                  </div>
                  <p style={{ fontSize: 32, fontWeight: 'bold', margin: 0, color: stat.color }}>{stat.value}</p>
                  <p style={{ fontSize: 14, color: '#9CA3AF', margin: '4px 0 0' }}>{stat.label}</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
              <div style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h2 style={{ margin: 0, fontSize: 18 }}>Aktuelle Leads</h2>
                  <button onClick={() => setActiveTab('leads')} style={{ background: 'none', border: 'none', color: '#00E5B9', cursor: 'pointer', fontSize: 14 }}>Alle anzeigen →</button>
                </div>
                {leads.slice(0, 4).map(lead => (
                  <div key={lead.id} onClick={() => { setSelectedLead(lead); setActiveTab('leads'); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, marginBottom: 8, borderRadius: 12, cursor: 'pointer', background: 'rgba(27, 0, 78, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg, #00E5B9, #00C9A7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#1B004E' }}>
                        {lead.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 500 }}>{lead.name}</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>{lead.interesse} • {lead.stadt}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, background: `${statusConfig[lead.status].bg}30`, color: statusConfig[lead.status].bg }}>{statusConfig[lead.status].label}</span>
                      <button onClick={e => { e.stopPropagation(); startCall(lead); }} style={{ background: 'rgba(0, 229, 185, 0.2)', border: 'none', padding: 8, borderRadius: 8, cursor: 'pointer', color: '#00E5B9' }}>📞</button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(0, 229, 185, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🎤</div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>KI Voice Agent</h3>
                    <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>Johanna • ElevenLabs</p>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div style={{ padding: 12, borderRadius: 12, background: 'rgba(27, 0, 78, 0.5)', textAlign: 'center' }}>
                    <p style={{ fontSize: 24, fontWeight: 'bold', color: '#00E5B9', margin: 0 }}>47</p>
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Anrufe heute</p>
                  </div>
                  <div style={{ padding: 12, borderRadius: 12, background: 'rgba(27, 0, 78, 0.5)', textAlign: 'center' }}>
                    <p style={{ fontSize: 24, fontWeight: 'bold', color: '#00E5B9', margin: 0 }}>12</p>
                    <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>Termine</p>
                  </div>
                </div>
                <button onClick={() => setActiveTab('voice')} style={{ ...btnPrimary, width: '100%', justifyContent: 'center' }}>Voice AI öffnen</button>
              </div>
            </div>
          </div>
        )}

        {/* Leads */}
        {activeTab === 'leads' && (
          <div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }}>🔍</span>
                <input style={{ ...input, paddingLeft: 48 }} placeholder="Leads suchen..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
              </div>
              <select style={{ ...input, width: 'auto', minWidth: 150 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="alle">Alle Status</option>
                <option value="neu">Neu</option>
                <option value="kontaktiert">Kontaktiert</option>
                <option value="termin">Termin</option>
                <option value="angebot">Angebot</option>
                <option value="abgeschlossen">Abgeschlossen</option>
              </select>
              <button onClick={() => setShowNewLeadModal(true)} style={btnPrimary}>+ Neuer Lead</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
              <div style={card}>
                {filteredLeads.map(lead => (
                  <div key={lead.id} onClick={() => setSelectedLead(lead)} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: 16, marginBottom: 8, borderRadius: 12, cursor: 'pointer',
                    background: selectedLead?.id === lead.id ? 'rgba(27, 0, 78, 0.7)' : 'rgba(27, 0, 78, 0.3)',
                    border: selectedLead?.id === lead.id ? '1px solid rgba(0, 229, 185, 0.4)' : '1px solid transparent'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg, #00E5B9, #00C9A7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#1B004E' }}>
                        {lead.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 500 }}>{lead.name}</p>
                        <p style={{ margin: 0, fontSize: 13, color: '#9CA3AF' }}>{lead.email}</p>
                        <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6B7280' }}>{lead.stadt} • {lead.quelle}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${lead.score >= 80 ? '#22C55E' : lead.score >= 60 ? '#F59E0B' : '#EF4444'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 'bold', color: lead.score >= 80 ? '#22C55E' : lead.score >= 60 ? '#F59E0B' : '#EF4444' }}>{lead.score}</div>
                      <span style={{ padding: '6px 12px', borderRadius: 20, fontSize: 12, background: `${statusConfig[lead.status].bg}30`, color: statusConfig[lead.status].bg }}>{statusConfig[lead.status].label}</span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={e => { e.stopPropagation(); startCall(lead); }} style={{ background: 'rgba(0, 229, 185, 0.2)', border: 'none', padding: 8, borderRadius: 8, cursor: 'pointer', color: '#00E5B9' }}>📞</button>
                        <button onClick={e => { e.stopPropagation(); window.location.href = `mailto:${lead.email}`; }} style={{ background: 'rgba(59, 130, 246, 0.2)', border: 'none', padding: 8, borderRadius: 8, cursor: 'pointer', color: '#3B82F6' }}>✉️</button>
                        <button onClick={e => { e.stopPropagation(); window.open(`https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}`, '_blank'); }} style={{ background: 'rgba(34, 197, 94, 0.2)', border: 'none', padding: 8, borderRadius: 8, cursor: 'pointer', color: '#22C55E' }}>💬</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={card}>
                {selectedLead ? (
                  <div>
                    <div style={{ textAlign: 'center', marginBottom: 24 }}>
                      <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, #00E5B9, #00C9A7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: '#1B004E', fontSize: 24, margin: '0 auto 16px' }}>
                        {selectedLead.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <h3 style={{ margin: 0, fontSize: 20 }}>{selectedLead.name}</h3>
                      <p style={{ margin: '4px 0 0', color: '#9CA3AF' }}>{selectedLead.stadt}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                      <a href={`tel:${selectedLead.phone}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: 'rgba(27, 0, 78, 0.5)', textDecoration: 'none', color: 'white' }}>
                        <span style={{ color: '#00E5B9' }}>📞</span> {selectedLead.phone}
                      </a>
                      <a href={`mailto:${selectedLead.email}`} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: 'rgba(27, 0, 78, 0.5)', textDecoration: 'none', color: 'white' }}>
                        <span style={{ color: '#00E5B9' }}>✉️</span> {selectedLead.email}
                      </a>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: 'rgba(27, 0, 78, 0.5)' }}>
                        <span style={{ color: '#00E5B9' }}>⚡</span> {selectedLead.interesse}
                      </div>
                    </div>
                    <div style={{ marginBottom: 24 }}>
                      <label style={{ display: 'block', color: '#9CA3AF', marginBottom: 8, fontSize: 14 }}>Status ändern</label>
                      <select style={input} value={selectedLead.status} onChange={e => updateLeadStatus(selectedLead.id, e.target.value)}>
                        <option value="neu">Neu</option>
                        <option value="kontaktiert">Kontaktiert</option>
                        <option value="termin">Termin</option>
                        <option value="angebot">Angebot</option>
                        <option value="abgeschlossen">Abgeschlossen</option>
                      </select>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <button onClick={() => startCall(selectedLead)} style={{ ...btnPrimary, justifyContent: 'center' }}>📞 Anrufen</button>
                      <button onClick={() => window.open(`https://wa.me/${selectedLead.phone.replace(/[^0-9]/g, '')}`, '_blank')} style={{ ...btnSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>💬 WhatsApp</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>
                    <p style={{ fontSize: 40, marginBottom: 16 }}>👥</p>
                    <p>Wähle einen Lead aus</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Voice AI */}
        {activeTab === 'voice' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={card}>
              <div style={{ textAlign: 'center', marginBottom: 32 }}>
                <div style={{
                  width: 120, height: 120, borderRadius: '50%', margin: '0 auto 24px',
                  background: isVoiceAgentActive ? 'linear-gradient(135deg, #00E5B9, #00C9A7)' : 'rgba(27, 0, 78, 0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 48,
                  boxShadow: isVoiceAgentActive ? '0 0 60px rgba(0, 229, 185, 0.4)' : 'none'
                }}>
                  {isVoiceAgentActive ? '🔊' : '🔇'}
                </div>
                <h2 style={{ margin: 0, fontSize: 24 }}>{isVoiceAgentActive ? 'Johanna ist bereit' : 'Voice Agent Inaktiv'}</h2>
                <p style={{ color: '#9CA3AF', margin: '8px 0 0' }}>{isVoiceAgentActive ? 'KI nimmt Anrufe entgegen' : 'Aktiviere den Agent'}</p>
              </div>
              
              <button onClick={() => setIsVoiceAgentActive(!isVoiceAgentActive)} style={{
                ...btnPrimary, width: '100%', justifyContent: 'center', padding: 16, fontSize: 16,
                background: isVoiceAgentActive ? 'rgba(239, 68, 68, 0.2)' : '#00E5B9',
                color: isVoiceAgentActive ? '#EF4444' : '#1B004E',
                border: isVoiceAgentActive ? '2px solid rgba(239, 68, 68, 0.3)' : 'none'
              }}>
                {isVoiceAgentActive ? '⏸ Agent Deaktivieren' : '▶️ Agent Aktivieren'}
              </button>

              {isVoiceAgentActive && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24 }}>
                  <div style={{ padding: 16, borderRadius: 12, background: 'rgba(27, 0, 78, 0.5)', textAlign: 'center' }}>
                    <p style={{ fontSize: 28, fontWeight: 'bold', color: '#00E5B9', margin: 0 }}>47</p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Anrufe heute</p>
                  </div>
                  <div style={{ padding: 16, borderRadius: 12, background: 'rgba(27, 0, 78, 0.5)', textAlign: 'center' }}>
                    <p style={{ fontSize: 28, fontWeight: 'bold', color: '#00E5B9', margin: 0 }}>3:24</p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Ø Dauer</p>
                  </div>
                  <div style={{ padding: 16, borderRadius: 12, background: 'rgba(27, 0, 78, 0.5)', textAlign: 'center' }}>
                    <p style={{ fontSize: 28, fontWeight: 'bold', color: '#00E5B9', margin: 0 }}>68%</p>
                    <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Qualifiziert</p>
                  </div>
                </div>
              )}

              <div style={{ marginTop: 24, padding: 16, borderRadius: 12, background: 'rgba(27, 0, 78, 0.3)', border: '1px solid rgba(0, 229, 185, 0.2)' }}>
                <p style={{ color: '#9CA3AF', fontSize: 14, margin: '0 0 8px' }}>Twilio-Nummer für Inbound:</p>
                <a href="tel:+4997180263000" style={{ fontSize: 20, fontWeight: 'bold', color: '#00E5B9', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
                  📞 +49 971 80263000
                </a>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={card}>
                <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>⚙️ Agent Konfiguration</h3>
                <div style={{ padding: 16, borderRadius: 12, background: 'rgba(27, 0, 78, 0.3)', border: '1px solid rgba(0, 229, 185, 0.1)' }}>
                  <p style={{ margin: 0, fontSize: 14 }}>🎯 Agent: <span style={{ color: '#00E5B9' }}>Johanna</span></p>
                  <p style={{ margin: '8px 0 0', fontSize: 12, color: '#9CA3AF' }}>Kundenberaterin von TASK-FORCE. Beantwortet Fragen zu Solaranlagen, vereinbart Beratungstermine.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                  <div style={{ padding: 12, borderRadius: 12, background: 'rgba(27, 0, 78, 0.3)' }}>
                    <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Telefon</p>
                    <p style={{ fontSize: 14, margin: '4px 0 0' }}>+49 971 80263000</p>
                  </div>
                  <div style={{ padding: 12, borderRadius: 12, background: 'rgba(27, 0, 78, 0.3)' }}>
                    <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>Sprache</p>
                    <p style={{ fontSize: 14, margin: '4px 0 0' }}>Deutsch</p>
                  </div>
                </div>
              </div>

              <div style={card}>
                <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>🕐 Letzte KI-Anrufe</h3>
                {[
                  { name: 'Thomas Müller', result: 'Termin vereinbart', duration: '3:24', time: '14:32' },
                  { name: 'Sarah Schmidt', result: 'Rückruf gewünscht', duration: '2:15', time: '13:45' },
                  { name: 'Unbekannt', result: 'Info gesendet', duration: '1:52', time: '11:20' }
                ].map((call, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, marginBottom: 8, borderRadius: 12, background: 'rgba(27, 0, 78, 0.3)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(0, 229, 185, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📞</div>
                      <div>
                        <p style={{ margin: 0, fontSize: 14 }}>{call.name}</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>{call.result}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: 14, color: '#00E5B9' }}>{call.duration}</p>
                      <p style={{ margin: 0, fontSize: 12, color: '#9CA3AF' }}>{call.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Erfolge */}
        {activeTab === 'erfolge' && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
            <div>
              <h2 style={{ margin: '0 0 24px', fontSize: 24 }}>Unsere Erfolge mit KI-Automatisierung</h2>
              
              {[
                { client: 'Solarvergleiche', result: '45 Termine in 1 Monat', stats: { emails: '10.000+', response: '8.2%', conversion: '4.1%' }, icon: '☀️' },
                { client: 'KlickBoost', result: '300.000€ Umsatz in 3 Monaten', stats: { emails: '450.000+', response: '4.5%', qualified: '23%' }, icon: '📈' },
                { client: 'FMI Deutschland', result: '200.000€ Umsatz in 1,5 Monaten', stats: { emails: '8.000/Tag', response: '12%', conversion: '6.5%' }, icon: '🏢' }
              ].map((story, i) => (
                <div key={i} style={{ ...card, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(0, 229, 185, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{story.icon}</div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 20 }}>{story.client}</h3>
                      <p style={{ margin: '4px 0 0', color: '#00E5B9' }}>{story.result}</p>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {Object.entries(story.stats).map(([key, value]) => (
                      <div key={key} style={{ padding: 12, borderRadius: 12, background: 'rgba(27, 0, 78, 0.5)', textAlign: 'center' }}>
                        <p style={{ fontSize: 20, fontWeight: 'bold', margin: 0 }}>{value}</p>
                        <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0', textTransform: 'capitalize' }}>{key}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={card}>
                <h3 style={{ margin: '0 0 16px' }}>Was Sie bekommen</h3>
                {['🎤 KI Voice Agent', '👥 CRM System', '✉️ E-Mail Automation', '⭐ Lead Scoring', '🔄 Hero Integration', '💬 WhatsApp Bot', '📅 Terminbuchung', '✅ DSGVO konform'].map((item, i) => (
                  <div key={i} style={{ padding: '8px 0' }}>{item}</div>
                ))}
              </div>

              <div style={{ ...card, background: 'linear-gradient(135deg, #1B004E, #2D1B5E)', border: '2px solid rgba(0, 229, 185, 0.3)', textAlign: 'center' }}>
                <p style={{ fontSize: 40, fontWeight: 'bold', color: '#00E5B9', margin: 0 }}>98%</p>
                <p style={{ fontWeight: 500, margin: '8px 0' }}>Kundenzufriedenheit</p>
                <p style={{ fontSize: 14, color: '#9CA3AF', margin: 0 }}>4000+ Installationen</p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer style={{ borderTop: '1px solid rgba(0, 229, 185, 0.1)', marginTop: 48, padding: 24 }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>☀️</span>
            <span style={{ fontWeight: 500 }}>TASK-FORCE</span>
            <span style={{ color: '#6B7280' }}>|</span>
            <span style={{ color: '#9CA3AF', fontSize: 14 }}>Meisterbetrieb für Photovoltaik</span>
          </div>
          <div style={{ display: 'flex', gap: 24, fontSize: 14, color: '#9CA3AF' }}>
            <span>📍 47441 Moers</span>
            <a href="tel:+4928419796700" style={{ color: '#9CA3AF', textDecoration: 'none' }}>📞 02841 97 96 700</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
