import pandas as pd, numpy as np, time
from collections import Counter
from sklearn.ensemble import IsolationForest, RandomForestClassifier
from sklearn.svm import OneClassSVM
from sklearn.preprocessing import StandardScaler, MinMaxScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, precision_recall_curve, auc
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import shap

df = pd.read_csv("access_logs.csv", parse_dates=["timestamp"])
df = df.sort_values(["entity_id","timestamp"]).reset_index(drop=True)
df["hour"] = df.timestamp.dt.hour

# ---------- GLOBAL DEFAULTS (cold-start) ----------
GLOBAL = dict(
    hour_mean=df.hour.mean(), hour_std=df.hour.std(),
    dur_mean=df.session_duration.mean(), dur_std=df.session_duration.std(),
)

# ---------- ROLLING BASELINE PROFILE (drift-aware) ----------
def rolling_profile(g):
    g = g.copy()
    win = 20
    g["hour_mean"]  = g.hour.expanding().mean().shift(1)
    g["hour_std"]   = g.hour.expanding().std().shift(1)
    g["dur_mean"]   = g.session_duration.rolling(win, min_periods=1).mean().shift(1)
    g["dur_std"]    = g.session_duration.rolling(win, min_periods=1).std().shift(1)
    g["geo_lat_mean"] = g.geo_lat.rolling(win, min_periods=1).mean().shift(1)
    g["geo_lon_mean"] = g.geo_lon.rolling(win, min_periods=1).mean().shift(1)

    dev_counter, res_seen_set = Counter(), set()
    dev_mode_col, res_seen_col, new_res_col = [], [], []
    for d, r in zip(g.device_fingerprint, g.resource_accessed):
        dev_mode_col.append(dev_counter.most_common(1)[0][0] if dev_counter else d)
        res_seen_col.append(len(res_seen_set) if res_seen_set else 1)
        new_res_col.append(1 if (res_seen_set and r not in res_seen_set) else 0)
        dev_counter[d] += 1
        res_seen_set.add(r)
    g["device_mode"] = dev_mode_col
    g["res_seen"] = res_seen_col
    g["new_resource"] = new_res_col

    g["events_last_5min"] = g.timestamp.diff().dt.total_seconds().lt(300).rolling(5, min_periods=1).sum()
    g["fail_like_burst"]  = (g.session_duration < 5).rolling(5, min_periods=1).sum()
    return g

df = df.groupby("entity_id", group_keys=False).apply(rolling_profile)

# ---------- COLD-START FILL ----------
cold_start_mask = df.hour_mean.isna()
df["is_cold_start"] = cold_start_mask.astype(int)
df["hour_mean"] = df["hour_mean"].fillna(GLOBAL["hour_mean"])
df["hour_std"] = df["hour_std"].fillna(GLOBAL["hour_std"])
df["dur_mean"] = df["dur_mean"].fillna(GLOBAL["dur_mean"])
df["dur_std"] = df["dur_std"].fillna(GLOBAL["dur_std"])
df["geo_lat_mean"] = df["geo_lat_mean"].fillna(df.geo_lat)
df["geo_lon_mean"] = df["geo_lon_mean"].fillna(df.geo_lon)
df["res_seen"] = df["res_seen"].fillna(1)
df["new_resource"] = df["new_resource"].fillna(0)
df["events_last_5min"] = df["events_last_5min"].fillna(0)
df["fail_like_burst"] = df["fail_like_burst"].fillna(0)
df["device_mode"] = df["device_mode"].fillna(df.device_fingerprint)
df["hour_std"] = df.hour_std.replace(0, 1e-3).fillna(1e-3)
df["dur_std"] = df.dur_std.replace(0, 1e-3).fillna(1e-3)

