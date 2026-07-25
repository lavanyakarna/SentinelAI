# SentinelAI

AI-powered behavioral anomaly detection for cybersecurity

Most security systems wait for a known signature to match. SentinelAI doesn't wait — it learns what "normal" looks like for every user, service account, and device on a network, then catches the exact moment something deviates from it.

## The idea

Traditional signature-based security fails against novel, slow-moving intrusions — the ones designed not to match any known pattern. SentinelAI flips the approach: instead of asking "does this match a known attack," it asks "does this look like this entity's normal behavior?"

Every login, API call, and resource access leaves a behavioral trail — timing, location, device, session length, sequence of actions. SentinelAI profiles that trail per entity, flags deviations in near real-time, classifies what kind of attack it resembles, and explains exactly why, with real model-derived reasoning, not a canned message.

## Results

Ensemble Precision: 0.866
Ensemble Recall: 0.951
PR-AUC: 0.979
Throughput: ~20,000 events per second
False positive rate at top 2% alert budget: 13%, capturing 95% of real threats

## What makes it different

Ensemble detection combines Isolation Forest, which catches unknown never-seen-before attacks, with Random Forest, which precisely classifies known ones. Together they outperform either alone.

Real explainability means every flagged event carries SHAP-based feature attributions, not hand-coded rules dressed up as AI reasoning.

Drift-aware baselines are rolling per-entity profiles that adapt as legitimate behavior evolves, instead of permanently punishing normal change.

Cold-start handling means brand-new entities with zero history are still scored safely using smart fallbacks.

The system is proven, not just claimed, benchmarked for real-time throughput and validated with a live streaming simulation.

It is honest about its limits. Lateral movement detection improved from 0% to 70% after diagnosing a missing signal, documented transparently.

## Attack types detected

Brute force, credential stuffing, impossible travel, device spoofing, lateral movement, low-and-slow exfiltration, insider drift.

## How it works

Access logs feed into rolling baseline profiling, then feature engineering, then an Isolation Forest and Random Forest ensemble, then SHAP explainability, then the analyst dashboard.

## Tech stack

Python, scikit-learn, SHAP, pandas, numpy, HTML, CSS, JavaScript, Chart.js, Leaflet.

## Quick start

pip install faker scikit-learn pandas numpy matplotlib shap
python generate_data.py
python detect.py
python -m http.server 8000

Built to catch what signatures miss.
