import { useEffect, useLayoutEffect, useState, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials, ROLES } from '../lib/utils.js';
import { useOnlineUsers } from '../lib/presence.js';

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
  } catch { /* son non disponible : on ignore */ }
}

function markAsRead(conversationId) {
  const iso = new Date().toISOString();
  try { localStorage.setItem(`chat_read_${conversationId}`, iso); } catch { /* stockage indisponible : on ignore */ }
  supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId }).then(({ error }) => {
    if (error) console.warn('🔴 [Chat] mark_conversation_read a échoué :', error.message);
  });
}

function latestDate(a, b) {
  if (a && b) return new Date(a) > new Date(b) ? a : b;
  return a || b || null;
}

function Avatar({ text, color, size = 42, isGroup, online }) {
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <div style={{ width: size, height: size, borderRadius: '50%', background: isGroup ? 'var(--forest)' : color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: size * 0.35 }}>
        {text}
      </div>
      {online && <span title="En ligne" style={{ position: 'absolute', right: 0, bottom: 0, width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26), borderRadius: '50%', background: '#25D366', border: '2px solid var(--paper)', boxSizing: 'border-box' }}></span>}
    </div>
  );
}

function SecureChatImage({ src, isMe, onLoad }) {
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
      <img src={displayUrl} alt="" onLoad={onLoad} style={{ maxWidth: 240, maxHeight: 240, borderRadius: 10, display: 'block', border: isMe ? '2px solid rgba(255,255,255,0.2)' : '1px solid var(--line)' }} />
    </a>
  );
}

async function openFile(m) {
  if (!m.file_url) return;
  if (m.file_url.startsWith('http')) { window.open(m.file_url, '_blank', 'noopener'); return; }
  const { data } = await supabase.storage.from('chat-files').createSignedUrl(m.file_url, 300);
  if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  else alert("Impossible d'ouvrir le fichier.");
}

function MessageContent({ m, isMe, onImageLoad }) {
  const gap = m.content ? 8 : 0;
  // Message en cours d'envoi : on montre tout de suite l'aperçu local.
  if (m._status && m.file_type === 'image' && m._localPreview) {
    return <img src={m._localPreview} alt="" onLoad={onImageLoad} style={{ display: 'block', maxWidth: 240, maxHeight: 240, borderRadius: 10, marginBottom: gap, opacity: m._status === 'sending' ? 0.7 : 1 }} />;
  }
  if (m._status && m.file_type) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: gap, opacity: 0.8 }}>
        <i className="ti ti-file" style={{ fontSize: 20 }}></i>
        <span style={{ fontSize: 12.5, wordBreak: 'break-all' }}>{m.file_name}</span>
      </div>
    );
  }
  if (m.file_type === 'image' && m.file_url) return <div style={{ display: 'block', marginBottom: gap }}><SecureChatImage src={m.file_url} isMe={isMe} onLoad={onImageLoad} /></div>;
  if (m.file_type === 'file' && m.file_url) {
    return (
      <button type="button" onClick={(e) => { e.preventDefault(); openFile(m); }} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: gap, textDecoration: 'none', color: 'inherit', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
        <i className="ti ti-file" style={{ fontSize: 20 }}></i>
        <span style={{ fontSize: 12.5, textDecoration: 'underline', wordBreak: 'break-all' }}>{m.file_name}</span>
      </button>
    );
  }
  return null;
}

// Plein écran sur mobile, collé à la zone réellement visible : quand le clavier
// de l'iPhone s'ouvre, la page ne glisse plus et l'en-tête reste en haut.
function useFullscreenViewport(active, ref, onResize) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const onResizeRef = useRef(onResize);
  useEffect(() => { onResizeRef.current = onResize; });
  useLayoutEffect(() => {
    if (!active) { setKeyboardOpen(false); return undefined; }
    const vv = window.visualViewport;
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const h = vv ? vv.height : window.innerHeight;
      el.style.height = `${h}px`;
      el.style.top = `${vv ? vv.offsetTop : 0}px`;
      setKeyboardOpen(window.innerHeight - h > 120);
      if (onResizeRef.current) onResizeRef.current();
    };
    const lockPage = () => { if (window.scrollY !== 0) window.scrollTo(0, 0); };
    const onVvChange = () => { lockPage(); apply(); };
    apply();
    if (vv) { vv.addEventListener('resize', onVvChange); vv.addEventListener('scroll', onVvChange); }
    window.addEventListener('resize', onVvChange);
    window.addEventListener('scroll', lockPage);
    return () => {
      if (vv) { vv.removeEventListener('resize', onVvChange); vv.removeEventListener('scroll', onVvChange); }
      window.removeEventListener('resize', onVvChange);
      window.removeEventListener('scroll', lockPage);
    };
  }, [active, ref]);
  return keyboardOpen;
}