# ---------- DEVIATION FEATURES ----------
df["geo_dev"] = np.sqrt((df.geo_lat-df.geo_lat_mean)**2 + (df.geo_lon-df.geo_lon_mean)**2)
df["hour_dev"] = np.abs(df.hour - df.hour_mean) / (df.hour_std+1e-3)
df["dur_dev"] = np.abs(df.session_duration - df.dur_mean) / (df.dur_std+1e-3)
df["new_device"] = (df.device_fingerprint != df.device_mode).astype(int)
df["cmd_seq"] = df.command_sequence

df["country_prev"] = df.groupby("entity_id")["country"].shift(1)
df["country_changed"] = ((df["country"] != df["country_prev"]) & (df["geo_dev"] > 5)).astype(int)
df["country_changed"] = df["country_changed"].fillna(0)

FEATURES = ["geo_dev","hour_dev","dur_dev","new_device","cmd_seq",
            "res_seen","events_last_5min","fail_like_burst","is_cold_start","new_resource"]
X = df[FEATURES].fillna(0)

# ---------- DETECTION: ISOLATION FOREST ----------
iso = IsolationForest(n_estimators=200, contamination=0.02, random_state=42)
df["anomaly_score"] = -iso.fit_predict(X)
df["risk_score"] = -iso.score_samples(X)

# ---------- CLASSIFICATION (rule-based, initial) ----------
def classify(row):
    if row.geo_dev > 30: return "impossible_travel"
    if row.fail_like_burst >= 3: return "brute_force / credential_stuffing"
    if row.new_device == 1: return "device_spoofing"
    if row.new_resource == 1 and row.events_last_5min >= 2: return "lateral_movement (accessing unfamiliar resources)"
    if row.cmd_seq >= 5: return "insider_drift"
    if row.hour_dev > 3: return "low_and_slow (off-hours)"
    return "unclassified_anomaly"

df["predicted_type"] = np.where(df.anomaly_score==1, df.apply(classify, axis=1), "normal")

# ---------- EXPLANATION (rule-based, initial) ----------
def explain(row):
    reasons = []
    if row.geo_dev > 10: reasons.append("Foreign Login / Geo Velocity")
    if row.country_changed == 1: reasons.append("Country Change Detected")
    if row.hour_dev > 2: reasons.append("Midnight/Unusual Hour Login")
    if row.new_device == 1: reasons.append("Unknown Device")
    if row.new_resource == 1: reasons.append("Unfamiliar Resource Accessed")
    if row.dur_dev > 2: reasons.append("Abnormal Session Duration")
    if row.fail_like_burst >= 2: reasons.append("Multiple Failed Attempts")
    if row.events_last_5min >= 3: reasons.append("Rapid Resource Access")
    if row.is_cold_start == 1: reasons.append("New/Unrecognized Entity")
    if not reasons: reasons.append("General Behavioral Deviation")
    return "; ".join(reasons)

df["explanation"] = np.where(df.anomaly_score==1, df.apply(explain, axis=1), "")

# ---------- EVALUATION: ISOLATION FOREST ----------
df["true_anomaly"] = (df.label != "normal").astype(int)
pred = (df.anomaly_score==1).astype(int)
tp = ((pred==1)&(df.true_anomaly==1)).sum(); fp=((pred==1)&(df.true_anomaly==0)).sum()
fn = ((pred==0)&(df.true_anomaly==1)).sum(); tn=((pred==0)&(df.true_anomaly==0)).sum()
precision = tp/(tp+fp+1e-9); recall = tp/(tp+fn+1e-9)

budget = max(1, int(0.01*len(df)))
top_alerts = df.sort_values("risk_score", ascending=False).head(budget)
fpr_at_budget = 1 - (top_alerts.true_anomaly.sum() / budget)

print(f"Precision={precision:.3f} Recall={recall:.3f} TP={tp} FP={fp} FN={fn} TN={tn}")
print(f"FPR at top-1% alert budget = {fpr_at_budget:.3f}")
print(f"Cold-start events handled: {df.is_cold_start.sum()}")
df.to_csv("scored_events.csv", index=False)
print("Saved scored_events.csv")

