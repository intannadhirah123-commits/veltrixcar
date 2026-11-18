/* =========================================================
   VELTRIX — Customers (customers.html)
   Customer Management, Payment Method & Booking History
   ========================================================= */

/* =========================================================
   VELTRIX — CUSTOMERS
   One customer = one new booking = one vehicle = one receipt
   ========================================================= */

(function () {
  if (!Layout.init()) return;

  const $ = (id) => document.getElementById(id);
  const T = DateUtil.todayIso();

  let mode = localStorage.getItem("vx_customer_view") || "table";

  /* =====================================================
     HELPERS
  ====================================================== */

  const esc = (value) => UI.esc(String(value ?? ""));

  function paymentFor(bookingId) {
    return DB.payments().find(p => p.bookingId === bookingId) || null;
  }

  function vehicleFor(bookingId) {
    const b = DB.booking(bookingId);
    return b ? DB.vehicle(b.vehicleId) : null;
  }

  function vehicleLabel(v) {
    if (!v) return "Vehicle unavailable";

    return `${v.brand} ${v.model}${v.variant ? " " + v.variant : ""} (${v.plate})`;
  }

  function money(value) {
    return "RM " + Number(value || 0).toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function latestBooking(customerId) {
    const list = DB.bookings()
      .filter(b => b.customerId === customerId)
      .sort((a, b) => b.pickupDate.localeCompare(a.pickupDate));

    return list[0] || null;
  }

  function rows() {
    const vehicles = Object.fromEntries(
      DB.vehicles().map(v => [v.id, v])
    );

    return DB.customers().map(c => {
      const stats = DB.customerStats(c.id);
      const booking = latestBooking(c.id);

      return {
        c,
        stats,
        booking,
        vehicle: booking ? vehicles[booking.vehicleId] : null,
        payment: booking ? paymentFor(booking.id) : null
      };
    });
  }

  /* =====================================================
     SUMMARY
  ====================================================== */

  function renderSummary(all) {
    const totalSpend = all.reduce((sum, r) => sum + r.stats.spend, 0);

    $("summary").innerHTML = [
      [
        "Total customers",
        all.length,
        "Registered customers",
        "bi-people"
      ],
      [
        "Total bookings",
        all.reduce((sum, r) => sum + r.stats.count, 0),
        "Excluding cancelled bookings",
        "bi-car-front"
      ],
      [
        "Active customers",
        all.filter(r => r.stats.status === "Active").length,
        "Recent rental activity",
        "bi-person-check"
      ],
      [
        "Total rental revenue",
        UI.money0(totalSpend),
        "From existing bookings",
        "bi-wallet2"
      ]
    ].map(([label, value, sub, icon]) => `
      <div class="card kpi">
        <div class="kpi-top">
          <span>${label}</span>
          <i class="bi ${icon}"></i>
        </div>
        <div class="kpi-value">${value}</div>
        <div class="kpi-sub">${sub}</div>
      </div>
    `).join("");
  }

  /* =====================================================
     FILTER AND SORT
  ====================================================== */

  function getFilteredRows(all) {
    const q = $("search").value.trim().toLowerCase();
    const status = $("fStatus").value;
    const sort = $("sortBy").value;

    let list = all.filter(r => {
      const searchText = [
        r.c.name,
        r.c.email,
        r.c.phone,
        r.c.city,
        r.booking?.id || "",
        r.vehicle?.model || "",
        r.vehicle?.plate || ""
      ].join(" ").toLowerCase();

      return (!status || r.stats.status === status) &&
        (!q || searchText.includes(q));
    });

    const sorters = {
      spend: (a, b) => b.stats.spend - a.stats.spend,
      bookings: (a, b) => b.stats.count - a.stats.count,
      recent: (a, b) =>
        (b.booking?.pickupDate || "").localeCompare(a.booking?.pickupDate || ""),
      name: (a, b) => a.c.name.localeCompare(b.c.name)
    };

    list.sort(sorters[sort] || sorters.spend);

    return list;
  }

  /* =====================================================
     MAIN TABLE
  ====================================================== */

  function renderTable(list) {
    $("tableBody").innerHTML = list.length
      ? list.map(({ c, stats, booking, vehicle, payment }) => `
        <tr>
          <td>
            <div style="display:flex;gap:8px;align-items:center;min-width:0">
              <span class="avatar">${UI.initials(c.name)}</span>
              <div style="min-width:0">
                <span class="cell-main">${esc(c.name)}</span>
                <div class="cell-sub">${esc(c.phone)}</div>
              </div>
            </div>
          </td>

          <td>
            ${booking
              ? `<span class="mono">${esc(booking.id)}</span>
                 <div class="cell-sub">${esc(booking.status)}</div>`
              : '<span class="muted">No booking</span>'}
          </td>

          <td>
            ${vehicle
              ? `${esc(vehicle.brand)} ${esc(vehicle.model)}
                 <div class="cell-sub">${esc(vehicle.plate)}</div>`
              : "-"}
          </td>

          <td>
            ${booking
              ? `${DateUtil.fmtShort(booking.pickupDate)}
                 <div class="cell-sub">to ${DateUtil.fmtShort(booking.returnDate)}</div>`
              : "-"}
          </td>

          <td>
            ${payment
              ? `${esc(payment.method)}
                 <div class="cell-sub">${esc(payment.status)}</div>`
              : '<span class="muted">Not paid</span>'}
          </td>

          <td class="num nowrap">
            ${booking ? money(booking.total) : "-"}
          </td>

          <td class="num">
            ${booking
              ? `<button class="btn btn-xs btn-primary receipt-btn"
                   data-receipt="${esc(c.id)}"
                   data-booking="${esc(booking.id)}">
                   <i class="bi bi-receipt"></i> Receipt
                 </button>`
              : "-"}
          </td>
        </tr>
      `).join("")
      : `
        <tr>
          <td colspan="7" class="table-empty">
            No customers match your search.
          </td>
        </tr>
      `;
  }

  /* =====================================================
     CARD VIEW
  ====================================================== */

  function renderCards(list) {
    $("cardView").innerHTML = list.length
      ? list.map(({ c, stats, booking, vehicle, payment }) => `
        <article class="card ccard">
          <div class="ccard-top">
            <span class="avatar lg">${UI.initials(c.name)}</span>

            <div style="flex:1;min-width:0">
              <h3>${esc(c.name)}</h3>
              <div class="small muted">${esc(c.phone)}</div>
              <div class="small muted">${esc(c.email)}</div>
            </div>
          </div>

          <div class="ccard-stats">
            <div>
              <b>${stats.count}</b>
              <span>Bookings</span>
            </div>
            <div>
              <b>${UI.money0(stats.spend)}</b>
              <span>Total spent</span>
            </div>
            <div>
              <b>${UI.statusBadge(stats.status)}</b>
              <span>Status</span>
            </div>
          </div>

          <div class="small ccard-body">
            ${booking ? `
              <b class="mono">${esc(booking.id)}</b>
              <p>${vehicle ? esc(vehicleLabel(vehicle)) : "Vehicle unavailable"}</p>
              <p class="muted">
                ${DateUtil.fmt(booking.pickupDate)}
                – ${DateUtil.fmt(booking.returnDate)}
              </p>
              <p>${payment ? esc(payment.method) : "No payment record"}</p>
              <b>${money(booking.total)}</b>
            ` : '<span class="muted">No booking yet</span>'}
          </div>

          ${booking ? `
            <button class="btn btn-primary btn-sm ccard-btn"
              data-receipt="${esc(c.id)}"
              data-booking="${esc(booking.id)}">
              <i class="bi bi-receipt"></i> View Receipt
            </button>
          ` : ""}
        </article>
      `).join("")
      : `<div class="empty-note">No customers match your search.</div>`;
  }

  /* =====================================================
     RENDER PAGE
  ====================================================== */

  function render() {
    const all = rows();

    renderSummary(all);

    const list = getFilteredRows(all);

    $("resultCount").textContent =
      `Showing ${list.length} of ${all.length} customers`;

    renderTable(list);
    renderCards(list);

    $("tableView").classList.toggle("hidden", mode !== "table");
    $("cardView").classList.toggle("hidden", mode !== "cards");

    UI.$$(".segmented button").forEach(button => {
      button.classList.toggle("active", button.dataset.mode === mode);
    });
  }

  /* =====================================================
     VIEW SWITCHING AND FILTERS
  ====================================================== */

  UI.$$(".segmented button").forEach(button => {
    button.addEventListener("click", () => {
      mode = button.dataset.mode;
      localStorage.setItem("vx_customer_view", mode);
      render();
    });
  });

  ["search", "fStatus", "sortBy"].forEach(id => {
    $(id).addEventListener("input", render);
    $(id).addEventListener("change", render);
  });

  /* =====================================================
     VEHICLE OPTIONS
  ====================================================== */

  function populateVehicleOptions() {
    const select = $("acVehicle");

    const vehicles = DB.vehicles().filter(v =>
      v.status !== "Maintenance"
    );

    select.innerHTML = `
      <option value="">Select a vehicle</option>
      ${vehicles.map(v => `
        <option value="${esc(v.id)}">
          ${esc(vehicleLabel(v))} — ${money(v.dailyRate)}/day
        </option>
      `).join("")}
    `;
  }

  /* =====================================================
     ADD CUSTOMER + ONE BOOKING + PAYMENT
  ====================================================== */

  $("addCustomerBtn").addEventListener("click", () => {
    $("addCustomerForm").reset();

    populateVehicleOptions();

    $("acPickup").min = T;
    $("acReturn").min = T;

    UI.openModal("addCustomerModal");
  });

  $("acPickup").addEventListener("change", () => {
    $("acReturn").min = $("acPickup").value || T;
  });

  $("addCustomerForm").addEventListener("submit", e => {
    e.preventDefault();

    const name = $("acName").value.trim();
    const phone = $("acPhone").value.trim();
    const email = $("acEmail").value.trim().toLowerCase();
    const city = $("acCity").value.trim();
    const licenceExpiry = $("acLicence").value;
    const vehicleId = $("acVehicle").value;
    const pickupDate = $("acPickup").value;
    const returnDate = $("acReturn").value;
    const method = $("acPayment").value;
    const notes = $("acNotes").value.trim();

    if (!name || !phone || !email || !city || !licenceExpiry ||
        !vehicleId || !pickupDate || !returnDate || !method) {
      UI.toast("Please complete all required fields.");
      return;
    }

    if (pickupDate < T || returnDate <= pickupDate) {
      UI.toast("Please select valid pickup and return dates.");
      return;
    }

    const customers = DB.customers();

    if (customers.some(c => (c.email || "").toLowerCase() === email)) {
      UI.toast("This customer already exists. One customer can only have one new booking through this form.");
      return;
    }

    const vehicle = DB.vehicle(vehicleId);

    if (!vehicle || vehicle.status === "Maintenance") {
      UI.toast("Selected vehicle is unavailable.");
      return;
    }

    if (DB.conflict(vehicleId, pickupDate, returnDate)) {
      UI.toast("This vehicle is already booked for the selected dates.");
      return;
    }

    const customerId = DB.nextId(customers, "CUS", 1, 3);

    const customer = {
      id: customerId,
      name,
      phone,
      email,
      city,
      licenceExpiry,
      joinedAt: T,
      notes,
      preferredVehicleId: vehicleId
    };

    const quote = DB.quote(vehicle, pickupDate, returnDate, null);

    const bookings = DB.bookings();

    const bookingId = DB.nextId(bookings, "VX-", 1001, 0);

    const booking = {
      id: bookingId,
      customerId,
      vehicleId,
      pickupDate,
      returnDate,
      pickupTime: "10:00",
      days: quote.days,
      rate: quote.rate,
      discountPct: quote.discountPct,
      total: quote.total,
      branch: vehicle.branch,
      status: "Confirmed",
      notes: "",
      createdAt: DateUtil.nowLocal(),
      cancelReason: ""
    };

    const payments = DB.payments();

    const payment = {
      id: DB.nextId(payments, "PAY-", 5001, 0),
      bookingId,
      amount: quote.total,
      method,
      date: T,
      status: "Paid"
    };

    // Save the customer, booking and payment records.
    const savedCustomer = DB.save("customers", [...customers, customer]);
    const savedBooking = DB.save("bookings", [...bookings, booking]);
    const savedPayment = DB.save("payments", [...payments, payment]);

    if (!savedCustomer || !savedBooking || !savedPayment) {
      UI.toast("Unable to save all records. Please check browser storage.");
      return;
    }

    $("addCustomerForm").reset();

    const closeButton = document.querySelector(
      '#addCustomerModal [data-close="addCustomerModal"]'
    );
    if (closeButton) closeButton.click();

    render();

    UI.toast("Customer, booking and payment saved successfully.");
  });

  /* =====================================================
     RECEIPT
  ====================================================== */

  function showReceipt(customerId, bookingId) {
    const customer = DB.customer(customerId);
    const booking = DB.booking(bookingId);

    if (!customer || !booking || booking.customerId !== customerId) {
      UI.toast("Receipt record could not be found.");
      return;
    }

    const vehicle = DB.vehicle(booking.vehicleId);
    const payment = paymentFor(booking.id);

    const receiptWindow = window.open(
      "",
      "_blank",
      "width=900,height=750"
    );

    if (!receiptWindow) {
      UI.toast("Please allow pop-ups to view and print the receipt.");
      return;
    }

    const vehicleName = vehicle
      ? vehicleLabel(vehicle)
      : "Vehicle information unavailable";

    const paymentMethod = payment?.method || "Not recorded";
    const paymentStatus = payment?.status || "Not recorded";
    const paymentDate = payment?.date
      ? DateUtil.fmt(payment.date)
      : "-";

    const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Receipt ${esc(booking.id)} | Veltrix</title>

        <style>
          * { box-sizing: border-box; }

          body {
            margin: 0;
            padding: 30px;
            font-family: Arial, sans-serif;
            color: #24352c;
            background: #f3f5f4;
          }

          .receipt {
            width: 100%;
            max-width: 720px;
            min-height: 600px;
            margin: auto;
            padding: 42px;
            background: #fff;
            border: 1px solid #e4e9e5;
          }

          .top {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            padding-bottom: 25px;
            border-bottom: 3px solid #13744a;
          }

          h1 {
            margin: 0 0 6px;
            color: #13744a;
            font-size: 28px;
            letter-spacing: 1px;
          }

          .muted { color: #748078; }

          .receipt-title {
            text-align: right;
          }

          .receipt-title h2 {
            margin: 0 0 7px;
            font-size: 20px;
          }

          .section {
            margin-top: 28px;
          }

          .section h3 {
            margin: 0 0 13px;
            color: #13744a;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }

          .details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px 30px;
          }

          .field small {
            display: block;
            margin-bottom: 5px;
            color: #78847d;
            font-size: 11px;
          }

          .field strong {
            font-size: 13px;
            overflow-wrap: anywhere;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th, td {
            padding: 13px 10px;
            text-align: left;
            border-bottom: 1px solid #e8ede9;
            font-size: 12px;
          }

          th {
            background: #f1f6f2;
            color: #466052;
          }

          .total {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            padding: 18px;
            background: #eff6f1;
            color: #13744a;
            font-size: 18px;
            font-weight: bold;
          }

          .footer {
            margin-top: 35px;
            padding-top: 18px;
            border-top: 1px solid #e8ede9;
            text-align: center;
            font-size: 11px;
            color: #748078;
          }

          .print-actions {
            display: flex;
            justify-content: center;
            margin: 20px auto;
          }

          .print-actions button {
            border: 0;
            border-radius: 7px;
            padding: 12px 22px;
            background: #13744a;
            color: white;
            font-weight: bold;
            cursor: pointer;
          }

          @page {
            size: A4;
            margin: 12mm;
          }

          @media print {
            body {
              padding: 0;
              background: white;
            }

            .receipt {
              width: 100%;
              max-width: none;
              min-height: 0;
              padding: 15px;
              border: 0;
            }

            .print-actions { display: none; }
          }
        </style>
      </head>

      <body>
        <div class="receipt">
          <div class="top">
            <div>
              <h1>VELTRIX</h1>
              <div class="muted">Car Rental Management System</div>
              <div class="muted">Official Payment Receipt</div>
            </div>

            <div class="receipt-title">
              <h2>BOOKING RECEIPT</h2>
              <strong>${esc(booking.id)}</strong>
              <div class="muted">${DateUtil.fmt(T)}</div>
            </div>
          </div>

          <div class="section">
            <h3>Customer Information</h3>
            <div class="details">
              <div class="field">
                <small>Customer Name</small>
                <strong>${esc(customer.name)}</strong>
              </div>
              <div class="field">
                <small>Customer ID</small>
                <strong>${esc(customer.id)}</strong>
              </div>
              <div class="field">
                <small>Phone Number</small>
                <strong>${esc(customer.phone)}</strong>
              </div>
              <div class="field">
                <small>Email Address</small>
                <strong>${esc(customer.email)}</strong>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Rental Information</h3>
            <div class="details">
              <div class="field">
                <small>Vehicle</small>
                <strong>${esc(vehicleName)}</strong>
              </div>
              <div class="field">
                <small>Booking Status</small>
                <strong>${esc(booking.status)}</strong>
              </div>
              <div class="field">
                <small>Pickup Date</small>
                <strong>${DateUtil.fmt(booking.pickupDate)}</strong>
              </div>
              <div class="field">
                <small>Return Date</small>
                <strong>${DateUtil.fmt(booking.returnDate)}</strong>
              </div>
              <div class="field">
                <small>Rental Duration</small>
                <strong>${Number(booking.days)} day(s)</strong>
              </div>
              <div class="field">
                <small>Daily Rate</small>
                <strong>${money(booking.rate)}</strong>
              </div>
            </div>
          </div>

          <div class="section">
            <h3>Payment Information</h3>
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Payment Method</th>
                  <th>Payment Date</th>
                  <th>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Car Rental</td>
                  <td>${esc(paymentMethod)}</td>
                  <td>${paymentDate}</td>
                  <td>${esc(paymentStatus)}</td>
                </tr>
              </tbody>
            </table>

            <div class="total">
              <span>Total Amount</span>
              <span>${money(payment?.amount ?? booking.total)}</span>
            </div>
          </div>

          <div class="footer">
            Thank you for choosing Veltrix.<br>
            This receipt is generated from the existing booking and payment records.
          </div>
        </div>

        <div class="print-actions">
          <button onclick="window.print()">Print Receipt</button>
        </div>
      </body>
      </html>
    `;

    receiptWindow.document.open();
    receiptWindow.document.write(html);
    receiptWindow.document.close();
  }

  document.addEventListener("click", e => {
    const button = e.target.closest("[data-receipt]");
    if (!button) return;

    showReceipt(button.dataset.receipt, button.dataset.booking);
  });

  /* =====================================================
     CUSTOMER HISTORY
  ====================================================== */

  function showHistory(customerId) {
    const customer = DB.customer(customerId);
    if (!customer) return;

    const booking = latestBooking(customerId);
    const vehicle = booking ? DB.vehicle(booking.vehicleId) : null;
    const payment = booking ? paymentFor(booking.id) : null;
    const stats = DB.customerStats(customerId);

    $("hmAvatar").textContent = UI.initials(customer.name);
    $("hmTitle").textContent = customer.name;

    $("hmSub").textContent =
      `${customer.id} · Customer since ${DateUtil.fmt(customer.joinedAt)}`;

    $("hmBody").innerHTML = `
      <div class="grid" style="gap:12px">
        <div class="card kpi">
          <div class="kpi-top">Customer Status</div>
          <div class="kpi-value">${UI.statusBadge(stats.status)}</div>
        </div>
      </div>

      <h3 class="mt-24 mb-16">Customer Information</h3>

      <dl class="detail-grid">
        <div><dt>Phone</dt><dd>${esc(customer.phone)}</dd></div>
        <div><dt>Email</dt><dd>${esc(customer.email)}</dd></div>
        <div><dt>City</dt><dd>${esc(customer.city)}</dd></div>
        <div><dt>Driving Licence Expiry</dt><dd>${DateUtil.fmt(customer.licenceExpiry)}</dd></div>
      </dl>

      <h3 class="mt-24 mb-16">Booking Information</h3>

      ${booking ? `
        <dl class="detail-grid">
          <div><dt>Booking ID</dt><dd>${esc(booking.id)}</dd></div>
          <div><dt>Vehicle</dt><dd>${esc(vehicleLabel(vehicle))}</dd></div>
          <div><dt>Pickup Date</dt><dd>${DateUtil.fmt(booking.pickupDate)}</dd></div>
          <div><dt>Return Date</dt><dd>${DateUtil.fmt(booking.returnDate)}</dd></div>
          <div><dt>Duration</dt><dd>${booking.days} days</dd></div>
          <div><dt>Booking Status</dt><dd>${UI.statusBadge(booking.status)}</dd></div>
          <div><dt>Payment Method</dt><dd>${esc(payment?.method || "Not recorded")}</dd></div>
          <div><dt>Payment Status</dt><dd>${payment ? UI.statusBadge(payment.status) : "-"}</dd></div>
          <div><dt>Total Amount</dt><dd><b>${money(booking.total)}</b></dd></div>
        </dl>
      ` : `
        <div class="empty-note">This customer has no booking record.</div>
      `}
    `;

    $("hmFoot").innerHTML = `
      ${booking ? `
        <button class="btn btn-primary"
          data-receipt="${esc(customerId)}"
          data-booking="${esc(booking.id)}">
          <i class="bi bi-receipt"></i> View Receipt
        </button>
      ` : ""}
      <button class="btn" data-close="historyModal">Close</button>
    `;

    UI.openModal("historyModal");
  }

  document.addEventListener("click", e => {
    const button = e.target.closest("[data-history]");
    if (button) showHistory(button.dataset.history);
  });

  /* =====================================================
     EXPORT CSV
  ====================================================== */

  $("exportBtn").addEventListener("click", () => {
    const output = [[
      "Customer ID",
      "Customer Name",
      "Email",
      "Phone",
      "Booking ID",
      "Vehicle",
      "Pickup Date",
      "Return Date",
      "Payment Method",
      "Payment Status",
      "Amount"
    ]];

    rows().forEach(({ c, booking, vehicle, payment }) => {
      output.push([
        c.id,
        c.name,
        c.email,
        c.phone,
        booking?.id || "",
        vehicle ? vehicleLabel(vehicle) : "",
        booking?.pickupDate || "",
        booking?.returnDate || "",
        payment?.method || "",
        payment?.status || "",
        booking?.total ?? ""
      ]);
    });

    downloadCSV(output, `veltrix-customers-${T}.csv`);
    UI.toast("Customer records exported.");
  });

  /* =====================================================
     INITIAL LOAD
  ====================================================== */

  render();

  const params = new URLSearchParams(location.search);

  if (params.get("customer")) {
    showHistory(params.get("customer"));
  }

})();

