import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Shield, Search, MessageCircle, AlertTriangle, Network, FileText } from "lucide-react";

const features = [
  { icon: Shield, title: "Malicious Content Detection", description: "Identify phishing, malware, and harmful content across emails, SMS, and social platforms." },
  { icon: Search, title: "IOC & Entity Extraction", description: "Automatically extract URLs, domains, emails, phone numbers, and threat indicators from any content." },
  { icon: MessageCircle, title: "AI Threat Investigator", description: "Chat with an AI assistant trained in cyber threat analysis and financial crime investigation." },
  { icon: AlertTriangle, title: "Real-time Threat Scoring", description: "Get explainable risk scores with breakdowns for content, infrastructure, and behavioral patterns." },
  { icon: Network, title: "Campaign Correlation Graph", description: "Visualize threat networks and relationships between actors, infrastructure, and attack patterns." },
  { icon: FileText, title: "AML & Financial Threats", description: "Detect money laundering patterns, illicit finance networks, and financial crime typologies." },
];

const FeatureCard = ({ feature, index }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  const Icon = feature.icon;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="glass-card glow-border-hover p-8 rounded-2xl group cursor-default"
    >
      <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center mb-5 group-hover:bg-primary/25 transition-colors duration-500">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <h3 className="font-heading text-lg font-semibold text-foreground mb-3">{feature.title}</h3>
      <p className="font-body text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
    </motion.div>
  );
};

const FeaturesSection = () => {
  return (
    <section id="features" className="section-spacing relative">
      <div className="container mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl md:text-5xl font-bold text-foreground mb-4">
            Digital Threat <span className="text-gradient-primary">Intelligence</span>
          </h2>
          <p className="font-body text-muted-foreground text-lg max-w-xl mx-auto">
            Six powerful analysis modules working together to protect your digital ecosystem.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => (
            <FeatureCard key={feature.title} feature={feature} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