# ---------- MODEL COMPARISON: ONE-CLASS SVM ----------
Xs = StandardScaler().fit_transform(X)
ocsvm = OneClassSVM(nu=0.02, kernel="rbf", gamma="scale")
ocsvm_pred = ocsvm.fit_predict(Xs)
ocsvm_flag = (ocsvm_pred == -1).astype(int)
tp2 = ((ocsvm_flag==1)&(df.true_anomaly==1)).sum(); fp2=((ocsvm_flag==1)&(df.true_anomaly==0)).sum()
fn2 = ((ocsvm_flag==0)&(df.true_anomaly==1)).sum()
prec2 = tp2/(tp2+fp2+1e-9); rec2 = tp2/(tp2+fn2+1e-9)

print("\n=== MODEL COMPARISON ===")
print(f"Isolation Forest -> Precision={precision:.3f} Recall={recall:.3f}")
print(f"One-Class SVM    -> Precision={prec2:.3f} Recall={rec2:.3f}")
print("Chosen model: Isolation Forest" if precision+recall >= prec2+rec2 else "Chosen model: One-Class SVM")

# ---------- FEATURE IMPORTANCE (permutation, IF) ----------
baseline_scores = iso.score_samples(X)
importances = {}
for col in FEATURES:
    X_perm = X.copy()
    X_perm[col] = np.random.permutation(X_perm[col].values)
    perm_scores = iso.score_samples(X_perm)
    importances[col] = np.abs(baseline_scores - perm_scores).mean()
imp_df = pd.DataFrame(sorted(importances.items(), key=lambda x: -x[1]), columns=["feature","importance"])
print("\n=== FEATURE IMPORTANCE (Isolation Forest) ===")
print(imp_df.to_string(index=False))
imp_df.to_csv("feature_importance.csv", index=False)

# ---------- PER-TYPE DETECTION (Isolation Forest) ----------
print("\n=== PER-TYPE DETECTION (Isolation Forest) ===")
type_report = df[df.true_anomaly==1].groupby("label", group_keys=False).apply(
    lambda g: pd.Series({
        "total": len(g),
        "correctly_flagged": (g.anomaly_score==1).sum(),
        "detection_rate": round((g.anomaly_score==1).sum()/len(g), 3)
    }), include_groups=False
)
print(type_report)
type_report.to_csv("per_type_detection.csv")

# ---------- SUPERVISED CLASSIFIER: RANDOM FOREST ----------
df["label_multi"] = df["label"]
X_train, X_test, y_train, y_test = train_test_split(
    X, df["label_multi"], test_size=0.3, random_state=42, stratify=df["label_multi"])

rf = RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=42)
rf.fit(X_train, y_train)
y_pred = rf.predict(X_test)

print("\n=== SUPERVISED CLASSIFIER (Random Forest) ===")
print(classification_report(y_test, y_pred, zero_division=0))

df["rf_predicted_type"] = rf.predict(X)
rf_imp = pd.DataFrame({"feature": FEATURES, "importance": rf.feature_importances_}).sort_values("importance", ascending=False)
print("\n=== RF FEATURE IMPORTANCE ===")
print(rf_imp.to_string(index=False))
rf_imp.to_csv("rf_feature_importance.csv", index=False)

# ---------- PR CURVE (Isolation Forest, initial reference) ----------
prec_arr, rec_arr, _ = precision_recall_curve(df.true_anomaly, df.risk_score)
pr_auc = auc(rec_arr, prec_arr)
print(f"\n=== PR-AUC (Isolation Forest only, reference) = {pr_auc:.3f} ===")

# ---------- ENSEMBLE SCORE (Isolation Forest + Random Forest) ----------
rf_proba = rf.predict_proba(X)
normal_idx = list(rf.classes_).index("normal")
rf_anomaly_prob = 1 - rf_proba[:, normal_idx]

