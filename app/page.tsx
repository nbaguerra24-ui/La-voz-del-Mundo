'use client';

import { useEffect, useMemo, useState } from 'react';
import { Globe2, Menu, X, ArrowUpRight, MessageCircle, BarChart3, Compass, LogIn, LogOut, UserRound, Check, ChevronRight, Sparkles } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type PollOption = { id: string; label: string; voteCount?: number; percentage?: number };
type Poll = { id: string; question: string; category: string; description: string | null; options: PollOption[]; votes: number; myVote?: string | null };
type User = { id: string; email?: string };

const samplePolls: Poll[] = [
  { id: 'demo-1', question: '¿Crees que el mundo está mejorando o empeorando?', category: 'Humanidad', description: 'Una pregunta para conocer cómo percibimos el rumbo de nuestro planeta.', options: [{ id: 'a', label: 'Está mejorando' }, { id: 'b', label: 'Está empeorando' }, { id: 'c', label: 'Sigue igual' }, { id: 'd', label: 'No lo sé' }], votes: 12842 },
  { id: 'demo-2', question: '¿Qué debería ser prioridad para la humanidad?', category: 'Sociedad', description: 'Elige el cambio que consideras más urgente.', options: [{ id: 'a', label: 'Educación para todos' }, { id: 'b', label: 'Paz y seguridad' }, { id: 'c', label: 'Cuidar el planeta' }, { id: 'd', label: 'Reducir la pobreza' }], votes: 8931 },
  { id: 'demo-3', question: '¿La inteligencia artificial mejorará nuestras vidas?', category: 'Tecnología', description: 'Queremos conocer tu perspectiva sobre el futuro tecnológico.', options: [{ id: 'a', label: 'Sí, mucho' }, { id: 'b', label: 'Sí, pero con riesgos' }, { id: 'c', label: 'No estoy seguro/a' }, { id: 'd', label: 'No' }], votes: 6740 },
];

