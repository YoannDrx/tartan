// Embedded in the standalone review file; no network or application writes.
(() => {
  const { manifest, labels } = JSON.parse(document.getElementById("review-data").textContent);
  const storageKey = "tartan.exercise-guide-review.v1";
  const reviewer = document.getElementById("reviewer");
  const message = document.getElementById("save-state");
  const cards = [...document.querySelectorAll("details[data-key]")];
  const entries = new Map();
  let writable = true;
  let saved = {};
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.schemaVersion !== 1 || !Array.isArray(parsed.entries) || typeof parsed.reviewer !== "string") throw new Error("invalid_review");
      saved = parsed;
    }
  } catch {
    writable = false;
    message.textContent = labels.storageInvalid;
  }
  reviewer.value = typeof saved.reviewer === "string" ? saved.reviewer.slice(0, 120) : "";
  for (const source of manifest.entries) {
    const previous = saved.entries?.find((entry) => entry?.catalogKey === source.catalogKey);
    const status = previous?.guideHash === source.guideHash && Object.hasOwn(labels.statuses, previous.status) ? previous.status : "pending";
    entries.set(source.catalogKey, {
      ...source,
      status,
      notes: typeof previous?.notes === "string" ? previous.notes.slice(0, 5000) : "",
      stale: !!previous && previous.guideHash !== source.guideHash,
    });
  }
  const snapshot = () => ({ ...manifest, reviewer: reviewer.value.trim(), exportedAt: new Date().toISOString(), entries: [...entries.values()] });
  const save = () => {
    if (!writable) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(snapshot()));
      message.textContent = labels.saved;
    } catch {
      writable = false;
      message.textContent = labels.storageFailed;
    }
  };
  const normalize = (value) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("fr");
  const update = () => {
    const query = normalize(document.getElementById("search").value.trim());
    const family = document.getElementById("family").value;
    const status = document.getElementById("status").value;
    let visible = 0;
    for (const card of cards) {
      const entry = entries.get(card.dataset.key);
      card.querySelector("[data-state]").textContent = labels.statuses[entry.status];
      card.hidden = !normalize(card.dataset.search).includes(query) || (!!family && card.dataset.family !== family) || (!!status && entry.status !== status);
      if (!card.hidden) visible++;
    }
    const reviewed = [...entries.values()].filter((entry) => entry.status !== "pending").length;
    document.getElementById("counts").textContent = `${labels.visible} : ${visible} · ${labels.reviewed} : ${reviewed} · ${labels.total} : ${cards.length}`;
  };
  for (const card of cards) {
    const entry = entries.get(card.dataset.key);
    const status = card.querySelector("[data-review-status]");
    const notes = card.querySelector("[data-notes]");
    status.value = entry.status;
    notes.value = entry.notes;
    card.querySelector("[data-stale]").hidden = !entry.stale;
    status.addEventListener("change", () => { entry.status = status.value; entry.stale = false; card.querySelector("[data-stale]").hidden = true; save(); update(); });
    notes.addEventListener("input", () => { entry.notes = notes.value; save(); });
  }
  reviewer.addEventListener("input", save);
  for (const id of ["search", "family", "status"]) document.getElementById(id).addEventListener("input", update);
  document.getElementById("export").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `tartan-guide-reviews-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  update();
})();