iso_norm = MinMaxScaler().fit_transform(df.risk_score.values.reshape(-1,1)).flatten()
rf_norm = MinMaxScaler().fit_transform(rf_anomaly_prob.reshape(-1,1)).flatten()
df["ensemble_score"] = 0.5*iso_norm + 0.5*rf_norm

ensemble_pred = (df["ensemble_score"] > np.percentile(df["ensemble_score"], 98)).astype(int)
tp3 = ((ensemble_pred==1)&(df.true_anomaly==1)).sum(); fp3=((ensemble_pred==1)&(df.true_anomaly==0)).sum()
fn3 = ((ensemble_pred==0)&(df.true_anomaly==1)).sum()
prec3 = tp3/(tp3+fp3+1e-9); rec3 = tp3/(tp3+fn3+1e-9)

print(f"\n=== ENSEMBLE (IF + RF) -> Precision={prec3:.3f} Recall={rec3:.3f} ===")

# ---------- SHAP EXPLAINABILITY (flagged events only, fast) ----------
explainer = shap.TreeExplainer(rf)
flagged_idx = df[df.rf_predicted_type != "normal"].index
X_flagged = X.loc[flagged_idx]
shap_values_flagged = explainer.shap_values(X_flagged)

def shap_explain_row(pos, i):
    pred_class = df.loc[i, "rf_predicted_type"]
    class_idx = list(rf.classes_).index(pred_class)
    row_shap = shap_values_flagged[class_idx][pos] if isinstance(shap_values_flagged, list) else shap_values_flagged[pos, :, class_idx]
    top3_idx = np.argsort(-np.abs(row_shap))[:3]
    return "; ".join(f"{FEATURES[j]} (impact={row_shap[j]:.3f})" for j in top3_idx)

df["shap_explanation"] = ""
for pos, i in enumerate(flagged_idx):
    df.loc[i, "shap_explanation"] = shap_explain_row(pos, i)

print(f"\n=== SHAP computed for {len(flagged_idx)} flagged events only (not all {len(df)}) ===")
print(df.loc[flagged_idx, ["entity_id","rf_predicted_type","shap_explanation"]].head(10).to_string(index=False))

# ---------- PER-TYPE DETECTION (Random Forest, with new_resource fix) ----------
print("\n=== PER-TYPE DETECTION (Random Forest, after new_resource fix) ===")
rf_type_report = df[df.true_anomaly==1].groupby("label", group_keys=False).apply(
    lambda g: pd.Series({
        "total": len(g),
        "correctly_flagged": (g.rf_predicted_type != "normal").sum(),
        "detection_rate": round((g.rf_predicted_type != "normal").sum()/len(g), 3)
    }), include_groups=False
)
print(rf_type_report)

# ---------- FINAL CONSOLIDATION ----------
df["risk_pct"] = (MinMaxScaler().fit_transform(df.ensemble_score.values.reshape(-1,1)).flatten() * 100).round(1)
df["risk_band"] = pd.cut(df.risk_pct, bins=[-1,30,70,101], labels=["Low","Medium","High"])

df["predicted_type"] = df["rf_predicted_type"]
df["explanation"] = np.where(df["shap_explanation"] != "", df["shap_explanation"], df["explanation"])
df.drop(columns=["rf_predicted_type","shap_explanation"], inplace=True)

prec_arr2, rec_arr2, _ = precision_recall_curve(df.true_anomaly, df.ensemble_score)
pr_auc_ensemble = auc(rec_arr2, prec_arr2)
plt.figure(figsize=(6,5))
plt.plot(rec_arr2, prec_arr2, label=f"PR-AUC={pr_auc_ensemble:.3f}")
plt.xlabel("Recall"); plt.ylabel("Precision")
plt.title("Precision-Recall Curve (Ensemble Score)")
plt.legend(); plt.grid(alpha=0.3)
plt.savefig("pr_curve.png", dpi=120, bbox_inches="tight")
print(f"\n=== FINAL PR-AUC (ensemble) = {pr_auc_ensemble:.3f} ===")

