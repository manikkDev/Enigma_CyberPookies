import useScrollReveal from "@/hooks/useScrollReveal";
import CircularFlowDiagram from "./CircularFlowDiagram";

const steps = [
  {
    num: "01",
    title: "Partition",
    subtitle: "Real data, five institutions",
    body: "5.7M real transactions (PaySim, SHA-256 verified) are partitioned across five simulated banks. Customer IDs are pseudonymised with a keyed hash before anything else touches them.",
  },
  {
    num: "02",
    title: "Train locally",
    subtitle: "Each bank, on its own data",
    body: "Every institution runs local epochs inside its own boundary. Raw customer rows never leave — only clipped model weight updates are produced for aggregation.",
  },
  {
    num: "03",
    title: "Aggregate",
    subtitle: "Secure aggregation + DP noise",
    body: "Pairwise masks mean the server only ever sees the sum of updates, never an individual bank's. Optional differential privacy adds calibrated noise with a reported ε budget.",
  },
  {
    num: "04",
    title: "Converge",
    subtitle: "A shared global model",
    body: "Rounds repeat until the federated model approaches the centralized ceiling — measurably better than any bank training alone, with PR-AUC tracked per round.",
  },
  {
    num: "05",
    title: "Explain & consent",
    subtitle: "Scores people can trust",
    body: "Analysts see feature-level explanations and a pseudonymised risk graph. Citizens see their band, plain-language reasons, and consent controls they actually own.",
  },
];

const HowItWorksSection = () => {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section
      id="how-it-works"
      className="py-24 md:py-32 bg-secondary"
    >
      <div
        ref={ref}
        className="mx-auto max-w-6xl px-6"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(24px)",
          transition: "all 0.6s ease",
        }}
      >
        {/* Header row: text left, diagram right */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-14">
          <div>
            <span className="text-8xl font-mono text-primary text-bold mb-2">HOW IT WORKS</span>
            <h2 className="mt-6 text-3xl md:text-[42px] leading-[1.15] font-serif text-foreground">
              From siloed ledgers
              <br />
              <span className="font-bold">to one shared risk model.</span>
            </h2>
          </div>
          <div className="flex justify-center md:justify-end">
            <div className="float-card animate-idle-float p-5 w-full max-w-[280px]">
              <CircularFlowDiagram />
            </div>
          </div>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map((s, i) => (
            <div
              key={s.num}
              className="glass-card !p-5 flex flex-col"
              style={{ transitionDelay: `${i * 60}ms` }}
            >
              <span className="text-2xl font-mono text-primary mb-2" style={{ opacity: 0.3 }}>
                {s.num}
              </span>
              <h3 className="text-base font-serif text-foreground">
                {s.title}
              </h3>
              <p className="text-xs font-mono text-primary mb-2">{s.subtitle}</p>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
