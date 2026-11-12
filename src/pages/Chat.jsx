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

function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {}
}

function markAsRead(conversationId) {
  const iso = new Date().toISOString();
  try { localStorage.setItem(`chat_read_${conversationId}`, iso); } catch {}
  supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId }).then(({ error }) => {
    if (error) console.warn('🔴 [Chat] mark_conversation_read a échoué :', error.message);
  });
}

function SecureChatImage({ src, isMe }) {
  const [displayUrl, setDisplayUrl] = useState(null);
  useEffect(() => {
    if (!src) return;
    if (src.startsWith('http')) { setDisplayUrl(src); return; }
    supabase.storage.from('chat-files').createSignedUrl(src, 3600).then(({ data }) => {
      if (data) setDisplayUrl(data.signedUrl);
    });
  }, [src]);
  if (!displayUrl) return <div style={{ width: 200, height: 150, background: 'var(--line)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="ti ti-loader animate-spin"></i></div>;
  return (
    <a href={displayUrl} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
      <img src={displayUrl} alt="" style={{ maxWidth: 240, maxHeight: 240, borderRadius: 10, display: 'block', border: isMe ? '2px solid rgba(255,255,255,0.2)' : '1px solid var(--line)' }} />
    </a>
  );
}

export default function Chat() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [pendingFile, setPendingFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [staff, setStaff] = useState([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showConvMenu, setShowConvMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [searchConv, setSearchConv] = useState('');
  const [searchStaff, setSearchStaff] = useState('');
  const [showScrollDown, setShowScrollDown] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const convMenuRef = useRef(null);
  const fileInputRef = useRef(null);

  if (!profile) return null;

  const getConvInfo = (c) => {
    if (c.type === 'general') return { name: c.name || 'Général', subtitle: 'Toute l\'école', initials: '🌍', color: 'var(--forest)', isGroup: true };
    const other = c.chat_participants?.find(p => p.user_id !== profile.id);
    const name = other?.profiles?.full_name || 'Conversation privée';
    const role = other?.profiles?.role ? ROLES[other.profiles.role]?.label : null;
    return { name, subtitle: role || 'Message privé', initials: initials(name), color: avatarColor(other?.user_id || c.id), isGroup: false };
  };

  useEffect(() => {
    // Cache la barre de navigation du bas sur mobile quand on est dans le chat
    const bottomNav = document.getElementById('bottomnav');
    if (bottomNav && isMobile) {
      const prevDisplay = bottomNav.style.display;
      bottomNav.style.display = 'none';
      return () => { bottomNav.style.display = prevDisplay; };
    }
  }, [isMobile]);

  useEffect(() => {
    function checkMobile() { setIsMobile(window.innerWidth < 768); }
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (!showConvMenu) return;
    function handleClick(e) {
      if (convMenuRef.current && !convMenuRef.current.contains(e.target)) setShowConvMenu(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showConvMenu]);

  useEffect(() => {
    async function load() {
      setError('');
      const { data: staffData, error: staffErr } = await supabase.from('profiles').select('id, full_name, role').eq('school_id', profile.school_id).neq('id', profile.id);
      if (staffErr) setError("Impossible de charger la liste des collègues."); else setStaff(staffData || []);

      const { data: convs, error: convsErr } = await supabase.from('chat_conversations').select(`id, type, name, chat_participants ( user_id, last_read_at, profiles ( full_name, role ) )`);
      if (convsErr) { setError("Impossible de charger les conversations."); return; }
      
      const generals = (convs || []).filter(c => c.type === 'general').sort((a, b) => (a.id < b.id ? -1 : 1));
      const firstGeneral = generals[0];
      const privates = (convs || []).filter(c => c.type === 'private' && c.chat_participants && c.chat_participants.some(p => p.user_id === profile.id));
      const visibleConvs = firstGeneral ? [firstGeneral, ...privates] : privates;

      setConversations(visibleConvs);
      await loadUnreadCounts(visibleConvs);
      await loadLastMessages(visibleConvs);
      
      if (firstGeneral && !isMobile && !activeConv) setActiveConv(firstGeneral);
    }
    load();
  }, [profile.school_id, profile.id, isMobile]);

  async function loadUnreadCounts(convs) {
    const counts = {};
    for (const conv of convs) {
      const me = conv.chat_participants?.find(p => p.user_id === profile.id);
      const dbLastRead = me?.last_read_at || null;
      let localLastRead = null;
      try { localLastRead = localStorage.getItem(`chat_read_${conv.id}`); } catch {}
      let lastRead = null;
      if (dbLastRead && localLastRead) lastRead = new Date(dbLastRead) > new Date(localLastRead) ? dbLastRead : localLastRead;
      else lastRead = dbLastRead || localLastRead;
      if (!lastRead) { counts[conv.id] = 0; continue; }
      const { count } = await supabase.from('chat_messages').select('id', { count: 'exact', head: true }).eq('conversation_id', conv.id).neq('sender_id', profile.id).gt('created_at', lastRead);
      counts[conv.id] = count || 0;
    }
    setUnreadCounts(counts);
  }

  async function loadLastMessages(convs) {
    if (convs.length === 0) return;
    const ids = convs.map(c => c.id);
    const { data } = await supabase.from('chat_messages').select('conversation_id, content, created_at, sender_id, file_name, file_type').in('conversation_id', ids).order('created_at', { ascending: false });
    const map = {};
    (data || []).forEach(m => { if (!map[m.conversation_id]) map[m.conversation_id] = m; });
    setLastMessages(map);
  }

  useEffect(() => {
    if (!activeConv) return;
    supabase.from('chat_messages').select('*, profiles(full_name, role)').eq('conversation_id', activeConv.id).order('created_at', { ascending: true }).then(({ data }) => {
      setMessages(data || []);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      markAsRead(activeConv.id);
      setUnreadCounts(prev => ({ ...prev, [activeConv.id]: 0 }));
    });

    const channel = supabase.channel(`chat_${activeConv.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${activeConv.id}` }, async (payload) => {
      const { data: author } = await supabase.from('profiles').select('full_name, role').eq('id', payload.new.sender_id).single();
      setMessages(prev => [...prev, { ...payload.new, profiles: author }]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      if (payload.new.sender_id !== profile.id) { markAsRead(activeConv.id); playNotificationSound(); }
      setLastMessages(prev => ({ ...prev, [activeConv.id]: payload.new }));
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConv?.id]);

  useEffect(() => {
    const channel = supabase.channel('all_chats').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
      if (payload.new.sender_id === profile.id) return;
      if (activeConv && payload.new.conversation_id === activeConv.id) return;
      setUnreadCounts(prev => ({ ...prev, [payload.new.conversation_id]: (prev[payload.new.conversation_id] || 0) + 1 }));
      setLastMessages(prev => ({ ...prev, [payload.new.conversation_id]: payload.new }));
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConv, profile.id]);

  function handleScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight >= 100);
  }
  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollDown(false);
  }

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { setError('Fichier trop lourd (max 10 Mo).'); return; }
    const isImage = file.type.startsWith('image/');
    setPendingFile({ file, preview: isImage ? URL.createObjectURL(file) : null, type: isImage ? 'image' : 'file' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function clearPendingFile() {
    if (pendingFile?.preview) URL.revokeObjectURL(pendingFile.preview);
    setPendingFile(null);
  }

  async function uploadFile(file) {
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `${profile.school_id}/${activeConv.id}/${fileName}`;
    const { error: uploadErr } = await supabase.storage.from('chat-files').upload(path, file, { upsert: false });
    if (uploadErr) throw uploadErr;
    return path;
  }

  async function sendMessage(e) {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !pendingFile) || !activeConv) return;
    const content = newMessage.trim();
    const fileToSend = pendingFile;
    setNewMessage('');
    setPendingFile(null);
    setUploading(true);
    setError('');
    try {
      let filePath = null, fileType = null, fileName = null;
      if (fileToSend) {
        filePath = await uploadFile(fileToSend.file);
        fileType = fileToSend.type;
        fileName = fileToSend.file.name;
        if (fileToSend.preview) URL.revokeObjectURL(fileToSend.preview);
      }
      const { data: inserted, error: sendErr } = await supabase.from('chat_messages').insert({
        conversation_id: activeConv.id, sender_id: profile.id, content: content || null, file_url: filePath, file_type: fileType, file_name: fileName,
      }).select('id').single();
      if (sendErr) throw sendErr;
      if (inserted) {
        const pushBody = fileType ? `📎 ${fileName}` : content;
        try {
          await supabase.functions.invoke('send-message-push', { body: { conversation_id: activeConv.id, sender_name: profile.full_name, message_content: pushBody, sender_id: profile.id } });
        } catch (err) { console.warn("Push chat non envoyé", err); }
      }
    } catch (err) { setError("Erreur d'envoi : " + err.message); }
    setUploading(false);
  }

  async function handleDeleteConversation() {
    if (!activeConv) return;
    setShowConvMenu(false);
    const isGeneral = activeConv.type === 'general';
    const confirmMessage = isGeneral ? `⚠️ Effacer TOUT l'historique du canal "${activeConv.name || 'Général'}" ?` : `⚠️ Supprimer cette conversation privée ?`;
    if (!window.confirm(confirmMessage)) return;
    setDeleting(true);
    try {
      if (isGeneral) {
        const { error: delErr } = await supabase.from('chat_messages').delete().eq('conversation_id', activeConv.id);
        if (delErr) throw delErr;
        setMessages([]);
        setLastMessages(prev => ({ ...prev, [activeConv.id]: null }));
      } else {
        const { error: delErr } = await supabase.from('chat_conversations').delete().eq('id', activeConv.id);
        if (delErr) throw delErr;
        setConversations(prev => prev.filter(c => c.id !== activeConv.id));
        setActiveConv(null);
        setMessages([]);
      }
    } catch (err) { setError("Erreur de suppression : " + err.message); }
    setDeleting(false);
  }

  async function startPrivateChat(otherUserId) {
    const { data: convId, error: rpcError } = await supabase.rpc('create_private_chat', { p_other_user_id: otherUserId });
    if (rpcError) { setError("Erreur chat privé : " + rpcError.message); return; }
    const { data: convs } = await supabase.from('chat_conversations').select('*, chat_participants ( user_id, last_read_at, profiles ( full_name, role ) )');
    const generals = (convs || []).filter(c => c.type === 'general').sort((a, b) => (a.id < b.id ? -1 : 1));
    const firstGeneral = generals[0];
    const privates = (convs || []).filter(c => c.type === 'private' && c.chat_participants.some(p => p.user_id === profile.id));
    const visibleConvs = firstGeneral ? [firstGeneral, ...privates] : privates;
    setConversations(visibleConvs);
    await loadUnreadCounts(visibleConvs);
    await loadLastMessages(visibleConvs);
    const target = visibleConvs.find(c => c.id === convId);
    if (target) setActiveConv(target);
    setShowNewChat(false);
    setSearchStaff('');
  }

  function openConversation(c) {
    setActiveConv(c);
    setShowConvMenu(false);
    if (isMobile) setShowNewChat(false);
  }

  const totalUnread = Object.values(unreadCounts).reduce((a, b) => a + b, 0);

  const filteredConvs = useMemo(() => {
    const generals = conversations.filter(c => c.type === 'general');
    const privates = conversations.filter(c => c.type === 'private');
    const sortedPrivates = [...privates].sort((a, b) => {
      const lastA = lastMessages[a.id]?.created_at;
      const lastB = lastMessages[b.id]?.created_at;
      if (!lastA && !lastB) return 0;
      if (!lastA) return 1;
      if (!lastB) return -1;
      return new Date(lastB) - new Date(lastA);
    });
    const searchFilter = (c) => !searchConv.trim() || getConvInfo(c).name.toLowerCase().includes(searchConv.toLowerCase());
    return [...generals, ...sortedPrivates.filter(searchFilter)];
  }, [conversations, lastMessages, searchConv]);

  const filteredStaff = useMemo(() => {
    if (!searchStaff.trim()) return staff;
    return staff.filter(s => s.full_name.toLowerCase().includes(searchStaff.toLowerCase()));
  }, [staff, searchStaff]);

  const groupedMessages = useMemo(() => {
    const groups = [];
    let currentDate = null;
    messages.forEach(m => {
      const d = formatConvDate(m.created_at);
      if (d !== currentDate) { groups.push({ type: 'date', label: d, key: `date-${m.id}` }); currentDate = d; }
      groups.push({ type: 'message', data: m, key: m.id });
    });
    return groups;
  }, [messages]);

  const Avatar = ({ text, color, size = 42, isGroup }) => (
    <div style={{ width: size, height: size, borderRadius: '50%', background: isGroup ? 'var(--forest)' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.35, flexShrink: 0 }}>
      {text}
    </div>
  );

  const handleFileClick = async (e, m) => {
    e.preventDefault();
    if (!m.file_url) return;
    if (m.file_url.startsWith('http')) { window.open(m.file_url, '_blank', 'noopener'); return; }
    const { data } = await supabase.storage.from('chat-files').createSignedUrl(m.file_url, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
    else alert("Impossible d'ouvrir le fichier.");
  };

  const MessageContent = ({ m, isMe }) => {
    if (m.file_type === 'image' && m.file_url) return <div style={{ display: 'block', marginBottom: m.content ? 8 : 0 }}><SecureChatImage src={m.file_url} isMe={isMe} /></div>;
    if (m.file_type === 'file' && m.file_url) {
      return (
        <button type="button" onClick={(e) => handleFileClick(e, m)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: m.content ? 8 : 0, textDecoration: 'none', color: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
          <i className="ti ti-file" style={{ fontSize: 20 }}></i>
          <span style={{ fontSize: 12.5, textDecoration: 'underline', wordBreak: 'break-all' }}>{m.file_name}</span>
        </button>
      );
    }
    return null;
  };

  const renderConversationList = () => (
    <div style={{ width: isMobile ? '100%' : 340, display: 'flex', flexDirection: 'column', background: 'var(--paper)', borderRadius: 16, border: '1px solid var(--line)', overflow: 'hidden', height: '100%', minHeight: 0 }}>
      <div style={{ padding: '18px 20px 14px', background: 'var(--paper)', borderBottom: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>Messagerie</p>
            <p style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--muted)', fontWeight: 500 }}>{totalUnread > 0 ? `${totalUnread} message${totalUnread > 1 ? 's' : ''} non lu${totalUnread > 1 ? 's' : ''}` : 'Tout est à jour'}</p>
          </div>
          <button onClick={() => setShowNewChat(!showNewChat)} title="Nouveau message privé" style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'var(--forest-dark)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="ti ti-plus" style={{ fontSize: 20 }}></i>
          </button>
        </div>
        <div style={{ position: 'relative' }}>
          <i className="ti ti-search" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: 'var(--muted)' }}></i>
          <input value={searchConv} onChange={e => setSearchConv(e.target.value)} placeholder="Rechercher une conversation..." style={{ width: '100%', padding: '10px 14px 10px 38px', borderRadius: 12, border: '1px solid var(--line)', background: 'var(--cream)', fontSize: 13, boxSizing: 'border-box', outline: 'none', color: 'var(--ink)' }} />
        </div>
      </div>

      {showNewChat && (
        <div style={{ padding: 16, background: 'var(--cream)', borderBottom: '1px solid var(--line)', maxHeight: 280, display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          <input value={searchStaff} onChange={e => setSearchStaff(e.target.value)} placeholder="Rechercher un collègue..." style={{ width: '100%', padding: '9px 13px', borderRadius: 10, border: '1px solid var(--line-strong)', background: 'var(--paper)', fontSize: 13, boxSizing: 'border-box', outline: 'none', color: 'var(--ink)' }} />
          <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filteredStaff.length === 0 && <p style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', padding: 10 }}>Aucun collègue trouvé.</p>}
            {filteredStaff.map(s => (
              <button key={s.id} onClick={() => startPrivateChat(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 10px', borderRadius: 10, border: 'none', background: 'transparent', cursor: 'pointer', textAlign: 'left' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--paper)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
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

      <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', minHeight: 0 }}>
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
          const isPinned = c.type === 'general';
          const preview = last ? (last.file_type ? (last.file_type === 'image' ? '🖼️ Image' : '📎 Fichier') : (last.sender_id === profile.id ? 'Vous : ' : '') + last.content) : info.subtitle;
          return (
            <div key={c.id} onClick={() => openConversation(c)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: isActive ? 'var(--cream)' : 'transparent', borderLeft: isActive ? '3px solid var(--forest)' : '3px solid transparent', borderBottom: isPinned ? '1px solid var(--line)' : 'none' }} onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--cream)'; }} onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
              <Avatar text={info.initials} color={info.color} size={44} isGroup={info.isGroup} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1 }}>
                    {isPinned && <i className="ti ti-pin-filled" style={{ fontSize: 13, color: 'var(--muted)', flexShrink: 0 }} title="Épinglé"></i>}
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: unread > 0 ? 700 : 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.name}</p>
                  </div>
                  {last && <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>{formatTime(last.created_at)}</span>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: unread > 0 ? 600 : 400 }}>{preview}</p>
                  {unread > 0 && <span style={{ background: 'var(--danger)', color: '#fff', fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 10, minWidth: 18, textAlign: 'center', flexShrink: 0 }}>{unread > 99 ? '99+' : unread}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const renderConversation = () => {
    const info = activeConv ? getConvInfo(activeConv) : null;
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--paper)', borderRadius: isMobile ? 16 : 16, border: '1px solid var(--line)', overflow: 'hidden', height: '100%', minHeight: 0, position: 'relative' }}>
        {error && <div style={{ padding: 12, background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 12, borderBottom: '1px solid var(--danger)', flexShrink: 0 }}>{error}</div>}
        
        {activeConv ? (
          <>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--paper)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              {isMobile && <button onClick={() => setActiveConv(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--forest)', fontSize: 22, padding: 0, display: 'flex', alignItems: 'center' }}><i className="ti ti-arrow-left"></i></button>}
              <Avatar text={info.initials} color={info.color} size={42} isGroup={info.isGroup} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {activeConv.type === 'general' && <i className="ti ti-pin-filled" style={{ fontSize: 13, color: 'var(--muted)' }}></i>}
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.name}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
                  {info.isGroup ? (<><span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)' }}></span><span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 500 }}>En ligne · {conversations.length} participant{conversations.length > 1 ? 's' : ''}</span></>) : (<span style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 500 }}>{info.subtitle}</span>)}
                </div>
              </div>
              <div ref={convMenuRef} style={{ position: 'relative' }}>
                <button onClick={() => setShowConvMenu(v => !v)} disabled={deleting} title="Options" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 20, padding: 4, display: 'flex', alignItems: 'center', opacity: deleting ? 0.5 : 1 }}><i className="ti ti-dots-vertical"></i></button>
                {showConvMenu && (
                  <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: 4, background: 'var(--paper)', border: '1px solid var(--line-strong)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', minWidth: 220, zIndex: 50, overflow: 'hidden' }}>
                    <button onClick={handleDeleteConversation} disabled={deleting} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '11px 14px', fontSize: 13, fontWeight: 600, color: 'var(--danger)', cursor: deleting ? 'not-allowed' : 'pointer', border: 'none', background: 'none', textAlign: 'left', opacity: deleting ? 0.5 : 1 }} onMouseEnter={e => { if (!deleting) e.currentTarget.style.background = 'var(--danger-light)'; }} onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <i className="ti ti-trash" style={{ fontSize: 16 }}></i>
                      {activeConv.type === 'general' ? 'Effacer l\'historique' : 'Supprimer la conversation'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div ref={messagesContainerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 10px', display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--cream)', minHeight: 0, overscrollBehavior: 'contain' }}>
              {messages.length === 0 && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><i className="ti ti-message-circle-heart" style={{ fontSize: 38, color: 'var(--muted)' }}></i></div>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Aucun message pour l'instant</p>
                  <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--muted)', maxWidth: 280, lineHeight: 1.5 }}>Écrivez le premier message pour lancer la conversation.</p>
                </div>
              )}

              {groupedMessages.map((item) => {
                if (item.type === 'date') {
                  return (
                    <div key={item.key} style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 10px' }}>
                      <span style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '4px 12px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                    </div>
                  );
                }
                const m = item.data;
                const isMe = m.sender_id === profile.id;
                const senderName = m.profiles?.full_name || 'Utilisateur';
                const senderRole = m.profiles?.role ? ROLES[m.profiles.role]?.label : null;
                const hasFile = !!m.file_url;

                return (
                  <div key={item.key} style={{ display: 'flex', alignSelf: isMe ? 'flex-end' : 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 8, maxWidth: '78%', marginTop: 6 }}>
                    {!isMe && <Avatar text={initials(senderName)} color={avatarColor(m.sender_id)} size={30} />}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      {!isMe && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, paddingLeft: 4 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--ink)' }}>{senderName}</span>
                          {senderRole && <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--muted)', padding: '1px 6px', borderRadius: 6, background: 'var(--line)' }}>{senderRole}</span>}
                        </div>
                      )}
                      <div style={{ background: isMe ? 'var(--forest-dark)' : 'var(--paper)', color: isMe ? '#fff' : 'var(--ink)', padding: hasFile ? 8 : '10px 14px', borderRadius: 18, borderBottomRightRadius: isMe ? 4 : 18, borderBottomLeftRadius: isMe ? 18 : 4, fontSize: 13.5, lineHeight: 1.45, border: isMe ? 'none' : '1px solid var(--line)', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                        {hasFile && <MessageContent m={m} isMe={isMe} />}
                        {m.content && <div style={{ padding: hasFile ? '4px 6px 0' : 0 }}>{m.content}</div>}
                      </div>
                      <span style={{ fontSize: 9.5, color: 'var(--muted)', marginTop: 3, paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0, fontWeight: 500 }}>{formatTime(m.created_at)}</span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {showScrollDown && (
              <button onClick={scrollToBottom} style={{ position: 'absolute', bottom: 90, right: 30, width: 40, height: 40, borderRadius: '50%', background: 'var(--paper)', border: '1px solid var(--line-strong)', color: 'var(--forest)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5 }}>
                <i className="ti ti-chevron-down" style={{ fontSize: 20 }}></i>
              </button>
            )}

            {pendingFile && (
              <div style={{ padding: '10px 20px', borderTop: '1px solid var(--line)', background: 'var(--cream)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                {pendingFile.type === 'image' && pendingFile.preview ? (
                  <img src={pendingFile.preview} alt="preview" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--line)' }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: 8, background: 'var(--paper)', border: '1px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="ti ti-file" style={{ fontSize: 22, color: 'var(--muted)' }}></i></div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pendingFile.file.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: 'var(--muted)' }}>{(pendingFile.file.size / 1024).toFixed(0)} Ko</p>
                </div>
                <button onClick={clearPendingFile} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', fontSize: 18, padding: 4 }}><i className="ti ti-x"></i></button>
              </div>
            )}

            <form onSubmit={sendMessage} style={{ padding: '14px 20px', paddingBottom: 'calc(14px + env(safe-area-inset-bottom))', borderTop: pendingFile ? 'none' : '1px solid var(--line)', background: 'var(--paper)', display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
              <input ref={fileInputRef} type="file" onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" style={{ display: 'none' }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Joindre un fichier" style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'var(--cream)', color: 'var(--forest)', cursor: uploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: uploading ? 0.5 : 1 }}>
                <i className="ti ti-paperclip" style={{ fontSize: 18 }}></i>
              </button>
              <input value={newMessage} onChange={e => setNewMessage(e.target.value)} placeholder={pendingFile ? 'Ajouter un commentaire...' : 'Écrire un message...'} style={{ flex: 1, padding: '12px 18px', borderRadius: 24, border: '1px solid var(--line-strong)', fontSize: 13.5, outline: 'none', background: 'var(--cream)', color: 'var(--ink)', fontFamily: 'inherit' }} />
              <button type="submit" disabled={(!newMessage.trim() && !pendingFile) || uploading} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: (newMessage.trim() || pendingFile) && !uploading ? 'var(--forest-dark)' : 'var(--line)', color: '#fff', cursor: (newMessage.trim() || pendingFile) && !uploading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {uploading ? <i className="ti ti-loader" style={{ fontSize: 18, animation: 'spin 1s linear infinite' }}></i> : <i className="ti ti-send" style={{ fontSize: 18, marginLeft: -2 }}></i>}
              </button>
            </form>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40, textAlign: 'center' }}>
            <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}><i className="ti ti-message-chatbot" style={{ fontSize: 46, color: 'var(--muted)' }}></i></div>
            <p style={{ margin: 0, fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 700, color: 'var(--ink)' }}>Bienvenue dans la messagerie</p>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--muted)', maxWidth: 320, lineHeight: 1.6 }}>Sélectionnez une conversation à gauche pour commencer à échanger avec votre équipe.</p>
          </div>
        )}
      </div>
    );
  };

  if (isMobile) {
    return (
      <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', padding: '10px 10px 10px', boxSizing: 'border-box', overflow: 'hidden' }}>
        {activeConv ? renderConversation() : renderConversationList()}
      </div>
    );
  }
  
  return (
    <div style={{ display: 'flex', height: '100%', gap: 16, paddingTop: 16 }}>
      {renderConversationList()}
      {renderConversation()}
    </div>
  );
}
