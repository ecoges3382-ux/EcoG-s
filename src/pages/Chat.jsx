import { useEffect, useState, useRef, useMemo } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials, ROLES } from '../lib/utils.js';

const AVATAR_COLORS = ['#0F4C3A', '#C4622D', '#C99A3D', '#2E6B47', '#8F4620', '#4A6670', '#5B3A8E'];
function avatarColor(seed) {
  let h = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function formatTime(dateStr) {
  return new Date(dateStr).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatConvDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, today)) return "Aujourd'hui";
  if (sameDay(d, yesterday)) return 'Hier';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined });
}

export default function Chat() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [staff, setStaff] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [searchConv, setSearchConv] = useState('');
  const [searchStaff, setSearchStaff] = useState('');
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Détection mobile
  useEffect(() => {
    function checkMobile() { setIsMobile(window.innerWidth < 768); }
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 1. Charger les conversations et le personnel
  useEffect(() => {
    async function load() {
      setError('');
      
      const { data: staffData, error: staffErr } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('school_id', profile.school_id)
        .neq('id', profile.id);

      if (staffErr) setError("Impossible de charger la liste des collègues.");
      else setStaff(staffData || []);

      const { data: convs, error: convsErr } = await supabase
        .from('chat_conversations')
        .select(`
          id, type, name,
          chat_participants ( user_id, last_read_at, profiles ( full_name, role ) )
        `);

      if (convsErr) {
        setError("Impossible de charger les conversations.");
        return;
      }
      
      const visibleConvs = (convs || []).filter(c => 
        c.type === 'general' || (c.chat_participants && c.chat_participants.some(p => p.user_id === profile.id))
      );

      setConversations(visibleConvs);
      await loadUnreadCounts(visibleConvs);
      await loadLastMessages(visibleConvs);

      const general = visibleConvs.find(c => c.type === 'general');
      if (general && !isMobile) setActiveConv(general);
    }
    load();
  }, [profile.school_id, profile.id, isMobile]);

  // 2. Calculer les messages non lus
  async function loadUnreadCounts(convs) {
    const counts = {};
    for (const conv of convs) {
      const me = conv.chat_participants?.find(p => p.user_id === profile.id);
      if (!me) { counts[conv.id] = 0; continue; }
      
      const { count } = await supabase
        .from('chat_messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', conv.id)
        .neq('sender_id', profile.id)
        .gt('created_at', me.last_read_at || '1970-01-01');
      
      counts[conv.id] = count || 0;
    }
    setUnreadCounts(counts);
  }

  // 3. Charger le dernier message de chaque conversation (aperçu)
  async function loadLastMessages(convs) {
    if (convs.length === 0) return;
    const ids = convs.map(c => c.id);
    const { data } = await supabase
      .from('chat_messages')
      .select('conversation_id, content, created_at, sender_id')
      .in('conversation_id', ids)
      .order('created_at', { ascending: false });

    const map = {};
    (data || []).forEach(m => {
      if (!map[m.conversation_id]) map[m.conversation_id] = m;
    });
    setLastMessages(map);
  }

  // 4. Écouter les nouveaux messages de la conversation active
  useEffect(() => {
    if (!activeConv) return;

    supabase.from('chat_messages')
      .select('*, profiles(full_name, role)')
      .eq('conversation_id', activeConv.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages(data || []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        supabase.rpc('mark_conversation_read', { p_conversation_id: activeConv.id });
        setUnreadCounts(prev => ({ ...prev, [activeConv.id]: 0 }));
      });

    const channel = supabase.channel(`chat_${activeConv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${activeConv.id}` }, async (payload) => {
        const { data: author } = await supabase.from('profiles').select('full_name, role').eq('id', payload.new.sender_id).single();
        setMessages(prev => [...prev, { ...payload.new, profiles: author }]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        
        if (payload.new.sender_id !== profile.id) {
          supabase.rpc('mark_conversation_read', { p_conversation_id: activeConv.id });
        }

        // Mettre à jour l'aperçu du dernier message
        setLastMessages(prev => ({ ...prev, [activeConv.id]: payload.new }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConv?.id]);

  // 5. Écouter les nouveaux messages globaux (badges)
  useEffect(() => {
    const channel = supabase.channel('all_chats')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        if (payload.new.sender_id === profile.id) return;
        if (activeConv && payload.new.conversation_id === activeConv.id) return;
        
        setUnreadCounts(prev => ({
          ...prev,
          [payload.new.conversation_id]: (prev[payload.new.conversation_id] || 0) + 1
        }));

        setLastMessages(prev => ({ ...prev, [payload.new.conversation_id]: payload.new }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConv, profile.id]);

  // 6. Détecter le scroll pour afficher le bouton "aller en bas"
  function handleScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollDown(!atBottom);
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollDown(false);
  }

  // 7. Envoyer un message
  async function sendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim() || !activeConv) return;
    
    const content = newMessage.trim();
    setNewMessage('');
    
    const { data: inserted, error: sendErr } = await supabase.from('chat_messages').insert({
      conversation_id: activeConv.id,
      sender_id: profile.id,
      content
    }).select('id').single();

    if (sendErr) {
      setError("Impossible d'envoyer : " + sendErr.message);
      return;
    }

    if (inserted) {
      try {
        await supabase.functions.invoke('send-message-push', {
          body: {
            conversation_id: activeConv.id,
            sender_name: profile.full_name,
            message_content: content,
            sender_id: profile.id
          },
          headers: { 'x-api-key': import.meta.env.VITE_PUSH_API_SECRET }
        });
      } catch (err) {
        console.warn("Notification push non envoyée :", err);
      }
    }
  }

  // 8. Démarrer une conversation privée
  async function startPrivateChat(otherUserId) {
    const { data: convId, error: rpcError } = await supabase.rpc('create_private_chat', { p_other_user_id: otherUserId });
    if (rpcError) { setError("Erreur chat privé : " + rpcError.message); return; }
    
    const { data: convs } = await supabase.from('chat_conversations').select('*, chat_participants ( user_id, last_read_at, profiles ( full_name, role ) )');
    const visibleConvs = (convs || []).filter(c => c.type === 'general' || c.chat_participants.some(p => p.user_id === profile.id));
    setConversations(visibleConvs);
    await loadUnreadCounts(visibleConvs);
    await loadLastMessages(visibleConvs);
    
    const target = visibleConvs.find(c => c.id === convId);
    if (target) setActiveConv(target);
    setShowNewChat(false);
    setSearchStaff('');
  }

  // 9. Ouvrir une conversation
  function openConversation(c) {
    setActiveConv(c);
    if (isMobile) setShowNewChat(false);
  }

  // Helpers
  const getConvInfo = (c) => {
    if (c.type === 'general') {
      return { name: 'Général', subtitle: 'Toute l\'école', initials: '🌍', color: 'var(--forest)', isGroup: true };
    }
    const other = c.chat_participants?.find(p => p.user_id !== profile.id);
    const name = other?.profiles?.full_name || 'Conversation privée';
    const role = other?.profiles?.role ? ROLES[other.profiles.role]?.label : null;
    return {
      name,
      subtitle: role || 'Message privé',
      initials: initials(name),
      color: avatarColor(other?.user_id || c.id),
      isGroup: false,
    };
  };

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  // Filtrer les conversations
  const filteredConvs = useMemo(() => {
    if (!searchConv.trim()) return conversations;
    return conversations.filter(c => getConvInfo(c).name.toLowerCase().includes(searchConv.toLowerCase()));
  }, [conversations, searchConv]);

  // Filtrer les collègues
  const filteredStaff = useMemo(() => {
    if (!searchStaff.trim()) return staff;
    return staff.filter(s => s.full_name.toLowerCase().includes(searchStaff.toLowerCase()));
  }, [staff, searchStaff]);

  // Grouper les messages par date
  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDate = null;
    messages.forEach(m => {
      const d = formatConvDate(m.created_at);
      if (d !== currentDate) {
        groups.push({ type: 'date', label: d, key: `date-${m.id}` });
        currentDate = d;
      }
      groups.push({ type: 'message', data: m, key: m.id });
    });
    return groups;
  }, [messages]);

  // ============== RENDER COMPOSANTS INTERNES ==============
  const Avatar = ({ text, color, size = 42, isGroup }) => (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: isGroup ? 'linear-gradient(135deg, var(--forest), var(--forest-dark))' : `linear-gradient(135deg, ${color}, ${color}cc)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.35,
      flexShrink: 0, boxShadow: `0 2px 8px ${isGroup ? 'rgba(15,76,58,0.3)' : color + '55'}`,
    }}>
      {text}
    </div>
  );

  // ============== VUE LISTE ==============
  const renderConversationList = () => (
    <div style={{
      width: isMobile ? '100%' : 340,
      display: 'flex', flexDirection: 'column',
      background: 'var(--paper)', borderRadius: 16,
      border: '1px solid var(--line)',
      overflow: 'hidden',
      height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 120px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 20px 14px', background: 'linear-gradient(180deg, var(--forest-light), transparent)', borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: 'var(--forest-dark)', letterSpacing: '-0.02em' }}>
              Messagerie
            </p>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)', fontWeight: 500 }}>
              {totalUnread > 0 ? `${totalUnread} message${totalUnread > 1 ? 's' : ''} non lu${totalUnread > 1 ? 's' : ''}` : 'Tout est à jour'}
            </p>
          </div>
          <button
            onClick={() => setShowNewChat(!showNewChat)}
            title="Nouveau message privé"
            style={{
              width: 40, height: 40, borderRadius: '50%', border: 'none',
              background: 'linear-gradient(135deg, var(--forest), var(--forest-dark))',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(15,76,58,0.3)',
              transition: 'transform 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <i className="ti ti-plus" style={{ fontSize: 20 }}></i>
          </button>
        </div>

        <div style={{ position: 'relative' }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--muted)' }}></i>
          <input
            value={searchConv}
            onChange={e => setSearchConv(e.target.value)}
            placeholder="Rechercher une conversation..."
            style={{
              width: '100%', padding: '10px 14px 10px 38px',
              borderRadius: 12, border: '1px solid var(--line)',
              background: 'var(--cream)', fontSize: 13,
              boxSizing: 'border-box', outline: 'none',
              color: 'var(--ink)',
            }}
          />
        </div>
      </div>

      {/* Modal nouveau chat privé */}
      {showNewChat && (
        <div style={{ padding: 16, background: 'var(--cream)', borderBottom: '1px solid var(--line)', maxHeight: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input
            value={searchStaff}
            onChange={e => setSearchStaff(e.target.value)}
            placeholder="Rechercher un collègue..."
            style={{
              width: '100%', padding: '9px 13px',
              borderRadius: 10, border: '1px solid var(--line-strong)',
              background: 'var(--paper)', fontSize: 13,
              boxSizing: 'border-box', outline: 'none',
              color: 'var(--ink)',
            }}
          />
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filteredStaff.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 10 }}>Aucun collègue trouvé.</p>}
            {filteredStaff.map(s => (
              <button
                key={s.id}
                onClick={() => startPrivateChat(s.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '8px 10px', borderRadius: 10,
                  border: 'none', background: 'transparent', cursor: 'pointer',
                  textAlign: 'left', transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--paper)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <Avatar text={initials(s.full_name)} color={avatarColor(s.id)} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.full_name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)' }}>{ROLES[s.role]?.label || s.role}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Liste des conversations */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filteredConvs.length === 0 && (
          <div style={{ padding: 30, textAlign: 'center' }}>
            <i className="ti ti-message-circle" style={{ fontSize: 40, color: 'var(--line-strong)' }}></i>
            <p style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--muted)' }}>Aucune conversation.</p>
          </div>
        )}
        {filteredConvs.map(c => {
          const info = getConvInfo(c);
          const unread = unreadCounts[c.id] || 0;
          const last = lastMessages[c.id];
          const isActive = activeConv?.id === c.id && !isMobile;
          return (
            <div
              key={c.id}
              onClick={() => openConversation(c)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', cursor: 'pointer',
                background: isActive ? 'var(--forest-light)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--forest)' : '3px solid transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--cream)'; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <Avatar text={info.initials} color={info.color} size={44} isGroup={info.isGroup} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <p style={{
                    margin: 0, fontSize: 13.5,
                    fontWeight: unread > 0 ? 700 : 600,
                    color: 'var(--ink)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {info.name}
                  </p>
                  {last && (
                    <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>
                      {formatTime(last.created_at)}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <p style={{
                    margin: 0, fontSize: 12,
                    color: 'var(--muted)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    fontWeight: unread > 0 ? 600 : 400,
                  }}>
                    {last ? (last.sender_id === profile.id ? 'Vous : ' : '') + last.content : info.subtitle}
                  </p>
                  {unread > 0 && (
                    <span style={{
                      background: 'var(--danger)', color: '#fff',
                      fontSize: 10.5, fontWeight: 700,
                      padding: '2px 7px', borderRadius: 10,
                      minWidth: 18, textAlign: 'center', flexShrink: 0,
                    }}>
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ============== VUE CONVERSATION ==============
  const renderConversation = () => {
    const info = activeConv ? getConvInfo(activeConv) : null;
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: 'var(--paper)', borderRadius: 16,
        border: '1px solid var(--line)',
        overflow: 'hidden',
        height: isMobile ? 'calc(100vh - 120px)' : 'calc(100vh - 120px)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      }}>
        {error && (
          <div style={{ padding: 12, background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 12, borderBottom: '1px solid var(--danger)' }}>
            {error}
          </div>
        )}
        
        {activeConv ? (
          <>
            {/* Header */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--line)',
              background: 'linear-gradient(180deg, var(--forest-light), transparent)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              {isMobile && (
                <button
                  onClick={() => setActiveConv(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--forest)', fontSize: 22, padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  <i className="ti ti-arrow-left"></i>
                </button>
              )}
              <Avatar text={info.initials} color={info.color} size={42} isGroup={info.isGroup} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {info.name}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                  {info.isGroup ? (
                    <>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', boxShadow: '0 0 0 2px rgba(46,107,71,0.2)' }}></span>
                      <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 500 }}>En ligne · {conversations.length} participant{conversations.length > 1 ? 's' : ''}</span>
                    </>
                  ) : (
                    <span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 500 }}>{info.subtitle}</span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Zone messages */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              style={{
                flex: 1, overflowY: 'auto',
                padding: '20px 20px 10px',
                display: 'flex', flexDirection: 'column', gap: 2,
                background: 'var(--cream)',
                position: 'relative',
              }}
            >
              {messages.length === 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center' }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--forest-light), var(--gold-light))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginBottom: 16,
                  }}>
                    <i className="ti ti-message-circle-heart" style={{ fontSize: 38, color: 'var(--forest)' }}></i>
                  </div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Aucun message pour l'instant</p>
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--muted)', maxWidth: 280, lineHeight: 1.5 }}>
                    Écrivez le premier message pour lancer la conversation.
                  </p>
                </div>
              )}

              {groupedMessages.map((item) => {
                if (item.type === 'date') {
                  return (
                    <div key={item.key} style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
                      <span style={{
                        background: 'var(--paper)', border: '1px solid var(--line)',
                        padding: '4px 12px', borderRadius: 20,
                        fontSize: 10.5, fontWeight: 700,
                        color: 'var(--muted)', textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        {item.label}
                      </span>
                    </div>
                  );
                }
                
                const m = item.data;
                const isMe = m.sender_id === profile.id;
                const senderName = m.profiles?.full_name || 'Utilisateur';
                const senderRole = m.profiles?.role ? ROLES[m.profiles.role]?.label : null;

                return (
                  <div
                    key={item.key}
                    style={{
                      display: 'flex',
                      alignSelf: isMe ? 'flex-end' : 'flex-start',
                      flexDirection: isMe ? 'row-reverse' : 'row',
                      alignItems: 'flex-end',
                      gap: 8,
                      maxWidth: '78%',
                      marginTop: 6,
                    }}
                  >
                    {!isMe && (
                      <Avatar text={initials(senderName)} color={avatarColor(m.sender_id)} size={30} />
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      {!isMe && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, paddingLeft: 4 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink)' }}>{senderName}</span>
                          {senderRole && (
                            <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--muted)', padding: '1px 6px', borderRadius: 6, background: 'var(--line)' }}>
                              {senderRole}
                            </span>
                          )}
                        </div>
                      )}
                      <div style={{
                        background: isMe 
                          ? 'linear-gradient(135deg, var(--forest), var(--forest-dark))' 
                          : 'var(--paper)',
                        color: isMe ? '#fff' : 'var(--ink)',
                        padding: '10px 14px',
                        borderRadius: 18,
                        borderBottomRightRadius: isMe ? 4 : 18,
                        borderBottomLeftRadius: isMe ? 18 : 4,
                        fontSize: 13.5,
                        lineHeight: 1.45,
                        boxShadow: isMe 
                          ? '0 3px 10px rgba(15,76,58,0.25)' 
                          : '0 1px 3px rgba(0,0,0,0.06)',
                        border: isMe ? 'none' : '1px solid var(--line)',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                      }}>
                        {m.content}
                      </div>
                      <span style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 3, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0, fontWeight: 500 }}>
                        {formatTime(m.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Bouton scroll down */}
            {showScrollDown && (
              <button
                onClick={scrollToBottom}
                style={{
                  position: 'absolute', bottom: 90, right: 30,
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'var(--paper)', border: '1px solid var(--line-strong)',
                  color: 'var(--forest)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                  zIndex: 5,
                }}
              >
                <i className="ti ti-chevron-down" style={{ fontSize: 20 }}></i>
              </button>
            )}

            {/* Input zone */}
            <form onSubmit={sendMessage} style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--line)',
              background: 'var(--paper)',
              display: 'flex', gap: 10, alignItems: 'center',
            }}>
              <input 
                value={newMessage} 
                onChange={e => setNewMessage(e.target.value)} 
                placeholder="Écrire un message..." 
                style={{
                  flex: 1,
                  padding: '12px 18px',
                  borderRadius: 24,
                  border: '1px solid var(--line-strong)',
                  fontSize: 13.5,
                  outline: 'none',
                  background: 'var(--cream)',
                  color: 'var(--ink)',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--forest)'; e.currentTarget.style.background = 'var(--paper)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = 'var(--line-strong)'; e.currentTarget.style.background = 'var(--cream)'; }}
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                style={{
                  width: 44, height: 44, borderRadius: '50%',
                  border: 'none',
                  background: newMessage.trim() 
                    ? 'linear-gradient(135deg, var(--forest), var(--forest-dark))' 
                    : 'var(--line)',
                  color: '#fff',
                  cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: newMessage.trim() ? '0 4px 12px rgba(15,76,58,0.3)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <i className="ti ti-send" style={{ fontSize: 18, marginLeft: -2 }}></i>
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--forest-light), var(--gold-light))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 20,
            }}>
              <i className="ti ti-message-chatbot" style={{ fontSize: 46, color: 'var(--forest)' }}></i>
            </div>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>
              Bienvenue dans la messagerie
            </p>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)', maxWidth: 320, lineHeight: 1.6 }}>
              Sélectionnez une conversation à gauche pour commencer à échanger avec votre équipe.
            </p>
          </div>
        )}
      </div>
    );
  };

  // ============== AFFICHAGE ==============
  if (isMobile) {
    return (
      <div style={{ height: 'calc(100vh - 120px)', padding: '0 4px' }}>
        {activeConv ? renderConversation() : renderConversationList()}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 16 }}>
      {renderConversationList()}
      {renderConversation()}
    </div>
  );
}