// Zone de saisie : elle garde son propre texte, donc taper ne redessine pas
// toute la liste des messages.
function Composer({ isMobile, compact, keyboardOpen, hasPendingFile, onSend, onTyping, onAttach }) {
  const [text, setText] = useState('');
  const taRef = useRef(null);

  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const canSend = text.trim().length > 0 || hasPendingFile;

  function submit(e) {
    if (e) e.preventDefault();
    if (!canSend) return;
    if (onSend(text)) {
      setText('');
      // Comme WhatsApp : le clavier reste ouvert après l'envoi.
      if (taRef.current) taRef.current.focus();
    }
  }

  function handleKeyDown(e) {
    // Ordinateur : Entrée envoie, Maj+Entrée va à la ligne. Mobile : Entrée = nouvelle ligne.
    if (e.key === 'Enter' && !e.shiftKey && !isMobile && !e.nativeEvent.isComposing) submit(e);
  }

  const padBottom = compact ? (keyboardOpen ? 8 : 'calc(8px + env(safe-area-inset-bottom))') : 'calc(14px + env(safe-area-inset-bottom))';

  return (
    <form onSubmit={submit} style={{ padding: compact ? '8px 10px' : '14px 20px', paddingBottom: padBottom, borderTop: hasPendingFile ? 'none' : '1px solid var(--line)', background: 'var(--paper)', display: 'flex', gap: 8, alignItems: 'flex-end', flexShrink: 0 }}>
      <button type="button" onClick={onAttach} title="Joindre un fichier" style={{ width: 40, height: 44, borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--forest)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className="ti ti-paperclip" style={{ fontSize: 20 }}></i>
      </button>
      <textarea
        ref={taRef}
        rows={1}
        value={text}
        onChange={(e) => { setText(e.target.value); if (e.target.value) onTyping(); }}
        onKeyDown={handleKeyDown}
        placeholder={hasPendingFile ? 'Ajouter un commentaire...' : 'Écrire un message...'}
        style={{ flex: 1, minHeight: 44, maxHeight: 120, resize: 'none', padding: '11px 16px', boxSizing: 'border-box', borderRadius: 22, border: '1px solid var(--line-strong)', fontSize: 16, lineHeight: '20px', outline: 'none', background: 'var(--cream)', color: 'var(--ink)', fontFamily: 'inherit', overflowY: 'auto' }}
      />
      <button
        type="submit"
        disabled={!canSend}
        onMouseDown={(e) => e.preventDefault()}
        title="Envoyer"
        style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: canSend ? 'var(--forest-dark)' : 'var(--line)', color: '#fff', cursor: canSend ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        <i className="ti ti-send" style={{ fontSize: 18, marginLeft: -2 }}></i>
      </button>
    </form>
  );
}

// Enveloppe : sans profil (déconnexion en cours) on n'affiche rien, et le
// vrai composant, qui contient tous les hooks, n'est alors jamais rendu à
// moitié (React exige le même nombre de hooks à chaque rendu).
export default function Chat() {
  const { profile } = useAuth();
  if (!profile) return null;
  return <ChatContent />;
}

function ChatContent() {
  const { profile } = useAuth();
  const online = useOnlineUsers();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [unreadInfo, setUnreadInfo] = useState(null);
  const [typing, setTyping] = useState({});
  const [newBelow, setNewBelow] = useState(0);
  const [pendingFile, setPendingFile] = useState(null);
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
  const messagesContainerRef = useRef(null);
  const dividerRef = useRef(null);
  const overlayRef = useRef(null);
  const convMenuRef = useRef(null);
  const fileInputRef = useRef(null);
  const channelRef = useRef(null);
  const outboxRef = useRef({});
  const nearBottomRef = useRef(true);
  const staffRef = useRef([]);
  const typingTimersRef = useRef({});
  const lastTypingSentRef = useRef(0);
  const pendingScrollRef = useRef(false);

  useEffect(() => { staffRef.current = staff; }, [staff]);

  const getConvInfo = (c) => {
    if (c.type === 'general') return { name: c.name || 'Général', subtitle: 'Toute l\'école', initials: '🌍', color: 'var(--forest)', isGroup: true };
    const other = c.chat_participants?.find(p => p.user_id !== profile.id);
    const name = other?.profiles?.full_name || 'Conversation privée';
    const role = other?.profiles?.role ? ROLES[other.profiles.role]?.label : null;
    return { name, subtitle: role || 'Message privé', initials: initials(name), color: avatarColor(other?.user_id || c.id), isGroup: false, otherId: other?.user_id || null };
  };

  // --- Défilement -------------------------------------------------------
  function scrollToBottom(smooth = false) {
    const el = messagesContainerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    nearBottomRef.current = true;
    setShowScrollDown(false);
    setNewBelow(0);
  }
  // Demande de défilement : exécutée juste après l'affichage des nouveaux messages
  // (même si plusieurs arrivent d'un coup).
  function scheduleScrollToBottom() { pendingScrollRef.current = true; }
  useLayoutEffect(() => {
    if (!pendingScrollRef.current) return;
    pendingScrollRef.current = false;
    scrollToBottom(true);
  }, [messages]);
  function stickIfNeeded() {
    const el = messagesContainerRef.current;
    if (el && nearBottomRef.current) el.scrollTop = el.scrollHeight;
  }
  function handleScroll() {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = distance < 120;
    setShowScrollDown(distance >= 100);
    if (distance < 100) setNewBelow(n => (n ? 0 : n));
  }
  function scrollToDivider() {
    const el = messagesContainerRef.current;
    const d = dividerRef.current;
    if (!el || !d) return false;
    el.scrollTop = Math.max(0, d.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop - 48);
    handleScroll();
    return true;
  }

  const keyboardOpen = useFullscreenViewport(isMobile && !!activeConv, overlayRef, stickIfNeeded);

  // 👇 L'EFFET QUI CACHAIT LA BOTTOMNAV A ÉTÉ SUPPRIMÉ ICI 👇

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
      try { localLastRead = localStorage.getItem(`chat_read_${conv.id}`); } catch { /* stockage indisponible : on ignore */ }
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

  // Conversation ouverte : historique, nouveaux messages, « écrit... »
  useEffect(() => {
    if (!activeConv) { setMessages([]); setMessagesLoading(false); return undefined; }
    let cancelled = false;
    const convId = activeConv.id;
    setMessages([]);
    setMessagesLoading(true);
    setUnreadInfo(null);
    setTyping({});
    setNewBelow(0);
    setShowScrollDown(false);
    nearBottomRef.current = true;

    // Repère « messages non lus » : calculé avant de marquer la conversation comme lue.
    const me = activeConv.chat_participants?.find(p => p.user_id === profile.id);
    let localRead = null;
    try { localRead = localStorage.getItem(`chat_read_${convId}`); } catch { /* stockage indisponible : on ignore */ }
    const since = latestDate(me?.last_read_at || null, localRead);

    supabase.from('chat_messages').select('*, profiles(full_name, role)').eq('conversation_id', convId).order('created_at', { ascending: true }).then(({ data, error: loadErr }) => {
      if (cancelled) return;
      if (loadErr) setError('Impossible de charger les messages.');
      const rows = data || [];
      let unread = null;
      if (since) {
        const fresh = rows.filter(m => m.sender_id !== profile.id && new Date(m.created_at) > new Date(since));
        if (fresh.length > 0) unread = { firstId: fresh[0].id, count: fresh.length };
      }
      // Messages encore en cours d'envoi dans cette conversation : on les garde à l'écran.
      const pending = Object.values(outboxRef.current).filter(i => i.convId === convId).map(i => ({ ...i.temp, _status: i.status }));
      setUnreadInfo(unread);
      setMessages([...rows, ...pending]);
      setMessagesLoading(false);
      markAsRead(convId);
      setUnreadCounts(prev => ({ ...prev, [convId]: 0 }));
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (cancelled) return;
        if (!(unread && scrollToDivider())) scrollToBottom(false);
      }));
    });

    const channel = supabase.channel(`chat_${convId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `conversation_id=eq.${convId}` }, async (payload) => {
        const row = payload.new;
        const mine = row.sender_id === profile.id;
        setLastMessages(prev => ({ ...prev, [convId]: row }));
        // Écho de notre propre envoi : la réponse de l'envoi s'en charge.
        if (mine && Object.values(outboxRef.current).some(i => i.convId === convId && i.status === 'sending' && (i.content || null) === (row.content || null) && (i.file?.file.name || null) === (row.file_name || null))) return;
        let author = null;
        if (mine) author = { full_name: profile.full_name, role: profile.role };
        else {
          const known = staffRef.current.find(s => s.id === row.sender_id);
          if (known) author = { full_name: known.full_name, role: known.role };
          else {
            const { data } = await supabase.from('profiles').select('full_name, role').eq('id', row.sender_id).single();
            author = data;
          }
        }
        if (cancelled) return;
        setMessages(prev => (prev.some(m => m.id === row.id) ? prev : [...prev, { ...row, profiles: author }]));
        if (!mine) {
          markAsRead(convId);
          playNotificationSound();
          setTyping(prev => { if (!prev[row.sender_id]) return prev; const n = { ...prev }; delete n[row.sender_id]; return n; });
          if (nearBottomRef.current) scheduleScrollToBottom();
          else { setNewBelow(n => n + 1); setShowScrollDown(true); }
        } else {
          scheduleScrollToBottom();
        }
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const uid = payload?.user_id;
        if (!uid || uid === profile.id) return;
        const name = staffRef.current.find(s => s.id === uid)?.full_name || payload?.name || 'Quelqu\'un';
        setTyping(prev => ({ ...prev, [uid]: name }));
        clearTimeout(typingTimersRef.current[uid]);
        typingTimersRef.current[uid] = setTimeout(() => {
          setTyping(prev => { const n = { ...prev }; delete n[uid]; return n; });
        }, 4000);
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      cancelled = true;
      channelRef.current = null;
      Object.values(typingTimersRef.current).forEach(clearTimeout);
      typingTimersRef.current = {};
      supabase.removeChannel(channel);
    };
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

  // Prévient les autres qu'on est en train d'écrire (au plus une fois toutes les 2,5 s).
  function notifyTyping() {
    const ch = channelRef.current;
    const now = Date.now();
    if (!ch || ch.state !== 'joined' || now - lastTypingSentRef.current < 2500) return;
    lastTypingSentRef.current = now;
    Promise.resolve(ch.send({ type: 'broadcast', event: 'typing', payload: { user_id: profile.id, name: profile.full_name } })).catch(() => { /* confort : on ignore */ });
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

  async function uploadFile(file, convId) {
    const ext = file.name.split('.').pop() || 'bin';
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const path = `${profile.school_id}/${convId}/${fileName}`;
    const { error: uploadErr } = await supabase.storage.from('chat-files').upload(path, file, { upsert: false });
    if (uploadErr) throw uploadErr;
    return path;
  }

  function patchTemp(tempId, patch) {
    setMessages(prev => prev.map(m => (m._tempId === tempId ? { ...m, ...patch } : m)));
  }

  // Envoie (ou renvoie) un message déjà affiché à l'écran.
  async function deliver(tempId) {
    const item = outboxRef.current[tempId];
    if (!item) return;
    item.status = 'sending';
    patchTemp(tempId, { _status: 'sending' });
    try {
      let filePath = item.uploadedPath || null;
      if (item.file && !filePath) { filePath = await uploadFile(item.file.file, item.convId); item.uploadedPath = filePath; }
      const { data: inserted, error: sendErr } = await supabase.from('chat_messages').insert({
        conversation_id: item.convId,
        sender_id: profile.id,
        content: item.content || null,
        file_url: filePath,
        file_type: item.file ? item.file.type : null,
        file_name: item.file ? item.file.file.name : null,
      }).select('*').single();
      if (sendErr) throw sendErr;
      delete outboxRef.current[tempId];
      setMessages(prev => {
        if (prev.some(m => m.id === inserted.id)) return prev.filter(m => m._tempId !== tempId);
        return prev.map(m => (m._tempId === tempId ? { ...inserted, profiles: m.profiles, _tempId: tempId } : m));
      });
      setLastMessages(prev => ({ ...prev, [item.convId]: inserted }));
      if (item.file?.preview) URL.revokeObjectURL(item.file.preview);
      const pushBody = item.file ? `📎 ${item.file.file.name}` : item.content;
      try {
        await supabase.functions.invoke('send-message-push', { body: { conversation_id: item.convId, sender_name: profile.full_name, message_content: pushBody, sender_id: profile.id } });
      } catch (err) { console.warn("Push chat non envoyé", err); }
    } catch (err) {
      console.warn('🔴 [Chat] envoi échoué :', err?.message || err);
      item.status = 'failed';
      patchTemp(tempId, { _status: 'failed' });
    }
  }

  // Le message apparaît tout de suite (horloge), puis une coche quand le serveur l'a reçu.
  function sendMessage(text) {
    const content = (text || '').trim();
    if ((!content && !pendingFile) || !activeConv) return false;
    const fileToSend = pendingFile;
    setPendingFile(null);
    setError('');
    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const temp = {
      id: tempId, _tempId: tempId, _status: 'sending',
      conversation_id: activeConv.id, sender_id: profile.id,
      content: content || null, file_url: null,
      file_type: fileToSend ? fileToSend.type : null,
      file_name: fileToSend ? fileToSend.file.name : null,
      _localPreview: fileToSend ? fileToSend.preview : null,
      created_at: new Date().toISOString(),
      profiles: { full_name: profile.full_name, role: profile.role },
    };
    outboxRef.current[tempId] = { convId: activeConv.id, content, file: fileToSend, temp, status: 'sending', uploadedPath: null };
    setMessages(prev => [...prev, temp]);
    scheduleScrollToBottom();
    deliver(tempId);
    return true;
  }

  function discardFailed(tempId) {
    const item = outboxRef.current[tempId];
    if (item?.file?.preview) URL.revokeObjectURL(item.file.preview);
    delete outboxRef.current[tempId];
    setMessages(prev => prev.filter(m => m._tempId !== tempId));
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
    const items = [];
    let currentDate = null;
    messages.forEach(m => {
      const d = formatConvDate(m.created_at);
      if (d !== currentDate) { items.push({ type: 'date', label: d, key: `date-${m.id}` }); currentDate = d; }
      if (unreadInfo && m.id === unreadInfo.firstId) items.push({ type: 'unread', key: 'unread-divider', count: unreadInfo.count });
      items.push({ type: 'message', data: m, key: m._tempId || m.id, first: true, last: true });
    });
    // Messages consécutifs de la même personne : regroupés comme dans WhatsApp.
    items.forEach((item, i) => {
      if (item.type !== 'message') return;
      const prev = items[i - 1];
      const next = items[i + 1];
      item.first = !(prev && prev.type === 'message' && prev.data.sender_id === item.data.sender_id);
      item.last = !(next && next.type === 'message' && next.data.sender_id === item.data.sender_id);
    });
    return items;
  }, [messages, unreadInfo]);

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
              <Avatar text={info.initials} color={info.color} size={44} isGroup={info.isGroup} online={!!info.otherId && online.has(info.otherId)} />
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

  const renderConversation = (fullscreen = false) => {
    const info = activeConv ? getConvInfo(activeConv) : null;
    const typingNames = Object.values(typing);
    const typingText = typingNames.length === 0 ? null
      : activeConv?.type === 'general' ? (typingNames.length === 1 ? `${typingNames[0]} écrit...` : `${typingNames.slice(0, 2).join(', ')} écrivent...`)
      : 'écrit...';
    const otherOnline = !!info?.otherId && online.has(info.otherId);
    const showSender = activeConv?.type === 'general';
    const ONLINE_GREEN = '#1FA855';
    return (
      <div style={fullscreen
        ? { flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--paper)', overflow: 'hidden', minHeight: 0, position: 'relative' }
        : { flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--paper)', borderRadius: 16, border: '1px solid var(--line)', overflow: 'hidden', height: '100%', minHeight: 0, position: 'relative' }}>
        {error && <div style={{ padding: 12, background: 'var(--danger-light)', color: 'var(--danger)', fontSize: 12, borderBottom: '1px solid var(--danger)', flexShrink: 0 }}>{error}</div>}

        {activeConv ? (
          <>
            <div style={{ padding: fullscreen ? '10px 14px' : '14px 20px', paddingTop: fullscreen ? 'calc(10px + env(safe-area-inset-top))' : undefined, borderBottom: '1px solid var(--line)', background: 'var(--paper)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              {isMobile && <button onClick={() => setActiveConv(null)} aria-label="Retour" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--forest)', fontSize: 24, padding: '4px 4px 4px 0', display: 'flex', alignItems: 'center' }}><i className="ti ti-arrow-left"></i></button>}
              <Avatar text={info.initials} color={info.color} size={42} isGroup={info.isGroup} online={otherOnline} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  {activeConv.type === 'general' && <i className="ti ti-pin-filled" style={{ fontSize: 13, color: 'var(--muted)' }}></i>}
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{info.name}</p>
                </div>
                <div style={{ marginTop: 1, fontSize: 11.5, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: typingText || otherOnline ? ONLINE_GREEN : 'var(--muted)', fontStyle: typingText ? 'italic' : 'normal' }}>
                  {typingText
                    || (info.isGroup
                      ? `${staff.length + 1} membres${online.size > 0 ? ` · ${online.size} en ligne` : ''}`
                      : (otherOnline ? 'en ligne' : info.subtitle))}
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

            <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
              <div ref={messagesContainerRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: fullscreen ? '10px 10px 8px' : '20px 20px 10px', display: 'flex', flexDirection: 'column', background: 'var(--cream)', minHeight: 0, overscrollBehavior: 'contain' }}>
                {messagesLoading && (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}><i className="ti ti-loader" style={{ fontSize: 24, animation: 'spin 1s linear infinite' }}></i></div>
                )}
                {!messagesLoading && messages.length === 0 && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center' }}>
                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--paper)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}><i className="ti ti-message-circle-heart" style={{ fontSize: 38, color: 'var(--muted)' }}></i></div>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>Aucun message pour l'instant</p>
                    <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--muted)', maxWidth: 280, lineHeight: 1.5 }}>Écrivez le premier message pour lancer la conversation.</p>
                  </div>
                )}

                {groupedMessages.map((item) => {
                  if (item.type === 'date') {
                    return (
                      <div key={item.key} style={{ display: 'flex', justifyContent: 'center', margin: '14px 0 8px' }}>
                        <span style={{ background: 'var(--paper)', border: '1px solid var(--line)', padding: '4px 12px', borderRadius: 20, fontSize: 10.5, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</span>
                      </div>
                    );
                  }
                  if (item.type === 'unread') {
                    return (
                      <div key={item.key} ref={dividerRef} style={{ display: 'flex', justifyContent: 'center', margin: '12px 0 6px' }}>
                        <span style={{ background: 'var(--forest-light)', color: 'var(--forest)', padding: '4px 14px', borderRadius: 20, fontSize: 11.5, fontWeight: 700 }}>{item.count} message{item.count > 1 ? 's' : ''} non lu{item.count > 1 ? 's' : ''}</span>
                      </div>
                    );
                  }
                  const m = item.data;
                  const isMe = m.sender_id === profile.id;
                  const senderName = m.profiles?.full_name || 'Utilisateur';
                  const senderRole = m.profiles?.role ? ROLES[m.profiles.role]?.label : null;
                  const hasFile = !!m.file_type;
                  const sending = m._status === 'sending';
                  const failed = m._status === 'failed';
                  const timeColor = isMe ? 'rgba(255,255,255,0.7)' : 'var(--muted)';
                  const timeBox = (
                    <span style={{ float: 'right', margin: hasFile && !m.content ? '4px 0 0 10px' : '8px 0 -3px 10px', fontSize: 10, lineHeight: '14px', color: timeColor, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                      {formatTime(m.created_at)}
                      {isMe && (failed
                        ? <i className="ti ti-alert-circle" style={{ fontSize: 13, color: '#FFB4A8' }}></i>
                        : <i className={`ti ${sending ? 'ti-clock' : 'ti-check'}`} style={{ fontSize: 12 }}></i>)}
                    </span>
                  );

                  return (
                    <div key={item.key} style={{ display: 'flex', alignSelf: isMe ? 'flex-end' : 'flex-start', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6, maxWidth: '82%', marginTop: item.first ? 8 : 2 }}>
                      {!isMe && showSender && (item.last ? <Avatar text={initials(senderName)} color={avatarColor(m.sender_id)} size={30} online={online.has(m.sender_id)} /> : <div style={{ width: 30, flexShrink: 0 }}></div>)}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', minWidth: 0 }}>
                        <div style={{ background: isMe ? 'var(--forest-dark)' : 'var(--paper)', color: isMe ? '#fff' : 'var(--ink)', padding: hasFile ? '6px 8px 5px' : '7px 11px 6px', borderRadius: 16, borderBottomRightRadius: isMe && item.last ? 4 : 16, borderBottomLeftRadius: !isMe && item.last ? 4 : 16, fontSize: 14, lineHeight: 1.4, border: isMe ? 'none' : '1px solid var(--line)', wordBreak: 'break-word', whiteSpace: 'pre-wrap', opacity: failed ? 0.85 : 1 }}>
                          {!isMe && showSender && item.first && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, whiteSpace: 'normal' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: avatarColor(m.sender_id) }}>{senderName}</span>
                              {senderRole && <span style={{ fontSize: 9.5, fontWeight: 600, color: 'var(--muted)', padding: '1px 6px', borderRadius: 6, background: 'var(--line)' }}>{senderRole}</span>}
                            </div>
                          )}
                          {hasFile && <MessageContent m={m} isMe={isMe} onImageLoad={stickIfNeeded} />}
                          {m.content && <span>{m.content}</span>}
                          {timeBox}
                        </div>
                        {failed && (
                          <div style={{ marginTop: 3, fontSize: 11.5, color: 'var(--danger)', display: 'flex', gap: 10, alignItems: 'center' }}>
                            <span>Échec de l'envoi</span>
                            <button type="button" onClick={() => deliver(m._tempId)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--forest)', fontWeight: 700, fontSize: 11.5, cursor: 'pointer', textDecoration: 'underline' }}>Réessayer</button>
                            <button type="button" onClick={() => discardFailed(m._tempId)} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--muted)', fontSize: 11.5, cursor: 'pointer', textDecoration: 'underline' }}>Supprimer</button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {showScrollDown && (
                <button onClick={() => scrollToBottom(true)} aria-label="Aller au dernier message" style={{ position: 'absolute', bottom: 12, right: 14, width: 40, height: 40, borderRadius: '50%', background: 'var(--paper)', border: '1px solid var(--line-strong)', color: 'var(--forest)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                  <i className="ti ti-chevron-down" style={{ fontSize: 20 }}></i>
                  {newBelow > 0 && <span style={{ position: 'absolute', top: -6, right: -4, background: 'var(--forest)', color: '#fff', fontSize: 10.5, fontWeight: 700, minWidth: 18, height: 18, padding: '0 5px', boxSizing: 'border-box', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{newBelow > 99 ? '99+' : newBelow}</span>}
                </button>
              )}
            </div>

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

            <input ref={fileInputRef} type="file" onChange={handleFileSelect} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" style={{ display: 'none' }} />
            <Composer
              key={activeConv.id}
              isMobile={isMobile}
              compact={fullscreen}
              keyboardOpen={keyboardOpen}
              hasPendingFile={!!pendingFile}
              onSend={sendMessage}
              onTyping={notifyTyping}
              onAttach={() => fileInputRef.current?.click()}
            />
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
      <>
        <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', padding: '10px 10px 10px', boxSizing: 'border-box', overflow: 'hidden' }}>
          {renderConversationList()}
        </div>
        {activeConv && createPortal(
          <div ref={overlayRef} style={{ position: 'fixed', left: 0, right: 0, top: 0, height: '100dvh', zIndex: 45, display: 'flex', flexDirection: 'column', background: 'var(--paper)' }}>
            {renderConversation(true)}
          </div>,
          document.body
        )}
      </>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', gap: 16, paddingTop: 16 }}>
      {renderConversationList()}
      {renderConversation()}
    </div>
  );
}
