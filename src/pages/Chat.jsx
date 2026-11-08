import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials, ROLES } from '../lib/utils.js';

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
  const messagesEndRef = useRef(null);

  // Détection mobile
  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 768);
    }
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

      if (staffErr) {
        setError("Impossible de charger la liste des collègues.");
      } else {
        setStaff(staffData || []);
      }

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

  // 3. Écouter les nouveaux messages en temps réel
  useEffect(() => {
    if (!activeConv) return;

    // Charger l'historique
    supabase.from('chat_messages')
      .select('*, profiles(full_name)')
      .eq('conversation_id', activeConv.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages(data || []);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        // Marquer comme lu
        supabase.rpc('mark_conversation_read', { p_conversation_id: activeConv.id });
        setUnreadCounts(prev => ({ ...prev, [activeConv.id]: 0 }));
      });

    // Écouter les nouveaux messages
    const channel = supabase.channel(`chat_${activeConv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${activeConv.id}` }, async (payload) => {
        const { data: author } = await supabase.from('profiles').select('full_name').eq('id', payload.new.sender_id).single();
        setMessages(prev => [...prev, { ...payload.new, profiles: author }]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
        
        // Si le message vient d'un autre, marquer comme lu
        if (payload.new.sender_id !== profile.id) {
          supabase.rpc('mark_conversation_read', { p_conversation_id: activeConv.id });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConv?.id]);

  // 4. Écouter les nouveaux messages sur TOUTES les conversations (pour badges)
  useEffect(() => {
    const channel = supabase.channel('all_chats')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        // Ne pas compter si c'est notre propre message
        if (payload.new.sender_id === profile.id) return;
        
        // Ne pas compter si c'est la conversation ouverte
        if (activeConv && payload.new.conversation_id === activeConv.id) return;
        
        // Incrémenter le compteur
        setUnreadCounts(prev => ({
          ...prev,
          [payload.new.conversation_id]: (prev[payload.new.conversation_id] || 0) + 1
        }));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConv, profile.id]);

  // 5. Envoyer un message
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

    // Envoyer notification push aux autres participants
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

  // 6. Démarrer une conversation privée
  async function startPrivateChat(otherUserId) {
    const { data: convId, error: rpcError } = await supabase.rpc('create_private_chat', { p_other_user_id: otherUserId });
    if (rpcError) { setError("Erreur chat privé : " + rpcError.message); return; }
    
    const { data: convs } = await supabase.from('chat_conversations').select('*, chat_participants ( user_id, last_read_at, profiles ( full_name ) )');
    const visibleConvs = (convs || []).filter(c => c.type === 'general' || c.chat_participants.some(p => p.user_id === profile.id));
    setConversations(visibleConvs);
    await loadUnreadCounts(visibleConvs);
    
    const target = visibleConvs.find(c => c.id === convId);
    if (target) setActiveConv(target);
    setShowNewChat(false);
  }

  // 7. Ouvrir une conversation
  function openConversation(c) {
    setActiveConv(c);
    if (isMobile) setShowNewChat(false);
  }

  const getConvTitle = (c) => {
    if (c.type === 'general') return 'Général (Toute l\'école)';
    const other = c.chat_participants?.find(p => p.user_id !== profile.id);
    return other?.profiles?.full_name || 'Conversation privée';
  };

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  // ============== VUE LISTE (mobile et desktop) ==============
  const renderConversationList = () => (
    <div className="card-bold" style={{ width: isMobile ? '100%' : 300, display: 'flex', flexDirection: 'column', flexShrink: 0, height: isMobile ? 'calc(100vh - 120px)' : 'auto' }}>
      <div style={{ padding: 16, borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 18, fontWeight: 600 }}>
          Messagerie
          {totalUnread > 0 && (
            <span style={{ marginLeft: 8, background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
              {totalUnread}
            </span>
          )}
        </p>
        <button onClick={() => setShowNewChat(!showNewChat)} style={{ padding: '8px 12px', borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
          <i className="ti ti-plus" style={{ fontSize: 14 }}></i>
        </button>
      </div>
      
      {showNewChat && (
        <div style={{ padding: 12, background: 'var(--cream)', borderBottom: '1px solid var(--line)', maxHeight: 200, overflowY: 'auto' }}>
          <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Choisir un collègue :</p>
          {staff.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)' }}>Aucun collègue trouvé.</p>}
          {staff.map(s => (
            <button key={s.id} onClick={() => startPrivateChat(s.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--ink)' }}>
              {s.full_name} <span style={{ color: 'var(--muted)', fontSize: 11 }}>({ROLES[s.role]?.label || s.role})</span>
            </button>
          ))}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {conversations.length === 0 && <p style={{ padding: 16, fontSize: 13, color: 'var(--muted)' }}>Aucune conversation.</p>}
        {conversations.map(c => {
          const unread = unreadCounts[c.id] || 0;
          return (
            <div key={c.id} onClick={() => openConversation(c)} style={{ padding: 14, cursor: 'pointer', borderBottom: '1px solid var(--line)', background: activeConv?.id === c.id && !isMobile ? 'var(--forest-light)' : 'transparent', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 13.5, fontWeight: unread > 0 ? 700 : 600, color: activeConv?.id === c.id && !isMobile ? 'var(--forest-dark)' : 'var(--ink)' }}>{getConvTitle(c)}</p>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>{c.type === 'general' ? 'Canal d\'école' : 'Message privé'}</p>
              </div>
              {unread > 0 && (
                <span style={{ background: 'var(--danger)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 12, minWidth: 20, textAlign: 'center' }}>
                  {unread}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ============== VUE CONVERSATION ==============
  const renderConversation = () => (
    <div className="card-bold" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: isMobile ? 'calc(100vh - 120px)' : 'auto' }}>
      {error && <div style={{ padding: 10, background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 12, borderBottom: '1px solid var(--danger)' }}>{error}</div>}
      
      {activeConv ? (
        <>
          <div style={{ padding: 16, borderBottom: '1px solid var(--line)', background: 'var(--paper)', display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <button onClick={() => setActiveConv(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--forest)', fontSize: 20, padding: 0 }}>
                <i className="ti ti-arrow-left"></i>
              </button>
            )}
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{getConvTitle(activeConv)}</p>
          </div>
          
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, marginTop: 20 }}>Aucun message. Écrivez le premier !</p>}
            {messages.map(m => {
              const isMe = m.sender_id === profile.id;
              return (
                <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                  {!isMe && <p style={{ margin: '0 0 4px 4px', fontSize: 11, color: 'var(--muted)', fontWeight: 600 }}>{m.profiles?.full_name || 'Utilisateur'}</p>}
                  <div style={{ background: isMe ? 'var(--forest)' : 'var(--line)', color: isMe ? '#fff' : 'var(--ink)', padding: '10px 14px', borderRadius: 12, borderTopRightRadius: isMe ? 2 : 12, borderTopLeftRadius: isMe ? 12 : 2, fontSize: 13.5, lineHeight: 1.4 }}>
                    {m.content}
                  </div>
                  <p style={{ margin: '4px 4px 0', fontSize: 10, color: 'var(--muted)', textAlign: isMe ? 'right' : 'left' }}>
                    {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={sendMessage} style={{ padding: 16, borderTop: '1px solid var(--line)', display: 'flex', gap: 10 }}>
            <input 
              value={newMessage} 
              onChange={e => setNewMessage(e.target.value)} 
              placeholder="Écrire un message..." 
              style={{ flex: 1, padding: '12px 16px', borderRadius: 24, border: '1px solid var(--line-strong)', fontSize: 14, outline: 'none', background: 'var(--paper)', color: 'var(--ink)' }}
            />
            <button type="submit" disabled={!newMessage.trim()} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'var(--forest)', color: '#fff', cursor: 'pointer', opacity: newMessage.trim() ? 1 : 0.5 }}>
              <i className="ti ti-send" style={{ fontSize: 18, marginLeft: -2 }}></i>
            </button>
          </form>
        </>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
          <p>Sélectionnez une conversation.</p>
        </div>
      )}
    </div>
  );

  // ============== AFFICHAGE ==============
  if (isMobile) {
    return (
      <div style={{ height: 'calc(100vh - 120px)' }}>
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
