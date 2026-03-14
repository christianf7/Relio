export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-25 -left-30 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="absolute -right-20 -bottom-30 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />
        </div>

        <div className="relative container mx-auto px-6 py-24 sm:py-32">
          <p className="mb-6 inline-flex rounded-full border border-white/20 bg-white/5 px-4 py-1 text-xs tracking-[0.2em] text-white/70 uppercase">
            Relio
          </p>
          <h1 className="max-w-4xl text-5xl leading-tight font-black tracking-tight sm:text-6xl lg:text-7xl">
            Real-world connections,
            <span className="block bg-linear-to-r from-fuchsia-400 to-cyan-300 bg-clip-text text-transparent">
              made effortless.
            </span>
          </h1>
          <p className="mt-6 max-w-2xl text-base text-white/70 sm:text-lg">
            Discover local events, meet people nearby, and keep your social
            network active with QR-powered connection flows.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <a
              href="#features"
              className="rounded-xl bg-white px-6 py-3 text-center text-sm font-semibold text-neutral-950 transition hover:bg-white/90"
            >
              View features
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="container mx-auto px-6 py-16 sm:py-20">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              title: "Event Discovery",
              description:
                "Browse curated local events and jump into what matters to you.",
            },
            {
              title: "Instant QR Connect",
              description:
                "Swap profiles in seconds with stylish, branded QR cards.",
            },
            {
              title: "Shared Community",
              description:
                "Build meaningful, recurring connections across your area.",
            },
          ].map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-white/10 bg-white/3 p-6"
            >
              <h2 className="text-lg font-semibold">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/65">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
