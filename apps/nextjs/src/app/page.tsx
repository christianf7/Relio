import Image from "next/image";

export default function HomePage() {
  return (
    <main className="relative flex h-dvh w-screen flex-col overflow-hidden bg-[#050a18] font-[family-name:var(--font-dm-sans)] text-white">
      {/* ── Background atmosphere ── */}
      <div className="pointer-events-none absolute inset-0 z-0">
        {/* Core glow behind phone area */}
        <div className="absolute top-[15%] right-[8%] h-[70vh] w-[50vw] rounded-full bg-indigo-600/[0.12] blur-[150px]" />
        <div className="absolute top-[30%] right-[15%] h-[50vh] w-[35vw] rounded-full bg-violet-500/[0.08] blur-[120px]" />
        <div className="absolute -bottom-[10%] left-[20%] h-[40vh] w-[40vw] rounded-full bg-blue-600/[0.06] blur-[100px]" />
        {/* Accent pinch */}
        <div className="absolute top-[60%] right-[30%] h-[25vh] w-[25vh] rounded-full bg-fuchsia-500/[0.07] blur-[80px]" />
      </div>

      {/* Grain */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />

      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* ── Nav ── */}
      <header className="relative z-20 flex shrink-0 items-center justify-between px-6 pt-5 sm:px-10 lg:px-14">
        <div className="flex items-center gap-2.5">
          <Image
            src="/icon-dark.png"
            alt="Relio"
            width={32}
            height={32}
            className="h-7 w-7 mix-blend-screen"
          />
          <span className="text-[15px] font-semibold tracking-wide text-white/90">
            Relio
          </span>
        </div>

        <a
          href="https://testflight.apple.com/join/BUatBP72"
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-xs font-medium text-white/70 backdrop-blur-md transition-all duration-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="shrink-0"
          >
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
          </svg>
          <span className="hidden sm:inline">Download on TestFlight</span>
          <span className="sm:hidden">TestFlight</span>
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            <path d="M7 17L17 7M17 7H7M17 7v10" />
          </svg>
        </a>
      </header>

      {/* ── Main content ── */}
      <div className="relative z-20 flex min-h-0 flex-1 items-center">
        <div className="flex h-full w-full flex-col lg:flex-row">
          {/* Left column */}
          <div className="flex flex-1 flex-col justify-center px-6 pt-6 pb-2 sm:px-10 lg:max-w-[52%] lg:px-14 lg:py-0">
            <div className="max-w-lg">
              {/* Badge */}
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3.5 py-1.5 backdrop-blur-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[11px] font-medium tracking-widest text-white/50 uppercase">
                  Built at UNIHACK 2026
                </span>
              </div>

              {/* Headline */}
              <h1 className="text-[clamp(2.2rem,4.8vw,3.8rem)] leading-[1.05] font-bold tracking-[-0.025em]">
                Your network,
                <br />
                <span className="font-[family-name:var(--font-instrument-serif)] italic text-transparent [-webkit-text-stroke:1.5px_rgba(255,255,255,0.35)]">
                  elevated
                </span>
                <span className="inline-block h-3 w-3 translate-y-[-0.15em] rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-400" />
              </h1>

              {/* Sub */}
              <p className="mt-5 max-w-[26rem] text-[15px] leading-[1.7] text-white/45">
                We&rsquo;ve all left a networking event with a pocket full of
                business cards and zero real connections. Relio surfaces the
                right people, helps you start real conversations, and reminds
                you to follow up.
              </p>

              {/* Feature row */}
              <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                {[
                  { label: "Smart Matching", sub: "Shared interest pairing" },
                  { label: "Event Discovery", sub: "Elasticsearch-powered" },
                  { label: "QR Connect", sub: "Instant profile swap" },
                  { label: "Attendee Insights", sub: "Scan & discover" },
                  { label: "Follow-up Nudges", sub: "Never lose touch" },
                  { label: "Cross-platform", sub: "iOS, iPadOS, Android" },
                ].map((feat) => (
                  <div key={feat.label}>
                    <p className="text-[13px] font-semibold text-white/80">
                      {feat.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/30">
                      {feat.sub}
                    </p>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <div className="mt-9 flex items-center gap-5">
                <a
                  href="https://testflight.apple.com/join/BUatBP72"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative inline-flex items-center gap-2.5 rounded-full bg-white px-7 py-3 text-[13px] font-semibold text-[#050a18] shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_4px_30px_rgba(99,102,241,0.15)] transition-all duration-300 hover:shadow-[0_0_0_1px_rgba(255,255,255,0.2),0_4px_40px_rgba(99,102,241,0.25)]"
                >
                  Try on TestFlight
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-transform duration-200 group-hover:translate-x-0.5"
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </a>
                <a
                  href="https://github.com/christianf7/Relio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[13px] font-medium text-white/35 transition-colors duration-200 hover:text-white/60"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  View source
                </a>
              </div>

              {/* Bottom strip */}
              <div className="mt-9 flex items-center gap-5 border-t border-white/[0.05] pt-5">
                <div>
                  <p className="text-[9px] font-medium tracking-[0.15em] text-white/25 uppercase">
                    Stack
                  </p>
                  <p className="mt-1 text-[11px] text-white/45">
                    T3 Turbo · Expo · Prisma
                  </p>
                </div>
                <div className="h-5 w-px bg-white/[0.05]" />
                <div>
                  <p className="text-[9px] font-medium tracking-[0.15em] text-white/25 uppercase">
                    Auth
                  </p>
                  <p className="mt-1 text-[11px] text-white/45">Better Auth</p>
                </div>
                <div className="h-5 w-px bg-white/[0.05]" />
                <div>
                  <p className="text-[9px] font-medium tracking-[0.15em] text-white/25 uppercase">
                    Search
                  </p>
                  <p className="mt-1 text-[11px] text-white/45">
                    Elasticsearch
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right column — hero phone */}
          <div className="relative flex flex-1 items-center justify-center lg:justify-end">
            {/* Radial glow directly behind the phone */}
            <div className="pointer-events-none absolute top-1/2 left-1/2 z-0 h-[90%] w-[80%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-radial from-indigo-500/[0.08] to-transparent blur-[40px]" />

            <div className="relative z-10 mr-0 h-[52vh] w-auto sm:h-[58vh] lg:mr-[5%] lg:h-[88vh]">
              <Image
                src="/hero-phone.png"
                alt="Relio app on iPhone showing the welcome screen with LinkedIn sign-in"
                width={800}
                height={1200}
                priority
                className="h-full w-auto object-contain mix-blend-screen"
              />
            </div>

            {/* Floating quote */}
            <div className="absolute bottom-[8%] left-2 z-30 max-w-[220px] rounded-2xl border border-white/[0.06] bg-[#0a1128]/80 p-4 backdrop-blur-2xl sm:left-auto sm:bottom-[12%] sm:right-[52%] lg:bottom-[16%] lg:right-[56%]">
              <div className="mb-2 flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <svg
                    key={i}
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="text-amber-400/80"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </div>
              <p className="text-[11px] leading-[1.6] font-medium text-white/55 italic">
                &ldquo;The best professional relationships don&rsquo;t start
                with a LinkedIn request&mdash;they start with a real
                conversation.&rdquo;
              </p>
            </div>

            {/* Floating tech badge */}
            <div className="absolute top-[12%] right-[8%] z-30 hidden rounded-xl border border-white/[0.06] bg-[#0a1128]/80 px-3.5 py-2.5 backdrop-blur-2xl lg:block">
              <p className="text-[9px] font-semibold tracking-[0.15em] text-white/40 uppercase">
                Powered by
              </p>
              <p className="mt-1 text-[12px] font-semibold text-white/70">
                Elasticsearch
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom line */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </main>
  );
}
