"use client";

import { useEffect, useRef, useState } from "react";

type FeedItem = { tag: string; text: string };
type FeedEntry = FeedItem & { ts: number };
type Bubble = { cls: string; content: React.ReactNode };

const FEED_QUEUE: FeedItem[] = [
  { tag: "WhatsApp", text: "Testing should be done today." },
  { tag: "Voice note", text: "Two fittings still outstanding." },
  { tag: "Evidence", text: "4 project photos uploaded." },
  { tag: "Document", text: "Signed checklist received." },
  { tag: "WhatsApp", text: "Crew arriving 30 minutes late." },
  { tag: "Approval", text: "Inspection schedule confirmed." }
];

function WaCheck() {
  return (
    <svg className="cal-wa-check" viewBox="0 0 18 12">
      <path
        d="M1 6l3 3 3-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 6l3 3 7-8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PhotoTarmac() {
  return (
    <span className="cal-photo">
      <svg viewBox="0 0 50 50">
        <defs>
          <linearGradient id="calSky1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#bcd4e6" />
            <stop offset="1" stopColor="#eef3f2" />
          </linearGradient>
        </defs>
        <rect width="50" height="50" fill="url(#calSky1)" />
        <rect y="30" width="50" height="20" fill="#57534a" />
        <rect x="22" y="30" width="6" height="20" fill="#efece4" opacity=".85" />
        <rect x="9" y="42" width="10" height="4" fill="#efece4" opacity=".55" />
        <rect x="31" y="42" width="10" height="4" fill="#efece4" opacity=".55" />
      </svg>
    </span>
  );
}

function PhotoCrane() {
  return (
    <span className="cal-photo">
      <svg viewBox="0 0 50 50">
        <defs>
          <linearGradient id="calSky2" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd9a0" />
            <stop offset="1" stopColor="#fff3e6" />
          </linearGradient>
        </defs>
        <rect width="50" height="50" fill="url(#calSky2)" />
        <rect x="23" y="8" width="3" height="34" fill="#2a261c" />
        <rect x="14" y="14" width="24" height="2.5" fill="#2a261c" />
        <rect x="34" y="14" width="2.5" height="8" fill="#2a261c" />
        <rect x="12" y="14" width="2.5" height="6" fill="#2a261c" />
        <rect x="18" y="40" width="14" height="3" fill="#4a4535" />
      </svg>
    </span>
  );
}

function PhotoChecklist() {
  return (
    <span className="cal-photo">
      <svg viewBox="0 0 50 50">
        <rect width="50" height="50" fill="#f7f5ef" />
        <rect x="8" y="9" width="34" height="32" rx="2" fill="#fff" stroke="#ded7c4" />
        <rect x="13" y="16" width="20" height="2.5" fill="#d8d2c0" />
        <rect x="13" y="23" width="20" height="2.5" fill="#d8d2c0" />
        <rect x="13" y="30" width="14" height="2.5" fill="#d8d2c0" />
        <circle cx="34" cy="31" r="6" fill="#0f9d86" />
        <path
          d="M31 31l2 2 4-4"
          fill="none"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

const CAPTURE_BUBBLES: Bubble[] = [
  { cls: "cal-in", content: "Morning team. Testing today?" },
  {
    cls: "cal-out",
    content: (
      <>
        Fittings just arrived.
        <div className="cal-wa-meta">
          <span className="cal-wa-time">08:44</span>
          <WaCheck />
        </div>
      </>
    )
  },
  {
    cls: "cal-voice",
    content: (
      <>
        <span>0:27</span>
        <i className="cal-wa-wave" />
      </>
    )
  },
  {
    cls: "cal-media",
    content: (
      <>
        <PhotoTarmac />
        <PhotoCrane />
        <PhotoChecklist />
      </>
    )
  },
  {
    cls: "cal-out",
    content: (
      <>
        Need consultant approval before 4pm.
        <div className="cal-wa-meta">
          <span className="cal-wa-time">08:52</span>
          <WaCheck />
        </div>
      </>
    )
  }
];

const DECIDE_BUBBLES: Bubble[] = [
  {
    cls: "cal-in cal-card",
    content: (
      <>
        <b>REC-1842 · Taxiway A</b>
        Schedule consultant inspection?
        <div className="cal-wa-actions">
          <span className="cal-wa-pill cal-solid">APPROVE</span>
          <span className="cal-wa-pill">REJECT</span>
          <span className="cal-wa-pill">DETAILS</span>
        </div>
      </>
    )
  },
  {
    cls: "cal-out",
    content: (
      <>
        DETAILS
        <div className="cal-wa-meta">
          <span className="cal-wa-time">09:07</span>
        </div>
      </>
    )
  },
  {
    cls: "cal-in",
    content: (
      <>
        Evidence used:
        <br />
        • Signed checklist
        <br />
        • Site update
        <br />• 4 project photos
      </>
    )
  },
  {
    cls: "cal-out",
    content: (
      <>
        APPROVE
        <div className="cal-wa-meta">
          <span className="cal-wa-time">09:08</span>
          <WaCheck />
        </div>
      </>
    )
  },
  { cls: "cal-in", content: "Approved. Action item created." }
];

function timeAgo(ts: number, now: number) {
  const s = Math.max(0, Math.round((now - ts) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`;
}

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function LiveClock() {
  const now = useNow(1000);
  return <span className="cal-clock">{new Date(now).toLocaleTimeString("en-GB")}</span>;
}

function LiveFeed() {
  const now = useNow(1000);
  const qi = useRef(4);
  const [items, setItems] = useState<FeedEntry[]>(() =>
    FEED_QUEUE.slice(0, 4).map((it, i) => ({ ...it, ts: Date.now() - (4 - i) * 9000 }))
  );

  useEffect(() => {
    const t = setInterval(() => {
      setItems((prev) => {
        const queuedItem = FEED_QUEUE[qi.current % FEED_QUEUE.length];
        if (!queuedItem) return prev;
        const nextItem = { ...queuedItem, ts: Date.now() };
        qi.current++;
        return [...prev.slice(1), nextItem];
      });
    }, 3400);
    return () => clearInterval(t);
  }, []);

  return (
    <ul className="cal-feed">
      {items.map((it, i) => (
        <li key={`${it.ts}-${it.tag}`} className={i === items.length - 1 ? "cal-new" : ""}>
          <b>{it.tag}</b>
          <span>{it.text}</span>
          <time>{timeAgo(it.ts, now)}</time>
        </li>
      ))}
    </ul>
  );
}

function Counter({ to }: { to: number }) {
  const ref = useRef<HTMLElement | null>(null);
  const started = useRef(false);
  const [val, setVal] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started.current) {
            started.current = true;
            const start = performance.now();
            const dur = 1100;
            function step(t: number) {
              const p = Math.min(1, (t - start) / dur);
              setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
              if (p < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
            io.disconnect();
          }
        });
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to]);

  return <strong ref={ref}>{val}</strong>;
}

function WaStatusBar() {
  return (
    <div className="cal-wa-status">
      <span>9:41</span>
      <span className="cal-status-icons">
        <span className="cal-signal">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="cal-battery">
          <i />
        </span>
      </span>
    </div>
  );
}

function WaHeader({
  avatar,
  title,
  subtitle
}: {
  avatar: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="cal-wa-header">
      <span className="cal-wa-back">‹</span>
      <span className="cal-wa-avatar">{avatar}</span>
      <span className="cal-wa-who">
        <b>{title}</b>
        <span>{subtitle}</span>
      </span>
      <span className="cal-wa-icon">⋮</span>
    </div>
  );
}

function WaInputBar() {
  return (
    <div className="cal-wa-input">
      <svg
        className="cal-wa-input-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M8 14s1.5 2 4 2 4-2 4-2" strokeLinecap="round" />
        <circle cx="9" cy="10" r=".6" fill="currentColor" />
        <circle cx="15" cy="10" r=".6" fill="currentColor" />
      </svg>
      <span className="cal-wa-input-field">Message</span>
      <svg
        className="cal-wa-input-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path
          d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"
          strokeLinejoin="round"
        />
        <circle cx="12" cy="13" r="3.3" />
      </svg>
      <span className="cal-wa-mic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M6 11a6 6 0 0 0 12 0" strokeLinecap="round" />
          <path d="M12 19v2" strokeLinecap="round" />
        </svg>
      </span>
    </div>
  );
}

function ChatBody({ id, bubbles }: { id: string; bubbles: Bubble[] }) {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setShown(bubbles.length);
      return;
    }
    let mounted = true;
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    function step() {
      if (!mounted) return;
      if (i >= bubbles.length) {
        timer = setTimeout(() => {
          if (!mounted) return;
          setShown(0);
          i = 0;
          timer = setTimeout(step, 700);
        }, 2400);
        return;
      }
      i++;
      setShown(i);
      timer = setTimeout(step, 750);
    }
    step();
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [bubbles]);

  return (
    <div className="cal-wa-body" id={id}>
      {bubbles.map((b, idx) => (
        <div key={idx} className={`cal-wa-msg ${b.cls} ${idx < shown ? "cal-show" : ""}`}>
          {b.content}
        </div>
      ))}
    </div>
  );
}

function WaPhone({
  glow,
  avatar,
  title,
  subtitle,
  chatId,
  bubbles
}: {
  glow: string;
  avatar: string;
  title: string;
  subtitle: string;
  chatId: string;
  bubbles: Bubble[];
}) {
  return (
    <div className="cal-wa-shell">
      <div className="cal-glow" style={{ background: glow }} />
      <div className="cal-wa-frame">
        <span className="cal-wa-btn cal-mute" />
        <span className="cal-wa-btn cal-vol-up" />
        <span className="cal-wa-btn cal-vol-down" />
        <span className="cal-wa-btn cal-power" />
        <div className="cal-wa-screen">
          <div className="cal-wa-island" />
          <WaStatusBar />
          <WaHeader avatar={avatar} title={title} subtitle={subtitle} />
          <ChatBody id={chatId} bubbles={bubbles} />
          <WaInputBar />
        </div>
      </div>
    </div>
  );
}

export function CaladronaLandingPage() {
  const [scrollP, setScrollP] = useState(0);

  useEffect(() => {
    function onScroll() {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      setScrollP(max > 0 ? h.scrollTop / max : 0);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const els = document.querySelectorAll(".cal-reveal");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("cal-in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <>
      <main className="caladrona-page">
        <div className="cal-scroll-bar">
          <span style={{ transform: `scaleX(${scrollP})` }} />
        </div>

        <nav className="cal-nav">
          <div className="cal-shell cal-nav-inner">
            <a className="cal-brand" href="#top">
              <span className="cal-mark" />
              Caladrona
            </a>
            <div className="cal-nav-links">
              <a href="#capture">Platform</a>
              <a href="#decide">WhatsApp</a>
              <a href="#record">Evidence</a>
              <a
                className="cal-btn cal-btn-ghost cal-nav-cta"
                style={{ height: 38, padding: "0 15px", fontSize: 13 }}
                href="/signup"
              >
                Sign up
              </a>
            </div>
          </div>
        </nav>

        <div id="top">
          <section className="cal-hero">
            <div className="cal-sweep" />
            <div className="cal-shell cal-hero-grid">
              <div className="cal-reveal">
                <div className="cal-kicker">
                  <span className="cal-dot" />
                  Operational intelligence for the physical world
                </div>
                <h1>
                  Nothing happens on site
                  <br />
                  without <span className="cal-grad-text">Caladrona</span> knowing.
                </h1>
                <p className="cal-lede">
                  Caladrona listens to every WhatsApp message, photo, voice note and document moving
                  through your field teams — and turns it into one grounded operational picture,
                  with the right decision routed to the right person.
                </p>
                <div className="cal-actions">
                  <a className="cal-btn cal-btn-ink" href="/signup">
                    Sign up
                  </a>
                  <a className="cal-btn cal-btn-ghost" href="#capture">
                    See how it works
                  </a>
                </div>
              </div>

              <div className="cal-console cal-glass cal-reveal">
                <div className="cal-console-head">
                  <span className="cal-live-dot" />
                  Live feed
                  <LiveClock />
                </div>
                <div className="cal-radar">
                  <div className="cal-radar-sweep" />
                  <div className="cal-radar-ring" />
                  <div className="cal-radar-ring cal-r2" />
                </div>
                <LiveFeed />
              </div>
            </div>
            <div className="cal-shell">
              <div className="cal-hero-meta cal-reveal">
                Built for airports, infrastructure, engineering and facilities teams running
                consequential field operations.
              </div>
            </div>
          </section>

          <section className="cal-manifesto cal-reveal">
            <div className="cal-shell">
              <div className="cal-kicker cal-center">The problem</div>
              <h2>
                Projects don&apos;t fail because people stop working.
                <br />
                <span>They fail because no one sees the whole picture.</span>
              </h2>
            </div>
          </section>

          <section className="cal-stage" id="capture">
            <div className="cal-shell cal-stage-grid">
              <div className="cal-stage-copy cal-reveal">
                <div className="cal-kicker">Capture</div>
                <h2>Every channel, already in use.</h2>
                <p>
                  Photos. Voice notes. Approvals. Delays. Defects. Your field teams already report
                  everything — just scattered across a thousand WhatsApp threads. Caladrona listens
                  to all of it, natively, without asking anyone to change how they work.
                </p>
              </div>
              <div className="cal-stage-visual cal-reveal">
                <WaPhone
                  glow="var(--cal-amber)"
                  avatar="TA"
                  title="Taxiway A · Field Ops"
                  subtitle="Site supervisor, +3 more"
                  chatId="chat1"
                  bubbles={CAPTURE_BUBBLES}
                />
              </div>
            </div>
          </section>

          <section className="cal-stage cal-alt" id="structure">
            <div className="cal-shell">
              <div className="cal-stage-head cal-reveal">
                <div className="cal-kicker">Structure</div>
                <h2>Chaos becomes a live operational model.</h2>
                <p>
                  Every message is linked to a project, a milestone, a person, a piece of evidence.
                  Routine updates fade into context. What&apos;s material rises automatically — no
                  one has to go looking for it.
                </p>
              </div>
              <div className="cal-board cal-glass cal-reveal">
                <div className="cal-glow" style={{ background: "var(--cal-teal)" }} />
                <div className="cal-board-top">
                  <div>
                    <small>Taxiway A rehabilitation</small>
                    <h3>Project command</h3>
                  </div>
                  <span className="cal-badge cal-amber">Needs attention</span>
                </div>
                <div className="cal-metrics">
                  <div className="cal-metric">
                    <span>Open decisions</span>
                    <Counter to={3} />
                  </div>
                  <div className="cal-metric">
                    <span>Signals today</span>
                    <Counter to={47} />
                  </div>
                  <div className="cal-metric">
                    <span>Evidence linked</span>
                    <Counter to={128} />
                  </div>
                </div>
                <div className="cal-board-grid">
                  <div className="cal-panel">
                    <h4>What needs attention</h4>
                    <div className="cal-rec">
                      <small>Recommended action</small>
                      <h3>Schedule consultant inspection</h3>
                      <p>Testing is complete. The signed checklist was uploaded 18 minutes ago.</p>
                      <div className="cal-rec-actions">
                        <span className="cal-tag cal-solid">Approve</span>
                        <span className="cal-tag">View evidence</span>
                      </div>
                    </div>
                  </div>
                  <div className="cal-panel">
                    <h4>What changed</h4>
                    <div className="cal-tl">
                      <i />
                      <div>
                        <b>Testing completed</b>
                        <span>18 min ago</span>
                      </div>
                    </div>
                    <div className="cal-tl">
                      <i />
                      <div>
                        <b>Punch list closed</b>
                        <span>42 min ago</span>
                      </div>
                    </div>
                    <div className="cal-tl">
                      <i />
                      <div>
                        <b>Checklist signed</b>
                        <span>1 hr ago</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="cal-stage" id="decide">
            <div className="cal-shell cal-stage-grid cal-reverse">
              <div className="cal-stage-copy cal-reveal">
                <div className="cal-kicker">Decide</div>
                <h2>The decision finds the decision-maker.</h2>
                <p>
                  When something needs a human call, Caladrona sends exactly one message to exactly
                  the right person — in WhatsApp, with the evidence attached. Approve, reject, or
                  ask for more. Nothing executes without a person saying yes.
                </p>
              </div>
              <div className="cal-stage-visual cal-reveal">
                <WaPhone
                  glow="var(--cal-teal)"
                  avatar="C"
                  title="Caladrona"
                  subtitle="Business account"
                  chatId="chat2"
                  bubbles={DECIDE_BUBBLES}
                />
              </div>
            </div>
          </section>

          <section className="cal-stage cal-alt" id="record">
            <div className="cal-shell cal-stage-grid">
              <div className="cal-stage-copy cal-reveal">
                <div className="cal-kicker">Record</div>
                <h2>Every answer comes with its receipts.</h2>
                <p>
                  Open any recommendation and see precisely what it&apos;s grounded in — the
                  message, the photo, the signed document, the timestamp. Nothing is a black box,
                  and nothing is forgotten.
                </p>
              </div>
              <div className="cal-stage-visual cal-reveal">
                <div className="cal-trace cal-glass">
                  <div className="cal-glow" style={{ background: "var(--cal-amber)" }} />
                  <div className="cal-trace-top">
                    <small>Evidence chain · REC-1842</small>
                    <span className="cal-badge cal-teal">Grounded</span>
                  </div>
                  <h3>Why the inspection is ready.</h3>
                  <p>
                    Testing is complete, the checklist is signed, and the latest site evidence shows
                    the relevant scope closed.
                  </p>
                  <div className="cal-hr" />
                  <div className="cal-source">
                    <i className="cal-source-ic">✦</i>
                    <div>
                      <b>Site update</b>
                      <p>&ldquo;Installation and testing complete.&rdquo;</p>
                    </div>
                    <time>08:42</time>
                  </div>
                  <div className="cal-source">
                    <i className="cal-source-ic">▤</i>
                    <div>
                      <b>Signed checklist</b>
                      <p>Testing record uploaded and verified.</p>
                    </div>
                    <time>09:07</time>
                  </div>
                  <div className="cal-source">
                    <i className="cal-source-ic">◫</i>
                    <div>
                      <b>Project photos</b>
                      <p>Four images linked to the work package.</p>
                    </div>
                    <time>09:14</time>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="cal-closing cal-reveal">
            <div className="cal-shell">
              <div className="cal-cta-card">
                <div className="cal-kicker cal-center">Built for consequential operations</div>
                <h2>
                  For projects where being wrong is expensive,
                  <br />
                  and finding out late is worse.
                </h2>
                <p>
                  Human-controlled. Access-aware. Grounded in the evidence your teams already
                  produce every day. Caladrona is onboarding a small number of design-partner
                  pilots.
                </p>
                <div className="cal-actions cal-center">
                  <a className="cal-btn cal-btn-ink" href="/signup">
                    Sign up
                  </a>
                  <a className="cal-btn cal-btn-ghost" href="/login">
                    Log in
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="cal-footer-bar">
          <div className="cal-shell cal-foot">
            <a className="cal-brand" href="#top">
              <span className="cal-mark" />
              Caladrona
            </a>
            <div className="cal-foot-links">
              <a href="#capture">Platform</a>
              <a href="#decide">WhatsApp</a>
              <a href="#record">Evidence</a>
              <a href="mailto:hello@caladrona.com">Contact</a>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
