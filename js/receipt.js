/* =========================================================
   VELTRIX — Shared receipt (same receipt as customers.html)
   Used by inspections.html. Exposes: window.showBookingReceipt(customerId, bookingId)
   ========================================================= */
(function () {
  const T = DateUtil.todayIso();
  const esc = (value) => UI.esc(String(value ?? ""));

  function money(value) {
    return "RM " + Number(value || 0).toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  function paymentFor(bookingId) {
    return DB.payments().find((p) => p.bookingId === bookingId) || null;
  }

  function vehicleLabel(v) {
    if (!v) return "Vehicle unavailable";
    return `${v.brand} ${v.model}${v.variant ? " " + v.variant : ""} (${v.plate})`;
  }

  function showBookingReceipt(customerId, bookingId) {
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

  window.showBookingReceipt = showBookingReceipt;
})();
