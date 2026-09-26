import useScrollReveal from "@/hooks/useScrollReveal";
import CircularFlowDiagram from "./CircularFlowDiagram";

const steps = [
  {
    num: "01",
    title: "Collect",
    subtitle: "Ingest threat content & indicators",
    body: "Email headers, SMS logs, social posts, URLs, attachments, and threat reports are collected. Public threat intelligence feeds and IOC databases are cross-referenced automatically.",
  },
  {
    num: "02",
    title: "Extract",
    subtitle: "Build the threat relationship graph",
    body: "Every domain, URL, email, phone, and actor becomes a node. Every connection, mention, or transaction becomes a directed edge. Multi-platform attack chains are resolved into a single traversable graph.",
  },
  {
    num: "03",
    title: "Analyze",
    subtitle: "Run pattern & campaign detection",
    body: "AI algorithms scan for phishing patterns, malicious infrastructure, coordinated campaigns, and behavioral anomalies matching known threat typologies.",
  },
  {
    num: "04",
    title: "Score",
    subtitle: "Assign explainable risk scores",
    body: "Each threat indicator receives a risk score based on content analysis, infrastructure reputation, behavioral patterns, and campaign correlation. Critical threats (90+) are escalated immediately.",
  },
  {
    num: "05",
    title: "Investigate",
    subtitle: "Surface intelligence to analysts",
    body: "Threat campaigns appear in the investigator queue with visual attack graphs, IOC timelines, risk breakdowns, and exportable intelligence packages.",
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
              From scattered threats
              <br />
              <span className="font-bold">to complete campaign intelligence.</span>
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
