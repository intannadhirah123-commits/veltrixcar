/* =========================================================
   VELTRIX — Inspections (inspections.html)
   ========================================================= */
(function () {
  if (!Layout.init()) return;

  const $ = (id) => document.getElementById(id);
  const T = DateUtil.todayIso();
  const qs = new URLSearchParams(location.search);
  const ITEMS = CHECKLIST.flatMap((g) => g.items);

  let typeFilter = "";
  let checks = {};
  let photos = [];
  let activeInspectionId = null;

  const maps = () => ({
    v: Object.fromEntries(DB.vehicles().map((x) => [x.id, x])),
    c: Object.fromEntries(DB.customers().map((x) => [x.id, x])),
  });

  /* ================= OVERVIEW + RECORDS ================= */
  function renderOverview() {
    const all = DB.inspections();
    const month = T.slice(0, 7);
    const thisMonth = all.filter((i) => i.date.slice(0, 7) === month);
    const vs = DB.vehicles();

    const awaitingOut = DB.bookings().filter(
      (b) => b.status === "Confirmed" && b.pickupDate <= DateUtil.add(T, 1)
    ).length;

    const awaitingIn = DB.bookings().filter(
      (b) => b.status === "Ongoing" && b.returnDate <= T
    ).length;

    $("overview").innerHTML = [
      ["Inspections this month", thisMonth.length, `${all.length} recorded in total`, "bi-clipboard2-data"],
      ["Check-out / check-in", `${thisMonth.filter((i) => i.type === "Check-out").length} / ${thisMonth.filter((i) => i.type === "Check-in").length}`, "This month", "bi-arrow-left-right"],
      ["Damage reported", all.filter((i) => i.result === "Damage reported").length, `${vs.filter((v) => v.status === "Maintenance").length} vehicle(s) in maintenance`, "bi-exclamation-octagon"],
      ["Waiting for inspection", awaitingOut + awaitingIn, `${awaitingOut} pickup(s) · ${awaitingIn} return(s) due`, "bi-hourglass"],
    ].map(([l, v, s, i]) =>
      `<div class="card kpi">
        <div class="kpi-top"><span>${l}</span><i class="bi ${i}"></i></div>
        <div class="kpi-value">${v}</div>
        <div class="kpi-sub">${s}</div>
      </div>`
    ).join("");
  }

  function renderRecords() {
    const { v: vMap } = maps();
    const q = $("search").value.trim().toLowerCase();
    const res = $("fResult").value;

    const list = DB.inspections()
      .filter((i) =>
        (!typeFilter || i.type === typeFilter) &&
        (!res || i.result === res) &&
        (!q || [
          i.id,
          i.bookingId,
          i.inspector,
          vMap[i.vehicleId]?.plate,
          vMap[i.vehicleId]?.model
        ].join(" ").toLowerCase().includes(q))
      )
      .sort((a, b) => b.date.localeCompare(a.date));

    $("recordsBody").innerHTML = list.length
      ? list.slice(0, 50).map((i) => {
          const v = vMap[i.vehicleId];

          return `<tr>
            <td class="mono cell-main">${i.id}</td>
            <td>${UI.statusBadge(i.type)}</td>
            <td>
              ${UI.esc(DB.vehicleName(v))}
              <div class="cell-sub">${v?.plate || "-"}</div>
            </td>
            <td class="mono">
              <a href="index.html#recentBookings">${i.bookingId}</a>
            </td>
            <td class="nowrap">${DateUtil.fmtDateTime(i.date)}</td>
            <td class="num">${Number(i.mileage).toLocaleString()}</td>
            <td>${i.fuel}</td>
            <td>${UI.esc(i.inspector)}</td>
            <td>
              ${UI.statusBadge(i.result)}
              ${i.photos?.length ? ` <i class="bi bi-image muted" title="${i.photos.length} photo(s)"></i>` : ""}
            </td>
            <td class="nowrap">
              <button class="btn btn-xs" data-view="${i.id}">View</button>
              <button class="btn btn-xs" data-receipt="${i.bookingId}" title="View receipt"><i class="bi bi-receipt"></i></button>
            </td>
          </tr>`;
        }).join("")
      : `<tr><td colspan="10" class="table-empty">
          <i class="bi bi-clipboard2-x"></i>
          No inspections match this filter.
        </td></tr>`;

    $("recordsFoot").textContent =
      `${list.length} inspection(s)${list.length > 50 ? " · showing latest 50" : ""}`;
  }

  UI.$$("#typeFilter button").forEach((b) =>
    b.addEventListener("click", () => {
      typeFilter = b.dataset.type;

      UI.$$("#typeFilter button").forEach((x) =>
        x.classList.toggle("active", x === b)
      );

      renderRecords();
    })
  );

  ["search", "fResult"].forEach((id) =>
    $(id).addEventListener("input", renderRecords)
  );

  document.addEventListener("click", (e) => {
    const v = e.target.closest("[data-view]");
    if (v) showInspection(v.dataset.view);
  });

  /* ================= RECEIPT (same receipt as customers.html) ================= */
  let receiptLock = false;

  function openReceipt(bookingId) {
    if (receiptLock) return;            // never open the popup twice
    receiptLock = true;
    setTimeout(() => (receiptLock = false), 800);

    const b = DB.booking(bookingId);
    if (!b) {
      UI.toast("Receipt record could not be found.", "error");
      return;
    }
    showBookingReceipt(b.customerId, b.id);
  }

  // One listener only: table receipt buttons
  document.addEventListener("click", (e) => {
    const r = e.target.closest("[data-receipt]");
    if (r) openReceipt(r.dataset.receipt);
  });

  /* ================= FORM ================= */
  const type = () =>
    document.querySelector('input[name="itype"]:checked').value;

  function fillBookings(preselect) {
    const { v: vMap, c: cMap } = maps();
    const t = type();

    const done = new Set(
      DB.inspections()
        .filter((i) => i.type === t)
        .map((i) => i.bookingId)
    );

    const eligible = DB.bookings()
      .filter((b) =>
        (t === "Check-out"
          ? b.status === "Confirmed"
          : b.status === "Ongoing") &&
        !done.has(b.id)
      )
      .sort((a, b) =>
        (t === "Check-out"
          ? a.pickupDate.localeCompare(b.pickupDate)
          : a.returnDate.localeCompare(b.returnDate))
      );

    $("iBooking").innerHTML = eligible.length
      ? '<option value="">Select a booking</option>' +
        eligible.map((b) => {
          const v = vMap[b.vehicleId];
          const c = cMap[b.customerId];

          const d = t === "Check-out"
            ? "pickup " + DateUtil.fmtShort(b.pickupDate)
            : "return " + DateUtil.fmtShort(b.returnDate);

          return `<option value="${b.id}">
            ${b.id} · ${v?.plate} ${v?.model} ·
            ${UI.esc(c?.name || "")} · ${d}
          </option>`;
        }).join("")
      : `<option value="">
          ${t === "Check-out"
            ? "No confirmed bookings waiting for check-out"
            : "No vehicles currently out on rent"}
        </option>`;

    if (preselect && eligible.some((b) => b.id === preselect)) {
      $("iBooking").value = preselect;
    }

    onBookingChange();
  }

  function lastReading(booking) {
    const v = DB.vehicle(booking.vehicleId);

    const out = DB.inspections().find(
      (i) => i.bookingId === booking.id && i.type === "Check-out"
    );

    return Math.max(v ? v.mileage : 0, out ? out.mileage : 0);
  }

  function onBookingChange() {
    const b = DB.booking($("iBooking").value);

    UI.fieldError($("iBooking"), "");

    if (!b) {
      $("iBookingHint").textContent = "";
      $("iMileageHint").textContent = "";
      updatePreview();
      return;
    }

    const v = DB.vehicle(b.vehicleId);
    const c = DB.customer(b.customerId);

    $("iBookingHint").innerHTML =
      `${UI.esc(c?.name || "")} · ${UI.esc(DB.vehicleName(v))} (${v?.plate}) · ${DateUtil.fmt(b.pickupDate)} → ${DateUtil.fmt(b.returnDate)}`;

    const km = lastReading(b);

    $("iMileageHint").textContent =
      `Last recorded: ${km.toLocaleString()} km`;

    if (!$("iMileage").value || Number($("iMileage").value) < km) {
      $("iMileage").value = type() === "Check-out" ? km : "";
    }

    updatePreview();
  }

  function renderChecklist() {
    $("checklist").innerHTML = CHECKLIST.map((g) => `
      <div class="checklist-group">
        <h4>${g.group}</h4>

        ${g.items.map(([k, label]) => `
          <div class="check-row ${checks[k] === "ok" ? "is-ok" : checks[k] === "issue" ? "is-issue" : ""}">
            <span>${label}</span>

            <div class="ok-issue" role="group" aria-label="${label}">
              <button type="button"
                data-k="${k}" data-v="ok"
                class="${checks[k] === "ok" ? "on-ok" : ""}"
                aria-pressed="${checks[k] === "ok"}">
                <i class="bi bi-check-lg"></i> OK
              </button>

              <button type="button"
                data-k="${k}" data-v="issue"
                class="${checks[k] === "issue" ? "on-issue" : ""}"
                aria-pressed="${checks[k] === "issue"}">
                <i class="bi bi-exclamation-lg"></i> Issue
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    `).join("");

    const done = Object.keys(checks).length;
    const issues = Object.values(checks).filter((x) => x === "issue").length;

    $("progressBar").style.width =
      (done / ITEMS.length) * 100 + "%";

    $("progressText").innerHTML =
      `${done} of ${ITEMS.length} items checked${issues
        ? ` · <b style="color:var(--red)">${issues} issue(s)</b>`
        : ""}`;

    updatePreview();
  }

  $("checklist").addEventListener("click", (e) => {
    const b = e.target.closest("[data-k]");
    if (!b) return;

    checks[b.dataset.k] =
      checks[b.dataset.k] === b.dataset.v ? undefined : b.dataset.v;

    if (!checks[b.dataset.k]) delete checks[b.dataset.k];

    $("checklistErr").classList.remove("show");
    renderChecklist();
  });

  $("allOk").addEventListener("click", () => {
    ITEMS.forEach(([k]) => {
      if (!checks[k]) checks[k] = "ok";
    });

    $("checklistErr").classList.remove("show");
    renderChecklist();
  });

  function updatePreview() {
    const b = DB.booking($("iBooking").value);
    const v = b && DB.vehicle(b.vehicleId);
    const issues = Object.values(checks).includes("issue");
    const box = $("statusPreview");

    if (!v) {
      box.className = "alert alert-info mt-16 small";
      box.innerHTML =
        '<i class="bi bi-arrow-repeat"></i><div>Vehicle status will update automatically when you save.</div>';
      return;
    }

    if (type() === "Check-out") {
      box.className = "alert alert-info mt-16 small";

      box.innerHTML =
        `<i class="bi bi-arrow-repeat"></i>
        <div>On save: <b>${v.plate}</b> → <b>Rented</b>,
        booking ${b.id} → <b>Ongoing</b>.
        ${issues ? " Existing issues will be noted on the handover record." : ""}
        </div>`;
    } else {
      box.className =
        "alert mt-16 small " + (issues ? "alert-warn" : "alert-success");

      box.innerHTML =
        `<i class="bi bi-arrow-repeat"></i>
        <div>On save: <b>${v.plate}</b> → 
        <b>${issues ? "Maintenance" : "Available"}</b>,
        booking ${b.id} → <b>Completed</b>.</div>`;
    }
  }

  document.querySelectorAll('input[name="itype"]').forEach((r) =>
    r.addEventListener("change", () => {
      $("iMileage").value = "";
      fillBookings();
    })
  );

  $("iBooking").addEventListener("change", onBookingChange);

  ["iDate", "iInspector", "iMileage", "iFuel", "iNotes"].forEach((id) =>
    $(id).addEventListener("input", () => UI.fieldError($(id), ""))
  );

  /* ================= PHOTOS ================= */
  function compress(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => reject(new Error("read"));

      reader.onload = () => {
        const img = new Image();

        img.onerror = () => reject(new Error("decode"));

        img.onload = () => {
          const scale = Math.min(
            1,
            800 / Math.max(img.width, img.height)
          );

          const canvas = document.createElement("canvas");

          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);

          canvas.getContext("2d").drawImage(
            img, 0, 0, canvas.width, canvas.height
          );

          resolve(canvas.toDataURL("image/jpeg", 0.7));
        };

        img.src = reader.result;
      };

      reader.readAsDataURL(file);
    });
  }

  async function addFiles(files) {
    const err = $("photoErr");
    err.classList.remove("show");

    const problems = [];

    for (const f of files) {
      if (photos.length >= 4) {
        problems.push("Only 4 photos can be attached.");
        break;
      }

      if (!f.type.startsWith("image/")) {
        problems.push(`${f.name} is not an image.`);
        continue;
      }

      if (f.size > 5 * 1024 * 1024) {
        problems.push(`${f.name} is larger than 5 MB.`);
        continue;
      }

      try {
        photos.push(await compress(f));
      } catch (e) {
        problems.push(`${f.name} could not be read.`);
      }
    }

    if (problems.length) {
      err.innerHTML =
        `<i class="bi bi-exclamation-circle"></i>${UI.esc(problems.join(" "))}`;
      err.classList.add("show");
    }

    renderThumbs();
  }

  function renderThumbs() {
    $("thumbs").innerHTML = photos.map((p, i) => `
      <div class="thumb">
        <img src="${p}" alt="Damage photo ${i + 1}">
        <button type="button" data-rm="${i}" aria-label="Remove photo ${i + 1}">
          <i class="bi bi-x"></i>
        </button>
      </div>
    `).join("");
  }

  $("iPhotos").addEventListener("change", (e) => {
    addFiles([...e.target.files]);
    e.target.value = "";
  });

  $("thumbs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-rm]");

    if (b) {
      photos.splice(Number(b.dataset.rm), 1);
      renderThumbs();
    }
  });

  const dz = $("dropZone");

  ["dragenter", "dragover"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.add("drag");
    })
  );

  ["dragleave", "drop"].forEach((ev) =>
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      dz.classList.remove("drag");
    })
  );

  dz.addEventListener("drop", (e) =>
    addFiles([...e.dataTransfer.files])
  );

  /* ================= RESET / DEFAULTS ================= */
  function setDefaults() {
    const d = new Date();
    d.setSeconds(0, 0);

    $("iDate").value =
      DateUtil.iso(d) + "T" +
      String(d.getHours()).padStart(2, "0") + ":" +
      String(d.getMinutes()).padStart(2, "0");

    $("iInspector").value = Layout.session.fullname;

    checks = {};
    photos = [];

    renderChecklist();
    renderThumbs();
  }

  $("resetBtn").addEventListener("click", () =>
    setTimeout(() => {
      UI.clearErrors($("inspForm"));
      $("formAlert").classList.add("hidden");
      setDefaults();
      fillBookings();
    }, 0)
  );

  /* ================= SUBMIT ================= */
  $("inspForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const form = e.target;

    UI.clearErrors(form);
    $("checklistErr").classList.remove("show");

    const alertBox = $("formAlert");
    alertBox.classList.add("hidden");

    const t = type();
    const b = DB.booking($("iBooking").value);

    let ok = true;

    const err = (el, m) => {
      ok = false;
      UI.fieldError(el, m);
    };

    if (!b) {
      err(
        $("iBooking"),
        t === "Check-out"
          ? "Select a confirmed booking to check out."
          : "Select an ongoing booking to check in."
      );
    }

    const dt = $("iDate").value;

    if (!dt) {
      err($("iDate"), "Select the inspection date and time.");
    } else if (new Date(dt) > new Date(Date.now() + 15 * 60000)) {
      err($("iDate"), "Inspection time cannot be in the future.");
    } else if (b && t === "Check-in") {
      const out = DB.inspections().find(
        (i) => i.bookingId === b.id && i.type === "Check-out"
      );

      if (out && dt < out.date.slice(0, 16)) {
        err(
          $("iDate"),
          "Check-in cannot be earlier than the check-out inspection."
        );
      }
    }

    if ($("iInspector").value.trim().length < 3) {
      err($("iInspector"), "Enter the inspector's name.");
    }

    const km = Number($("iMileage").value);

    if ($("iMileage").value === "") {
      err($("iMileage"), "Enter the odometer reading.");
    } else if (b) {
      const last = lastReading(b);

      if (km < last) {
        err(
          $("iMileage"),
          `Reading cannot be lower than the last record (${last.toLocaleString()} km).`
        );
      } else if (km - last > 6000) {
        err(
          $("iMileage"),
          `That is ${(km - last).toLocaleString()} km since the last record. Please re-check the odometer.`
        );
      }
    }

    if (!$("iFuel").value) {
      err($("iFuel"), "Select the fuel level.");
    }

    const missing = ITEMS.filter(([k]) => !checks[k]).length;

    if (missing) {
      ok = false;

      $("checklistErr").innerHTML =
        `<i class="bi bi-exclamation-circle"></i>${missing} checklist item(s) not checked yet.`;

      $("checklistErr").classList.add("show");
    }

    const issues = ITEMS
      .filter(([k]) => checks[k] === "issue")
      .map(([, l]) => l);

    if (issues.length && $("iNotes").value.trim().length < 10) {
      err(
        $("iNotes"),
        "Describe the issue(s) found (at least 10 characters)."
      );
    }

    if (!ok) {
      alertBox.innerHTML =
        '<i class="bi bi-x-circle"></i><div>The inspection was not saved. Please complete the highlighted fields.</div>';

      alertBox.classList.remove("hidden");
      alertBox.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });

      return;
    }

    const all = DB.inspections();

    const rec = {
      id: DB.nextId(all, "INS-", 1, 4),
      bookingId: b.id,
      vehicleId: b.vehicleId,
      type: t,
      date: dt + ":00",
      inspector: $("iInspector").value.trim(),
      mileage: km,
      fuel: $("iFuel").value,
      checklist: { ...checks },
      notes: $("iNotes").value.trim(),
      photos: [...photos],
      result: issues.length ? "Damage reported" : "Pass",
    };

    all.push(rec);

    if (!DB.save("inspections", all)) {
      all.pop();
      return;
    }

    // Automatic vehicle status updates
    const newVehicleStatus =
      t === "Check-out"
        ? "Rented"
        : issues.length
          ? "Maintenance"
          : "Available";

    DB.save(
      "vehicles",
      DB.vehicles().map((v) =>
        v.id === b.vehicleId
          ? { ...v, mileage: km, status: newVehicleStatus }
          : v
      )
    );

    DB.save(
      "bookings",
      DB.bookings().map((x) =>
        x.id === b.id
          ? {
              ...x,
              status: t === "Check-out" ? "Ongoing" : "Completed",
              updatedAt: new Date().toISOString()
            }
          : x
      )
    );

    if (
      t === "Check-out" &&
      !DB.payments().some((p) => p.bookingId === b.id)
    ) {
      const pays = DB.payments();

      pays.push({
        id: DB.nextId(pays, "PAY-", 5001),
        bookingId: b.id,
        amount: b.total,
        method: "Cash",
        date: T,
        status: "Paid"
      });

      DB.save("payments", pays);
    }

    const v = DB.vehicle(b.vehicleId);

    let msg = `${rec.id} saved. ${v.plate} is now ${newVehicleStatus}.`;

    if (t === "Check-in") {
      const out = DB.inspections().find(
        (i) => i.bookingId === b.id && i.type === "Check-out"
      );

      const lvl = ["Empty", "1/4", "1/2", "3/4", "Full"];

      if (out && lvl.indexOf(rec.fuel) < lvl.indexOf(out.fuel)) {
        msg += ` Fuel is lower than at pickup (${out.fuel} → ${rec.fuel}); add a refuel charge.`;
      }
    }

    UI.toast(msg, issues.length ? "warn" : "success");

    form.reset();
    setDefaults();
    fillBookings();

    renderOverview();
    renderRecords();

    $("hVehicle").value = b.vehicleId;
    renderHistory();

    Layout.renderSidebar("inspections.html");

    showInspection(rec.id);
  });

  /* ================= VIEW INSPECTION ================= */
  function showInspection(id) {
    const i = DB.inspections().find((x) => x.id === id);

    if (!i) {
      UI.toast(`Inspection ${id} not found.`, "error");
      return;
    }

    activeInspectionId = id;

    const v = DB.vehicle(i.vehicleId);
    const b = DB.booking(i.bookingId);
    const c = b && DB.customer(b.customerId);

    $("ivTitle").innerHTML =
      `${i.type} inspection <span class="mono">${i.id}</span>`;

    $("ivSub").textContent =
      `${DateUtil.fmtDateTime(i.date)} · by ${i.inspector}`;

    $("ivBody").innerHTML = `
      <dl class="detail-grid">
        <div>
          <dt>Vehicle</dt>
          <dd>${UI.esc(DB.vehicleName(v))} · ${v?.plate || "-"}</dd>
        </div>

        <div>
          <dt>Booking</dt>
          <dd class="mono">${i.bookingId}</dd>
        </div>

        <div>
          <dt>Customer</dt>
          <dd>${UI.esc(c?.name || "-")}</dd>
        </div>

        <div>
          <dt>Result</dt>
          <dd>${UI.statusBadge(i.result)}</dd>
        </div>

        <div>
          <dt>Odometer</dt>
          <dd>${Number(i.mileage).toLocaleString()} km</dd>
        </div>

        <div>
          <dt>Fuel level</dt>
          <dd>${i.fuel}</dd>
        </div>
      </dl>

      <div class="grid grid-3 mt-16" style="gap:10px">
        ${CHECKLIST.map((g) => `
          <div class="checklist-group" style="margin:0">
            <h4>${g.group}</h4>

            ${g.items.map(([k, l]) => `
              <div class="check-row ${i.checklist[k] === "issue" ? "is-issue" : ""}">
                <span class="small">${l}</span>

                ${i.checklist[k] === "issue"
                  ? '<span class="badge b-red">Issue</span>'
                  : '<span class="badge b-green">OK</span>'}
              </div>
            `).join("")}
          </div>
        `).join("")}
      </div>

      ${i.notes
        ? `<h3 class="mt-16">Notes</h3><p class="mt-8">${UI.esc(i.notes)}</p>`
        : ""}

      ${i.photos?.length
        ? `<h3 class="mt-16">Photos</h3>
          <div class="thumbs">
            ${i.photos.map((p, n) => `
              <a href="#" class="thumb" data-photo="${n}"
                style="width:120px;height:90px">
                <img src="${p}" alt="Damage photo ${n + 1}">
              </a>
            `).join("")}
          </div>`
        : ""}
    `;

    UI.$$("[data-photo]", $("ivBody")).forEach((a) =>
      a.addEventListener("click", (e) => {
        e.preventDefault();
        $("photoBig").src = i.photos[a.dataset.photo];
        UI.openModal("photoModal");
      })
    );

    UI.openModal("viewModal");
  }

  /* ================= ONE-PAGE A4 PRINT ================= */

  function printInspection() {
    const i = DB.inspections().find(
      (x) => x.id === activeInspectionId
    );

    if (!i) {
      UI.toast("Please open an inspection report first.", "error");
      return;
    }

    const v = DB.vehicle(i.vehicleId);
    const b = DB.booking(i.bookingId);
    const c = b && DB.customer(b.customerId);

    // Escape text before placing it inside the print document.
    const safe = (value) =>
      String(value ?? "-").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[char]);

    const checklistHTML = CHECKLIST.map((g) => `
      <section class="check-group">
        <h3>${safe(g.group)}</h3>

        ${g.items.map(([k, label]) => {
          const isIssue = i.checklist?.[k] === "issue";

          return `
            <div class="check-item">
              <span>${safe(label)}</span>
              <strong class="${isIssue ? "issue" : "ok"}">
                ${isIssue ? "ISSUE" : "OK"}
              </strong>
            </div>
          `;
        }).join("")}
      </section>
    `).join("");

    const photosHTML = (i.photos || []).length
      ? `
        <section class="photos-section">
          <h3>Inspection Photos</h3>
          <div class="photo-list">
            ${(i.photos || []).slice(0, 4).map((p) => `
              <img src="${p}" alt="Inspection photo">
            `).join("")}
          </div>
        </section>
      `
      : "";

    const win = window.open(
      "",
      "_blank",
      "width=950,height=750"
    );

    if (!win) {
      UI.toast("Please allow pop-ups to print the report.", "error");
      return;
    }

    const reportHTML = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">

        <title>Inspection Report - ${safe(i.id)}</title>

        <style>
          @page {
            size: A4 portrait;
            margin: 7mm;
          }

          * {
            box-sizing: border-box;
          }

          html, body {
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            color: #1e293b;
            background: #fff;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          body {
            font-size: 9px;
            line-height: 1.3;
          }

          .sheet {
            width: 100%;
            max-width: 196mm;
            margin: 0 auto;
          }

          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 8px;
            border-bottom: 2px solid #1e4d3b;
            margin-bottom: 9px;
          }

          .brand {
            font-size: 21px;
            font-weight: 800;
            letter-spacing: 1.5px;
            color: #1e4d3b;
          }

          .brand-sub {
            font-size: 8px;
            color: #64748b;
            margin-top: 2px;
            letter-spacing: 1px;
          }

          .report-heading {
            text-align: right;
          }

          .report-heading h1 {
            font-size: 14px;
            margin: 0 0 4px;
            text-transform: uppercase;
          }

          .report-id {
            font-size: 10px;
            font-weight: bold;
            color: #1e4d3b;
          }

          .report-type {
            display: inline-block;
            margin-top: 4px;
            padding: 3px 7px;
            border-radius: 4px;
            background: #e8f1ec;
            color: #1e4d3b;
            font-weight: bold;
            font-size: 8px;
          }

          .section-title {
            font-size: 10px;
            font-weight: bold;
            color: #1e4d3b;
            text-transform: uppercase;
            border-bottom: 1px solid #dbe3df;
            padding-bottom: 4px;
            margin: 9px 0 6px;
          }

          .info-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px 12px;
          }

          .info-box {
            min-width: 0;
            padding: 5px 7px;
            background: #f5f7f5;
            border: 1px solid #e4e9e5;
            border-radius: 4px;
          }

          .info-label {
            color: #64748b;
            font-size: 7px;
            text-transform: uppercase;
            margin-bottom: 2px;
          }

          .info-value {
            font-size: 9px;
            font-weight: bold;
            overflow-wrap: anywhere;
          }

          .result-pass {
            color: #15803d;
          }

          .result-issue {
            color: #b91c1c;
          }

          .checklist-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            align-items: start;
          }

          .check-group {
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            overflow: hidden;
            break-inside: avoid;
          }

          .check-group h3 {
            font-size: 8px;
            color: #1e4d3b;
            background: #edf3ef;
            padding: 5px 6px;
            margin: 0;
          }

          .check-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 4px;
            padding: 3px 5px;
            border-top: 1px solid #edf0f2;
            font-size: 7.5px;
          }

          .check-item span {
            overflow-wrap: anywhere;
          }

          .check-item strong {
            font-size: 6.5px;
            min-width: 30px;
            text-align: center;
            padding: 2px 3px;
            border-radius: 3px;
          }

          .ok {
            color: #166534;
            background: #dcfce7;
          }

          .issue {
            color: #991b1b;
            background: #fee2e2;
          }

          .notes {
            border: 1px solid #e2e8f0;
            border-radius: 4px;
            padding: 6px 8px;
            font-size: 8px;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
          }

          .photo-list {
            display: flex;
            gap: 7px;
            flex-wrap: wrap;
          }

          .photo-list img {
            width: 35mm;
            height: 23mm;
            object-fit: cover;
            border: 1px solid #dbe3df;
            border-radius: 3px;
          }

          .footer {
            margin-top: 9px;
            padding-top: 5px;
            border-top: 1px solid #cbd5e1;
            display: flex;
            justify-content: space-between;
            font-size: 7px;
            color: #64748b;
          }

          @media screen {
            body {
              background: #e5e7eb;
              padding: 15px;
            }

            .sheet {
              background: #fff;
              padding: 8mm;
              min-height: 283mm;
              box-shadow: 0 2px 12px rgba(0,0,0,.12);
            }
          }

          @media print {
            html, body {
              width: 100%;
              margin: 0;
              padding: 0;
            }

            .sheet {
              width: 100%;
              max-width: none;
              margin: 0;
              padding: 0;
            }

            .header,
            .info-box,
            .check-group,
            .notes,
            .photos-section {
              break-inside: avoid;
              page-break-inside: avoid;
            }

            .section-title {
              break-after: avoid;
              page-break-after: avoid;
            }
          }
        </style>
      </head>

      <body>
        <main class="sheet">

          <header class="header">
            <div>
              <div class="brand">VELTRIX</div>
              <div class="brand-sub">CAR RENTAL MANAGEMENT SYSTEM</div>
            </div>

            <div class="report-heading">
              <h1>Vehicle Inspection Report</h1>
              <div class="report-id">${safe(i.id)}</div>
              <div class="report-type">${safe(i.type)}</div>
            </div>
          </header>

          <div class="section-title">Inspection Information</div>

          <div class="info-grid">
            <div class="info-box">
              <div class="info-label">Inspection Date</div>
              <div class="info-value">${safe(DateUtil.fmtDateTime(i.date))}</div>
            </div>

            <div class="info-box">
              <div class="info-label">Inspector</div>
              <div class="info-value">${safe(i.inspector)}</div>
            </div>

            <div class="info-box">
              <div class="info-label">Inspection Result</div>
              <div class="info-value ${i.result === "Pass" ? "result-pass" : "result-issue"}">
                ${safe(i.result)}
              </div>
            </div>

            <div class="info-box">
              <div class="info-label">Customer</div>
              <div class="info-value">${safe(c?.name || "-")}</div>
            </div>

            <div class="info-box">
              <div class="info-label">Booking ID</div>
              <div class="info-value">${safe(i.bookingId)}</div>
            </div>

            <div class="info-box">
              <div class="info-label">Vehicle</div>
              <div class="info-value">${safe(DB.vehicleName(v))}</div>
            </div>

            <div class="info-box">
              <div class="info-label">Registration Number</div>
              <div class="info-value">${safe(v?.plate || "-")}</div>
            </div>

            <div class="info-box">
              <div class="info-label">Odometer Reading</div>
              <div class="info-value">${Number(i.mileage).toLocaleString()} km</div>
            </div>

            <div class="info-box">
              <div class="info-label">Fuel Level</div>
              <div class="info-value">${safe(i.fuel)}</div>
            </div>
          </div>

          <div class="section-title">Vehicle Inspection Checklist</div>

          <div class="checklist-grid">
            ${checklistHTML}
          </div>

          ${i.notes ? `
            <div class="section-title">Inspection Notes</div>
            <div class="notes">${safe(i.notes)}</div>
          ` : ""}

          ${photosHTML}

          <footer class="footer">
            <span>VELTRIX — Vehicle Inspection Record</span>
            <span>Generated: ${safe(new Date().toLocaleString())}</span>
          </footer>

        </main>

        <script>
          window.onload = function () {
            const images = Array.from(document.images);

            Promise.all(
              images.map((img) => {
                if (img.complete) return Promise.resolve();

                return new Promise((resolve) => {
                  img.onload = resolve;
                  img.onerror = resolve;
                });
              })
            ).then(() => {
              setTimeout(() => {
                window.focus();
                window.print();
              }, 300);
            });
          };

          window.onafterprint = function () {
            window.close();
          };
        <\/script>
      </body>
      </html>
    `;

    win.document.open();
    win.document.write(reportHTML);
    win.document.close();
  }

  // Print button
  const printBtn = $("printInspectionBtn");

  if (printBtn) {
    printBtn.addEventListener("click", printInspection);
  }

  // Receipt button (inside the inspection modal)
  const receiptBtn = $("receiptInspectionBtn");

  if (receiptBtn) {
    receiptBtn.addEventListener("click", () => {
      const i = DB.inspections().find((x) => x.id === activeInspectionId);
      if (i) openReceipt(i.bookingId);
    });
  }

  /* ================= HISTORY ================= */
  function fillHistoryVehicles(pre) {
    $("hVehicle").innerHTML = DB.vehicles().map((v) =>
      `<option value="${v.id}">
        ${v.plate} · ${v.brand} ${v.model} ${UI.esc(v.variant)}
      </option>`
    ).join("");

    if (pre) {
      $("hVehicle").value = pre;
    } else {
      const m = DB.vehicles().find(
        (v) => v.status === "Maintenance"
      );

      if (m) $("hVehicle").value = m.id;
    }
  }

  function renderHistory() {
    const v = DB.vehicle($("hVehicle").value);

    if (!v) {
      $("hTimeline").innerHTML = "";
      return;
    }

    const list = DB.inspections()
      .filter((i) => i.vehicleId === v.id)
      .sort((a, b) => b.date.localeCompare(a.date));

    $("hStatus").innerHTML = UI.statusBadge(v.status);

    $("hActions").innerHTML =
      v.status === "Maintenance"
        ? `<button class="btn btn-sm btn-primary" id="repaired">
            <i class="bi bi-wrench-adjustable"></i>
            Mark repaired &amp; available
          </button>`
        : "";

    const damage = list.filter(
      (i) => i.result === "Damage reported"
    );

    $("hSummary").innerHTML = `
      <div class="card car-frame">${UI.carVisual(v, "lg")}</div>

      <dl class="detail-grid mt-16">
        <div><dt>Inspections</dt><dd>${list.length}</dd></div>
        <div><dt>Damage reports</dt><dd>${damage.length}</dd></div>
        <div><dt>Current odometer</dt><dd>${v.mileage.toLocaleString()} km</dd></div>
        <div><dt>Last inspection</dt><dd>${list[0] ? DateUtil.fmt(list[0].date) : "-"}</dd></div>
      </dl>
    `;

    $("hTimeline").innerHTML = list.length
      ? list.map((i) => `
          <li class="${i.result === "Damage reported" ? "issue" : ""}">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <b>${i.type}</b>
              ${UI.statusBadge(i.result)}
              <span class="small muted">${DateUtil.fmtDateTime(i.date)}</span>
            </div>

            <div class="small muted">
              ${i.id} · Booking ${i.bookingId} ·
              ${Number(i.mileage).toLocaleString()} km ·
              Fuel ${i.fuel} · ${UI.esc(i.inspector)}
            </div>

            ${i.notes
              ? `<div class="small mt-8">${UI.esc(i.notes)}</div>`
              : ""}

            <button class="btn btn-xs mt-8" data-view="${i.id}">
              Open report
            </button>
          </li>
        `).join("")
      : '<li class="muted">No inspections recorded for this vehicle yet.</li>';

    const r = $("repaired");

    if (r) {
      r.onclick = async () => {
        const ok = await UI.confirm({
          title: `Return ${v.plate} to service?`,
          message: "Confirm the workshop repair is complete. The vehicle will be set to Available and can be booked again.",
          okText: "Mark available"
        });

        if (!ok) return;

        DB.save(
          "vehicles",
          DB.vehicles().map((x) =>
            x.id === v.id
              ? {
                  ...x,
                  status: "Available",
                  notes: (
                    (x.notes ? x.notes + " " : "") +
                    `Repaired ${DateUtil.fmt(T)}.`
                  ).trim()
                }
              : x
          )
        );

        UI.toast(`${v.plate} is back in service.`);

        renderHistory();
        renderOverview();
      };
    }
  }

  $("hVehicle").addEventListener("change", renderHistory);

  /* ================= INIT ================= */
  if (qs.get("type") === "Check-in") {
    document.querySelector(
      'input[name="itype"][value="Check-in"]'
    ).checked = true;
  }

  setDefaults();
  fillBookings(qs.get("booking"));
  renderOverview();
  renderRecords();
  fillHistoryVehicles(qs.get("vehicle"));
  renderHistory();

  if (qs.get("inspection")) {
    showInspection(qs.get("inspection"));
  }

  if (location.hash) {
    setTimeout(() => {
      const el = document.querySelector(location.hash);

      if (el) {
        el.scrollIntoView({
          behavior: "smooth"
        });
      }
    }, 100);
  }

})();