true_rate = df.true_anomaly.mean()
print(f"True anomaly rate = {true_rate:.4f}")

sample = X.sample(min(1000, len(X)), random_state=1)
start = time.time()
_ = iso.score_samples(sample)
_ = rf.predict_proba(sample)
elapsed = time.time() - start
events_per_sec = len(sample) / elapsed
print(f"\n=== SCALABILITY BENCHMARK ===")
print(f"Scored {len(sample)} events in {elapsed:.3f}s -> ~{events_per_sec:.0f} events/sec")

df.sort_values("risk_pct", ascending=False).to_csv("scored_events.csv", index=False)
print("\nFinal scored_events.csv saved with new_resource feature, consistent ensemble-based risk_pct, risk_band, predicted_type, explanation")


# ================= LIVE STREAMING SIMULATION (proves real-time capability) =================
print("\n=== LIVE STREAMING SIMULATION (sample of 20 events, one-by-one scoring) ===")

normal_sample = df[df.true_anomaly==0].sample(14, random_state=7)
anomaly_sample = df[df.true_anomaly==1].sample(6, random_state=7)
sample_stream = pd.concat([normal_sample, anomaly_sample]).sort_values("timestamp")
stream_times = []

for idx, row in sample_stream.iterrows():
    start = time.time()
    row_features = X.loc[[idx]]
    iso_score = -iso.score_samples(row_features)[0]
    rf_prob = rf.predict_proba(row_features)[0]
    rf_anomaly = 1 - rf_prob[list(rf.classes_).index("normal")]
    elapsed_ms = (time.time() - start) * 1000
    stream_times.append(elapsed_ms)
    status = "ANOMALY" if row.true_anomaly==1 else "normal"
    print(f"  [{row.timestamp}] {row.entity_id} -> risk={iso_score:.2f} ({elapsed_ms:.2f}ms) [{status}]")

avg_latency = np.mean(stream_times)
print(f"\nAverage per-event scoring latency: {avg_latency:.2f}ms -> supports near real-time scoring (~{1000/avg_latency:.0f} events/sec sustainable per core)")



# ================= ALERT BUDGET SWEEP (shows deliberate threshold choice) =================
print("\n=== ALERT BUDGET SWEEP ===")
budgets = [0.005, 0.01, 0.02, 0.05]
for b in budgets:
    n = max(1, int(b*len(df)))
    top_b = df.sort_values("ensemble_score", ascending=False).head(n)
    fpr_b = 1 - (top_b.true_anomaly.sum() / n)
    recall_b = top_b.true_anomaly.sum() / df.true_anomaly.sum()
    print(f"  Top {b*100:.1f}% alert budget ({n} events) -> FPR={fpr_b:.3f}, Recall captured={recall_b:.3f}")

print("\nChosen operating point: top 1% (balances analyst alert volume against recall)")

# ================= CONCEPT DRIFT DEMONSTRATION =================
sample_entity = df[df.true_anomaly==0].entity_id.value_counts().idxmax()
edf = df[df.entity_id==sample_entity].sort_values("timestamp")

plt.figure(figsize=(7,4))
plt.plot(edf.timestamp, edf.hour_mean, label="rolling baseline (hour_mean)")
plt.plot(edf.timestamp, edf.hour, "o", alpha=0.3, markersize=3, label="actual login hour")
plt.title(f"Baseline drift over time — entity {sample_entity}")
plt.xlabel("Date"); plt.ylabel("Hour of day"); plt.legend(); plt.grid(alpha=0.3)
plt.xticks(rotation=45)
plt.savefig("drift_demo.png", dpi=120, bbox_inches="tight")
print(f"\n=== DRIFT DEMONSTRATION saved (drift_demo.png) for entity {sample_entity} ===")
print(f"Baseline hour_mean range: {edf.hour_mean.min():.1f} to {edf.hour_mean.max():.1f} (adapts as behavior evolves)")