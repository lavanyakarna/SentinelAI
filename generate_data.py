import numpy as np, pandas as pd, random
from faker import Faker
fake = Faker(); np.random.seed(42); random.seed(42)

N_ENTITIES = 120
N_DAYS = 30
rows = []
entities = [(f"E{str(i).zfill(4)}", random.choice(["user","service_account","edge_device"])) for i in range(N_ENTITIES)]
resources = [f"res_{i}" for i in range(40)]
auth_methods = ["password","token","certificate","biometric"]
countries = ["India","USA","Germany","Singapore","UK","Brazil","Japan"]

profiles = {}
for eid, etype in entities:
    profiles[eid] = {
        "geo": (float(fake.latitude()), float(fake.longitude())),
        "hour": random.randint(8,18),
        "res_set": random.sample(resources, k=random.randint(2,6)),
        "auth": random.choice(auth_methods),
        "device_fp": fake.mac_address(),
        "country": random.choice(countries),
    }

def normal_event(eid, etype, ts):
    p = profiles[eid]
    return dict(entity_id=eid, entity_type=etype, timestamp=ts,
        source_ip=fake.ipv4(), geo_lat=p["geo"][0]+np.random.normal(0,0.01), geo_lon=p["geo"][1]+np.random.normal(0,0.01),
        resource_accessed=random.choice(p["res_set"]), auth_method=p["auth"],
        session_duration=max(1,np.random.normal(300,60)), command_sequence=random.randint(1,5),
        device_fingerprint=p["device_fp"], country=p["country"],
        failed_attempts=random.choice([0,0,0,1]), label="normal")

anomaly_types = ["brute_force","impossible_travel","credential_stuffing","lateral_movement","device_spoofing","low_and_slow","insider_drift"]

def anomaly_event(eid, etype, ts, kind):
    p = profiles[eid]
    base = normal_event(eid, etype, ts); base["label"] = kind
    if kind == "brute_force":
        base.update(auth_method="password", command_sequence=1, session_duration=2, failed_attempts=random.randint(5,15))
    elif kind == "impossible_travel":
        base.update(geo_lat=p["geo"][0]+random.choice([40,-40]), geo_lon=p["geo"][1]+random.choice([60,-60]),
                    country=random.choice([c for c in countries if c != p["country"]]))
    elif kind == "credential_stuffing":
        base.update(source_ip=fake.ipv4(), auth_method="password", session_duration=2, failed_attempts=random.randint(3,10))
    elif kind == "lateral_movement":
        base.update(resource_accessed=random.choice(resources))
    elif kind == "device_spoofing":
        base.update(device_fingerprint=fake.mac_address())
    elif kind == "low_and_slow":
        base.update(timestamp=ts.replace(hour=random.choice([1,2,3,4])), session_duration=np.random.normal(30,5))
    elif kind == "insider_drift":
        base.update(resource_accessed=random.choice(resources), command_sequence=random.randint(5,10))
    return base

for day in range(N_DAYS):
    for eid, etype in entities:
        p = profiles[eid]
        n_events = np.random.poisson(4)
        for _ in range(n_events):
            ts = pd.Timestamp("2026-06-01") + pd.Timedelta(days=day, hours=p["hour"]+np.random.normal(0,1))
            if random.random() < 0.015:
                rows.append(anomaly_event(eid, etype, ts, random.choice(anomaly_types)))
            else:
                rows.append(normal_event(eid, etype, ts))

df = pd.DataFrame(rows).sort_values("timestamp").reset_index(drop=True)
df.to_csv("access_logs.csv", index=False)
print(df.shape, df.label.value_counts())