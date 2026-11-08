import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials, ROLES } from '../lib/utils.js';
import Dropdown from '../components/Dropdown.jsx';

export default function Chat() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [staff, setStaff] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const messagesEndRef = useRef(null);

  // 1. Charger les conversations et le personnel
  useEffect(() => {
    async function load() {
      const { data: convs } = await supabase
        .from('chat_conversations')
        .select(`
          id, type, name,
          chat_participants ( user_id, profiles ( full_name, role ) )
        `);
      
      const { data: staffData } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('school_id', profile.school_id)
        .neq('id', profile.id); // On ne s'inclut pas soi-même

      setStaff(staffData || []);

      // S'il n'y a pas de canal "général", on le crée
      let generalConv = convs?.find(c => c.type === 'general');
      if (!generalConv) {
        const { data: newConv } = await supabase.from('chat_conversations').insert({ school_id: profile.school_id, type: 'general', name: 'Général' }).select().single();
        generalConv = newConv;
        if (generalConv) setConversations([generalConv]);
      } else {
        // Filtrer les conversations privées pour ne voir que celles où je suis participant
        const visibleConvs = convs.filter(c => 
          c.type === 'general' || c.chat_participants.some(p => p.user_id === profile.id)
        );
        setConversations(visibleConvs);
      }
    }
    load();
  }, [profile.school_id, profile.id]);

  // 2. Écouter les nouveaux messages en temps réel
  useEffect(() => {
    if (!activeConv) return;

    supabase.from('chat_messages').select('*, profiles(full_name)').eq('conversation_id', activeConv.id).order('created_at', { ascending: true }).then(({ data }) => {
      setMessages(data || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    const channel = supabase.channel(`chat_${activeConv.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${activeConv.id}` }, async (payload) => {
        // Récupérer le nom de l'auteur
        const { data: author } = await supabase.from('profiles').select('full_name').eq('id', payload.new.sender_id).single();
        setMessages(prev => [...prev, { ...payload.new, profiles: author }]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConv]);

  // 3. Envoyer un message
  async function sendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim() || !activeConv) return;
    
    const content = newMessage.trim();
    setNewMessage('');
    
    await supabase.from('chat_messages').insert({
      conversation_id: activeConv.id,
      sender_id: profile.id,
      content
    });
  }

  // 4. Démarrer une conversation privée
  async function startPrivateChat(otherUserId) {
    const { data: convId, error } = await supabase.rpc('create_private_chat', { p_other_user_id: otherUserId });
    if (error) { alert(error.message); return; }
    
    // Recharger les conversations
    const { data: convs } = await supabase.from('chat_conversations').select('*, chat_participants ( user_id, profiles ( full_name ) )');
    const visibleConvs = convs.filter(c => c.type === 'general' || c.chat_participants.some(p => p.user_id === profile.id));
    setConversations(visibleConvs);
    
    const target = visibleConvs.find(c => c.id === convId);
    if (target) setActiveConv(target);
    setShowNewChat(false);
  }

  const getConvTitle = (c) => {
    if (c.type === 'general') return 'Général (Toute l\'école)';
    const other = c.chat_participants.find(p => p.user_id !== profile.id);
    return other?.profiles?.full_name || 'Conversation privée';
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 120px)', gap: 16 }}>
      {/* COLONNE GAUCHE : LISTE DES CONVERSATIONS */}
      <div className="card-bold" style={{ width: 300, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ padding: 16, borderBottom: '1px solid var(--line)' }}>
          <button onClick={() => setShowNewChat(!showNewChat)} style={{ width: '100%', padding: 10, borderRadius: 9, border: 'none', background: 'var(--forest)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
            <i className="ti ti-plus" style={{ fontSize: 14, marginRight: 6 }}></i>Nouveau message privé
          </button>
        </div>
        
        {showNewChat && (
          <div style={{ padding: 12, background: 'var(--cream)', borderBottom: '1px solid var(--line)', maxHeight: 200, overflowY: 'auto' }}>
            <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, color: 'var(--muted)' }}>Choisir un collègue :</p>
            {staff.map(s => (
              <button key={s.id} onClick={() => startPrivateChat(s.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
                {s.full_name} <span style={{ color: 'var(--muted)', fontSize: 11 }}>({ROLES[s.role]?.label || s.role})</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {conversations.map(c => (
            <div key={c.id} onClick={() => setActiveConv(c)} style={{ padding: 14, cursor: 'pointer', borderBottom: '1px solid var(--line)', background: activeConv?.id === c.id ? 'var(--forest-light)' : 'transparent' }}>
              <p style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: activeConv?.id === c.id ? 'var(--forest-dark)' : 'var(--ink)' }}>{getConvTitle(c)}</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--muted)' }}>{c.type === 'general' ? 'Canal d\'école' : 'Message privé'}</p>
            </div>
          ))}
        </div>
      </div>

      {/* COLONNE DROITE : MESSAGES */}
      <div className="card-bold" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeConv ? (
          <>
            <div style={{ padding: 16, borderBottom: '1px solid var(--line)', background: 'var(--paper)' }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{getConvTitle(activeConv)}</p>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {messages.map(m => {
                const isMe = m.sender_id === profile.id;
                return (
                  <div key={m.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
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
                style={{ flex: 1, padding: '12px 16px', borderRadius: 24, border: '1px solid var(--line-strong)', fontSize: 14, outline: 'none' }}
              />
              <button type="submit" disabled={!newMessage.trim()} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'var(--forest)', color: '#fff', cursor: 'pointer', opacity: newMessage.trim() ? 1 : 0.5 }}>
                <i className="ti ti-send" style={{ fontSize: 18, marginLeft: -2 }}></i>
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
            <p>Sélectionnez une conversation pour commencer.</p>
          </div>
        )}
      </div>
    </div>
  );
}
