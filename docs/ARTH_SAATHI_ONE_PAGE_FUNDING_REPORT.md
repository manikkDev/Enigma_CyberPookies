<div style="font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.1;">

<p align="center" style="font-size: 14pt; margin: 0;"><strong>ARTH SAATHI: SAFER FINANCIAL RISK DETECTION WITHOUT SHARING CUSTOMER DATA</strong></p>
<p align="center" style="margin: 2px 0 6px 0;"><strong>Track:</strong> FinTech &nbsp;|&nbsp; <strong>PS 2:</strong> Federated Learning for Cross-Institution Financial Risk Control &nbsp;|&nbsp; <strong>Department:</strong> Computer Engineering</p>

<p style="margin: 3px 0;"><strong>Team:</strong> [Member Name – Roll No.], [Member Name – Roll No.], [Member Name – Roll No.] &nbsp;|&nbsp; <strong>Contact:</strong> [Phone Number]</p>

<p style="margin: 5px 0 2px 0;"><strong>Abstract</strong></p>
<p style="margin: 0 0 5px 0; text-align: justify;">A bank may know a customer’s repayment history, an insurer may know their claims, and a lending app may know their spending. Looking at only one part can lead to missed fraud and poor decisions for customers with limited credit history. Yet collecting all records in one place creates privacy, security and legal concerns. This is increasingly important as the RBI prioritises stronger fraud detection and India’s DPDP framework requires clear purpose, consent, safeguards and accountability.</p>

<p style="margin: 0 0 5px 0; text-align: justify;"><strong>Arth Saathi</strong> lets institutions improve one shared risk model while customer records remain inside each institution. The model is sent to participating institutions, learns from their local records, and returns only mathematical updates—not names, account numbers or transaction rows. These updates are combined into a stronger model. This is called <strong>Federated Learning</strong>. Added safeguards hide individual institutional updates, reduce the influence of any one customer, and match common customers without exposing complete customer lists. Only coded identities and calculated risk links enter the suspicious-network graph.</p>

<p style="margin: 0 0 5px 0; text-align: justify;">The platform gives bank employees risk scores, understandable reasons, suspicious-group analysis and suggested next steps, while a human remains responsible for the final decision. Citizens can manage consent, request their data record and raise an erasure request. Sensitive actions are recorded in an audit trail.</p>

<p style="margin: 0 0 5px 0; text-align: justify;"><strong>Demonstrated results:</strong> The working prototype includes bank-employee and citizen interfaces, collaborative training, consent, auditing, suspicious-network analysis and an assistant. Testing used PaySim, an openly available <strong>synthetic</strong> benchmark—not real customer data: 5,726,358 training transactions across five simulated institutions, with 636,262 held for testing. On PR-AUC, a rare-fraud measure where higher is better, isolated institutions averaged <strong>0.656</strong>, Arth Saathi reached <strong>0.684</strong>, and pooling all records reached <strong>0.772</strong>—a measurable gain without moving raw records. A second test combining different institutions’ information about shared customers raised AUC from <strong>0.970 to 0.988</strong>. All results are stored in reproducible files; update-hiding and private-matching components are research simulations pending pilot hardening.</p>

<p style="margin: 0 0 4px 0; text-align: justify;"><strong>Funding outcome (12-week pilot):</strong> Prepare a controlled pilot for 3–5 institutions by strengthening privacy, security and reliability; connecting a partner-approved anonymised data format; validating model quality; and delivering a live demonstration, evaluation report, deployment guide and adoption roadmap. The long-term goal is an institution-hosted service that provides shared risk intelligence without taking control of customer data away from participating institutions.</p>

<p style="margin: 5px 0 2px 0;"><strong>Project Cost: ₹99,000 (within the ₹1,00,000 limit)</strong></p>

<table style="width: 100%; border-collapse: collapse; font-size: 10.5pt; line-height: 1.05;">
<tr><th align="left">Proposed use of funds</th><th align="right">Amount</th></tr>
<tr><td>Secure cloud testing and separate institutional test environments</td><td align="right">₹24,000</td></tr>
<tr><td>Privacy safeguards and security testing</td><td align="right">₹22,000</td></tr>
<tr><td>Partner data-format integration and model validation</td><td align="right">₹18,000</td></tr>
<tr><td>Deployment, monitoring, backup and reliability tools</td><td align="right">₹12,000</td></tr>
<tr><td>Compliance documentation, user testing and pilot onboarding</td><td align="right">₹13,000</td></tr>
<tr><td>Contingency, demonstration and project communication</td><td align="right">₹10,000</td></tr>
<tr><td><strong>Total</strong></td><td align="right"><strong>₹99,000</strong></td></tr>
</table>

<p style="margin: 5px 0 2px 0;"><strong>Guide Name: [Guide Name]</strong></p>

<p style="font-size: 8.5pt; margin: 4px 0 0 0;"><strong>Evidence:</strong> RBI Annual Report 2024–25 (29 May 2025); MeitY Digital Personal Data Protection Act, 2023 and Rules, 2025 (notified 14 November 2025); reproducible technical results in <code>ml-fl-service/runs/</code>.</p>

</div>
