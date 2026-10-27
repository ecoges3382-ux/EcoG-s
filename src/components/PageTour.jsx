// src/components/PageTour.jsx
import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { getTour, hasSeenTour, markTourSeen } from '../lib/tours.js';

export function PageTourRunner({ pageKey, onClose }) {
  const tour = getTour(pageKey);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState(null);
  const rafRef = useRef(null);

  const step = tour?.steps[stepIndex];

  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    function tick() {
      if (cancelled) return;
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    tick();
    return () => { cancelled = true; cancelAnimationFrame(rafRef.current); };
  }, [step]);

  function finish() {
    onClose(false);
  }

  function next() {
    if (stepIndex >= tour.steps.length - 1) {
      onClose(true);
      return;
    }
    setStepIndex(i => i + 1);
  }

  function prev() {
    if (stepIndex > 0) setStepIndex(i => i - 1);
  }

  if (!step || !rect) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const bubbleW = Math.min(320, vw - 40);
  const bubbleH = 170;
  const margin = 16;

  let bubbleLeft, bubbleTop;
  if (rect.left + rect.width + margin + bubbleW < vw - 8) {
    bubbleLeft = rect.left + rect.width + margin;
    bubbleTop = Math.max(20, Math.min(rect.top, vh - bubbleH - 20));
  } else if (rect.top + rect.height + margin + bubbleH < vh - 8) {
    bubbleTop = rect.top + rect.height + margin;
    bubbleLeft = Math.max(8, Math.min(rect.left, vw - bubbleW - 8));
  } else {
    bubbleTop = Math.max(8, rect.top - bubbleH - margin);
    bubbleLeft = Math.max(8, Math.min(rect.left, vw - bubbleW - 8));
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 99999, pointerEvents: 'none' }}>
      <div
        style={{
          position: 'fixed',
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
          borderRadius: 10,
          pointerEvents: 'none',
          transition: 'all 0.25s ease',
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: bubbleTop,
          left: bubbleLeft,
          width: bubbleW,
          background: 'var(--paper)',
          padding: '16px 20px 14px',
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          pointerEvents: 'auto',
          transition: 'top 0.25s ease, left 0.25s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--forest)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {tour.label} · {stepIndex + 1}/{tour.steps.length}
          </span>
          <button
            type="button"
            onClick={finish}
            aria-label="Fermer la visite"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>
        <h4 style={{ margin: '0 0 6px', fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink)' }}>
          {step.title}
        </h4>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
          {step.text}
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={prev}
            disabled={stepIndex === 0}
            style={{
              background: 'none', border: 'none', cursor: stepIndex === 0 ? 'default' : 'pointer',
              color: stepIndex === 0 ? 'var(--line-strong)' : 'var(--muted)',
              fontSize: 12, fontWeight: 600, padding: '6px 4px',
            }}
          >
            ← Précédent
          </button>
          <button
            type="button"
            onClick={next}
            style={{
              background: 'var(--forest)', color: '#fff', border: 'none',
              padding: '8px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {stepIndex === tour.steps.length - 1 ? 'Terminer' : 'Suivant →'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function usePageTour(pageKey) {
  const { profile } = useAuth();
  const [active, setActive] = useState(false);
  const userId = profile?.id;

  useEffect(() => {
    if (!userId) return;
    if (hasSeenTour(pageKey, userId)) return;
    const timer = setTimeout(() => setActive(true), 800);
    return () => clearTimeout(timer);
  }, [pageKey, userId]);

  const launch = useCallback(() => setActive(true), []);

  function handleClose(done) {
    if (done && userId) markTourSeen(pageKey, userId);
    setActive(false);
  }

  function Button() {
    return (
      <button
        type="button"
        onClick={launch}
        title="Visite guidée de cette page"
        aria-label="Visite guidée de cette page"
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: '50%',
          border: '1px solid var(--line-strong)', background: 'var(--paper)',
          color: 'var(--forest)', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.75.35-1.25 1.1-1.25 2.2" /><path d="M12 17.5v.01" />
        </svg>
      </button>
    );
  }

  return {
    launch,
    Button,
    Runner: active ? <PageTourRunner pageKey={pageKey} onClose={handleClose} /> : null,
  };
}