const categories = ['Todas', 'Humanidad', 'Sociedad', 'Tecnología', 'Medioambiente', 'Paz'];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [country, setCountry] = useState('');
  const [language, setLanguage] = useState('Español');
  const [authMessage, setAuthMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [polls, setPolls] = useState<Poll[]>(samplePolls);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState('Todas');
  const [notice, setNotice] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [tab, setTab] = useState<'encuestas' | 'resultados'>('encuestas');

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ? { id: data.session.user.id, email: data.session.user.email } : null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ? { id: session.user.id, email: session.user.email } : null));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function loadPolls() {
      if (!supabase) return;
      const { data, error } = await supabase.from('polls').select('id, question, category, description, poll_options(id,label)').eq('is_published', true).order('created_at', { ascending: false }).limit(30);
      if (error || !data?.length) return;
      const mapped: Poll[] = await Promise.all(data.map(async (p: any) => {
        let myVote: string | null = null;
        if (user) {
          const { data: vote } = await supabase!.from('votes').select('option_id').eq('poll_id', p.id).eq('user_id', user.id).maybeSingle();
          myVote = vote?.option_id ?? null;
        }
        const { data: totals } = await supabase!.rpc('get_poll_results', { p_poll_id: p.id });
        const options = (p.poll_options ?? []).map((option: PollOption) => {
          const result = (totals ?? []).find((row: any) => row.option_id === option.id);
          return { ...option, voteCount: Number(result?.vote_count ?? 0), percentage: Number(result?.percentage ?? 0) };
        });
        const totalVotes = options.reduce((sum: number, option: PollOption) => sum + (option.voteCount ?? 0), 0);
        return { id: p.id, question: p.question, category: p.category, description: p.description, options, votes: totalVotes, myVote };
      }));
      setPolls(mapped);
    }
    loadPolls();
  }, [user]);

  const visiblePolls = useMemo(() => polls.filter(p => filter === 'Todas' || p.category === filter), [polls, filter]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setAuthMessage('');
    if (!supabase) { setAuthMessage('Configura primero las credenciales de Supabase en .env.local.'); setBusy(false); return; }
    if (authMode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password, options: { data: { country, language } } });
      setAuthMessage(error ? error.message : 'Cuenta creada. Revisa tu correo si la confirmación está activada.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setAuthMessage(error ? error.message : 'Sesión iniciada.');
      if (!error) setAuthOpen(false);
    }
    setBusy(false);
  }

  async function vote(poll: Poll) {
    if (!user) { setAuthMode('signup'); setAuthOpen(true); setNotice('Crea una cuenta o inicia sesión para participar.'); return; }
    const optionId = selected[poll.id];
    if (!optionId) { setNotice('Selecciona una respuesta antes de votar.'); return; }
    if (!supabase || poll.id.startsWith('demo-')) { setNotice('Estas son encuestas de demostración. Conecta Supabase y publica encuestas para guardar votos reales.'); return; }
    const { error } = await supabase.from('votes').insert({ poll_id: poll.id, option_id: optionId, user_id: user.id });
    if (error) { setNotice(error.code === '23505' ? 'Ya participaste en esta encuesta.' : error.message); return; }
    setPolls(prev => prev.map(p => p.id === poll.id ? { ...p, votes: p.votes + 1, myVote: optionId } : p));
    setNotice('¡Tu voto fue registrado! Gracias por participar.');
  }

  async function signOut() { if (supabase) await supabase.auth.signOut(); setNotice('Has cerrado sesión.'); }

  return <main>
    <header className="topbar"><a className="brand" href="#inicio"><span className="brand-icon"><Globe2 size={23}/></span><span>LA VOZ <b>DEL MUNDO</b></span></a>
      <nav className={mobileMenu ? 'nav nav-open' : 'nav'}><a href="#encuestas" onClick={() => setMobileMenu(false)}>Encuestas</a><a href="#como-funciona" onClick={() => setMobileMenu(false)}>Cómo funciona</a><a href="#comunidad" onClick={() => setMobileMenu(false)}>Comunidad</a></nav>
      <div className="top-actions">{user ? <><span className="user-chip"><UserRound size={15}/>{user.email?.split('@')[0]}</span><button className="btn-ghost" onClick={signOut}><LogOut size={16}/> Salir</button></> : <><button className="btn-ghost login" onClick={() => { setAuthMode('login'); setAuthOpen(true); }}><LogIn size={16}/> Iniciar sesión</button><button className="btn-primary small" onClick={() => { setAuthMode('signup'); setAuthOpen(true); }}>Crear cuenta <ArrowUpRight size={16}/></button></>}</div>
      <button className="mobile-toggle" aria-label="Abrir menú" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X/> : <Menu/>}</button>
    </header>

    <section className="hero" id="inicio"><div className="hero-grid"><div className="hero-copy"><div className="eyebrow"><span className="pulse"/> UNA COMUNIDAD SIN FRONTERAS</div><h1>El mundo tiene<br/><em>la palabra.</em></h1><p className="hero-sub">Millones de personas. Millones de opiniones. Un mundo por escuchar. Participa, comparte lo que piensas y descubre cómo ve el mundo la humanidad.</p><div className="hero-buttons"><button className="btn-primary" onClick={() => { setAuthMode('signup'); setAuthOpen(true); }}>Únete a la conversación <ArrowUpRight size={18}/></button><a className="btn-outline" href="#encuestas">Explorar encuestas <ChevronRight size={17}/></a></div><div className="hero-proof"><div className="avatar-stack"><i>🌎</i><i>💬</i><i>🌱</i><i>✦</i></div><span>Una voz puede iniciar un cambio.</span></div></div><div className="earth-wrap"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="earth"><div className="earth-glow"/><div className="earth-map"/></div><div className="float-card card-top"><span className="mini-dot"/> OPINIONES QUE CONECTAN</div><div className="float-card card-bottom"><Globe2 size={17}/> <span><b>Un mundo.</b><small>Muchas perspectivas.</small></span></div></div></div><div className="hero-bottom"><span>01 / ESCUCHA</span><span>02 / PARTICIPA</span><span>03 / COMPRENDE</span></div></section>

    <section className="stats-strip"><div><strong>🌐</strong><span>Voces de todo el planeta</span></div><div><strong>◉</strong><span>Opiniones diversas</span></div><div><strong>↗</strong><span>Resultados transparentes</span></div><div><strong>✦</strong><span>Una comunidad global</span></div></section>

    <section className="section polls-section" id="encuestas"><div className="section-heading"><div><div className="eyebrow dark">LA OPINIÓN CUENTA</div><h2>¿Qué piensa <em>el mundo?</em></h2><p>Preguntas que nos conectan. Respuestas que nos ayudan a comprender.</p></div><div className="live-label"><span className="pulse"/> ENCUESTAS DESTACADAS</div></div>
      <div className="poll-toolbar"><div className="filters">{categories.map(c => <button key={c} className={filter === c ? 'filter active' : 'filter'} onClick={() => setFilter(c)}>{c}</button>)}</div><div className="tabs"><button className={tab === 'encuestas' ? 'tab active' : 'tab'} onClick={() => setTab('encuestas')}><Compass size={15}/> Encuestas</button><button className={tab === 'resultados' ? 'tab active' : 'tab'} onClick={() => setTab('resultados')}><BarChart3 size={15}/> Resultados</button></div></div>
      <div className="poll-grid">{visiblePolls.map((poll, index) => <article className="poll-card" key={poll.id}><div className="poll-meta"><span className="category">{poll.category}</span><span className="poll-number">PREGUNTA 0{index + 1}</span></div><h3>{poll.question}</h3><p>{poll.description}</p>{tab === 'encuestas' ? <div className="options">{poll.options.map(o => <label className={selected[poll.id] === o.id ? 'option selected' : 'option'} key={o.id}><input type="radio" name={poll.id} value={o.id} checked={selected[poll.id] === o.id || poll.myVote === o.id} disabled={Boolean(poll.myVote)} onChange={() => setSelected(s => ({ ...s, [poll.id]: o.id }))}/><span className="radio-mark"/><span>{o.label}</span>{selected[poll.id] === o.id && <Check size={15}/>}</label>)}</div> : <div className="results-preview">{poll.options.map(o => <div className="result-row" key={o.id}><div><span>{o.label}</span><b>{o.percentage ?? 0}%</b></div><div className="bar"><i style={{ width: `${o.percentage ?? 0}%` }}/></div></div>)}<small>{poll.votes.toLocaleString('es')} votos registrados</small></div>}
        <div className="poll-footer"><span><MessageCircle size={14}/> {poll.votes.toLocaleString('es')} participaciones</span>{tab === 'encuestas' ? <button className="vote-btn" disabled={Boolean(poll.myVote)} onClick={() => vote(poll)}>{poll.myVote ? 'Ya votaste' : 'Votar'} <ArrowUpRight size={15}/></button> : <span className="results-link">Ver resultados <ArrowUpRight size={14}/></span>}</div></article>)}</div>
      {!visiblePolls.length && <div className="empty">Todavía no hay encuestas en esta categoría.</div>}
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Cerrar">×</button></div>}
      <p className="data-note">Los resultados reales se calculan a partir de los votos registrados. Las tarjetas de muestra solo aparecen mientras no esté configurada la base de datos.</p>
    </section>

    <section className="manifesto" id="como-funciona"><div className="manifesto-inner"><div className="eyebrow">MÁS QUE UNA ENCUESTA</div><h2>Escuchar también<br/>es una forma de <em>unir.</em></h2><p>Creemos que cada persona tiene algo que decir. Creamos un espacio para compartir perspectivas, descubrir diferencias y encontrar puntos en común.</p><div className="manifesto-points"><div><b>01</b><span>Expresa tu opinión</span></div><div><b>02</b><span>Descubre otras perspectivas</span></div><div><b>03</b><span>Comprende el mundo</span></div></div></div><div className="manifesto-globe"><Globe2 size={190} strokeWidth={0.6}/><Sparkles className="sparkle" size={27}/></div></section>

    <section className="community section" id="comunidad"><div className="community-card"><div><div className="eyebrow dark">TU VOZ TAMBIÉN IMPORTA</div><h2>La conversación<br/>empieza <em>contigo.</em></h2><p>Crea tu cuenta y forma parte de una comunidad donde las ideas cruzan fronteras.</p></div><button className="btn-primary" onClick={() => { setAuthMode('signup'); setAuthOpen(true); }}>Crear mi cuenta <ArrowUpRight size={18}/></button></div></section>

    <footer><a className="brand footer-brand" href="#inicio"><span className="brand-icon"><Globe2 size={21}/></span><span>LA VOZ <b>DEL MUNDO</b></span></a><p>Una humanidad. Millones de opiniones. Una sola voz.</p><span>© {new Date().getFullYear()} La Voz del Mundo</span></footer>

    {authOpen && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setAuthOpen(false); }}><div className="auth-modal"><button className="modal-close" onClick={() => setAuthOpen(false)} aria-label="Cerrar"><X/></button><div className="modal-brand"><Globe2 size={27}/><b>LA VOZ DEL MUNDO</b></div><h2>{authMode === 'signup' ? 'Tu voz tiene un lugar.' : 'Qué bueno verte.'}</h2><p>{authMode === 'signup' ? 'Crea tu cuenta para participar en la conversación global.' : 'Inicia sesión para continuar.'}</p><form onSubmit={handleAuth}><label>Correo electrónico<input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@correo.com"/></label><label>Contraseña<input type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 8 caracteres"/></label>{authMode === 'signup' && <><label>País<select required value={country} onChange={e => setCountry(e.target.value)}><option value="">Selecciona tu país</option>{['El Salvador','Guatemala','Honduras','México','Estados Unidos','España','Colombia','Argentina','Chile','Perú','Otro'].map(c => <option key={c}>{c}</option>)}</select></label><label>Idioma<select value={language} onChange={e => setLanguage(e.target.value)}><option>Español</option><option>English</option><option>Português</option><option>Français</option></select></label></>}<button className="btn-primary full" disabled={busy}>{busy ? 'Procesando…' : authMode === 'signup' ? 'Crear cuenta' : 'Iniciar sesión'} <ArrowUpRight size={17}/></button></form>{authMessage && <div className="auth-message">{authMessage}</div>}<div className="auth-switch">{authMode === 'signup' ? '¿Ya tienes cuenta?' : '¿Aún no tienes cuenta?'} <button onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setAuthMessage(''); }}>{authMode === 'signup' ? 'Inicia sesión' : 'Regístrate'}</button></div><small>Al continuar aceptas nuestras normas de comunidad y política de privacidad. Añadiremos los documentos legales antes del lanzamiento público.</small></div></div>}
    {!isSupabaseConfigured && <div className="config-banner">Modo de demostración: configura Supabase para activar cuentas y votos reales.</div>}
  </main>;
}
