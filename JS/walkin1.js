class WalkInPaymentApp {
    constructor() {
        this.initializeElements();
        this.currentShiftLabel = "No Shift Open";
        this.shiftData = null;
        this.cashierName = "Cashier";
        this.isSaving = false;
        this.initializeApp();
    }

    initializeElements() {
        this.adultsInput = document.getElementById('adults');
        this.kidsInput = document.getElementById('kids');
        this.currencyInput = document.getElementById('currency');
        this.paymentTypeInput = document.getElementById('paymentType');
        this.paidInput = document.getElementById('paid');
        this.balanceInput = document.getElementById('balance');
        this.qrInput = document.getElementById('qrCode');
        this.nameField = document.getElementById('passengerName');
        this.flightField = document.getElementById('flightNo');
        this.seatField = document.getElementById('seatNo');
        this.airlineField = document.getElementById('airline');
        this.rateTypeInput = document.getElementById('rateType');

        this.receiptNoHeader = document.getElementById('receiptNoHeader');
        this.shiftNameHeader = document.getElementById('shiftNameHeader');
        this.currentDateHeader = document.getElementById('currentDateHeader');
        this.currentCashier = document.getElementById('currentcashier');

        this.cashFieldsDiv = document.getElementById('cashFields');
        this.saveBtn = document.getElementById('saveBtn');
        this.clearBtn = document.getElementById('clearBtn');

        this.adultsAmount = document.getElementById('adultsAmount');
        this.kidsAmount = document.getElementById('kidsAmount');
        this.subtotalAmount = document.getElementById('subtotalAmount');
        this.gstAmount = document.getElementById('gstAmount');
        this.grandTotalAmount = document.getElementById('grandTotalAmount');
        this.grandTotalDisplay = document.getElementById('grandTotalDisplay');
        this.totalPaxPreview = document.getElementById('totalPaxPreview');
        this.adultsCount = document.getElementById('adultsCount');
        this.kidsCount = document.getElementById('kidsCount');
    }

    async initializeApp() {
        this.initializeUser();
        this.updateCurrentDate();
        this.togglePaymentFields();
        await this.fetchCurrentShift();
        this.initializeEventListeners();
        this.calculate();

        setTimeout(() => {
            if (this.qrInput) this.qrInput.focus();
        }, 500);
    }

    initializeUser() {
        const userData = JSON.parse(localStorage.getItem("loggedInUser"));
        if (userData) {
            this.cashierName = userData.name || userData.username;
            if (this.currentCashier) this.currentCashier.textContent = this.cashierName;
        } else {
            window.location.href = "login.html";
        }
    }

    updateCurrentDate() {
        const now = new Date();
        if (this.currentDateHeader) this.currentDateHeader.textContent = now.toLocaleDateString();
    }

    togglePaymentFields() {
        if (!this.paymentTypeInput || !this.cashFieldsDiv) return;
        const isCard = this.paymentTypeInput.value === "Card";
        this.cashFieldsDiv.style.display = isCard ? "none" : "block";
        if (isCard) {
            const totals = this.calculate();
            if (totals && this.paidInput) this.paidInput.value = totals.grandTotal.toFixed(2);
            if (this.balanceInput) this.balanceInput.value = "0.00";
        }
    }

    parseQR(code) {
        code = code.trim().toUpperCase().replace(/\s+/g, ' ');
        let name = "", flightNo = "", seatNo = "";
        const allParts = code.split(' ');

        if (code.startsWith("TKVCPO")) {
            const tkIndex = code.indexOf("TK0");
            if (tkIndex != -1) {
                flightNo = code.substring(tkIndex, tkIndex + 6);
                name = code.substring(6, tkIndex).trim();
            }
            const mlePos = code.indexOf("MLE");
            if (mlePos != -1) {
                const afterMLE = code.substring(mlePos).split(' ')[0];
                if (afterMLE.length >= 11) seatNo = afterMLE.substring(8, 11);
            }
        } else {
            const mleIndex = allParts.findIndex(w => w.includes("MLE"));
            if (mleIndex > 0) {
                let nameParts = allParts.slice(0, mleIndex);
                nameParts[0] = nameParts[0].substring(2);
                name = nameParts.join(' ').trim();
            } else {
                name = allParts[0].substring(2);
            }
            if (name.length > 6) name = name.substring(0, name.length - 6).trim();

            if (mleIndex != -1) {
                const mleWord = allParts[mleIndex];
                const nextWord = (mleIndex + 1 < allParts.length) ? allParts[mleIndex + 1] : "";
                flightNo = mleWord.slice(-2) + nextWord;
                const partsAfterMLE = allParts.slice(mleIndex + 1);
                for (let w of partsAfterMLE) {
                    if (w.length >= 9 && !w.includes("QR") && !w.includes("MLE")) {
                        seatNo = w.substring(5, w.length - 4);
                        break;
                    }
                }
            }
        }
        return { name, flightNo, seatNo };
    }

    getAirline(flightNo) {
        if (!flightNo || flightNo.length < 2) return "Unknown";
        const code = flightNo.substring(0, 2).toUpperCase();
        const iata = {
            "BA":"British Airways","TK":"Turkish Airlines","QR":"Qatar Airways",
            "EK":"Emirates","EY":"Etihad Airways","LH":"Lufthansa",
            "AF":"Air France","KL":"KLM","AA":"American Airlines",
            "UA":"United Airlines","DL":"Delta Air Lines","SQ":"Singapore Airlines",
            "CX":"Cathay Pacific","NH":"All Nippon Airways","JL":"Japan Airlines",
            "KE":"Korean Air","PG":"Bangkok Airways","TG":"Thai Airways",
            "MH":"Malaysia Airlines","GA":"Garuda Indonesia","QF":"Qantas",
            "NZ":"Air New Zealand","AC":"Air Canada","LX":"Swiss International Air Lines",
            "OS":"Austrian Airlines","SN":"Brussels Airlines","SK":"SAS Scandinavian Airlines",
            "AY":"Finnair","LO":"LOT Polish Airlines","SU":"Aeroflot",
            "AZ":"Alitalia","IB":"Iberia","Q2":"Maldivian","SV":"Saudia",
            "ET":"Ethiopian Airlines","MS":"EgyptAir","RJ":"Royal Jordanian",
            "OD":"Batik Air","JD":"Beijing Capital Airlines","UL":"Srilankan Airlines"
        };
        return iata[code] || "Unknown";
    }

    async fetchCurrentShift() {
        try {
            if (!db) { this.updateShiftInfo(null); return; }
            const snapshot = await db.collection("shifts").limit(1).get();
            this.updateShiftInfo(!snapshot.empty ? snapshot.docs[0].data() : null);
        } catch {
            this.updateShiftInfo(null);
        }
    }

    updateShiftInfo(data) {
        if (!data) this.currentShiftLabel = "No Shift Open";
        else if (data.shift1?.status === "Open") this.currentShiftLabel = "Morning Shift";
        else if (data.shift2?.status === "Open") this.currentShiftLabel = "Evening Shift";
        else this.currentShiftLabel = "No Shift Open";
        if (this.shiftNameHeader) this.shiftNameHeader.textContent = this.currentShiftLabel;
    }

    calculate() {
        try {
            const adults = parseInt(this.adultsInput.value) || 0;
            const kids = parseInt(this.kidsInput.value) || 0;
            const currency = this.currencyInput.value;
            const rateType = this.rateTypeInput.value;
            const paid = parseFloat(this.paidInput.value) || 0;
            this.updatePassengerCounts(adults, kids);
            if (typeof rates === 'undefined') return null;
            const adultRate = rates[`Adult${rateType}${currency}`];
            const kidsRate = rates[`Kids${rateType}${currency}`];
            if (!adultRate || !kidsRate) return null;
            const adultsTotal = adults * adultRate.price;
            const kidsTotal = kids * kidsRate.price;
            const subtotal = adultsTotal + kidsTotal;
            const gst = subtotal * (adultRate.GST / 100);
            const grandTotal = subtotal + gst;
            const balance = this.paymentTypeInput.value === "Card" ? 0 : paid - grandTotal;
            if (this.balanceInput) this.balanceInput.value = balance.toFixed(2);
            this.updateSummaryDisplay(adults, kids, adultsTotal, kidsTotal, subtotal, gst, grandTotal, currency);
            return { adultsTotal, kidsTotal, subtotal, gst, grandTotal };
        } catch { return null; }
    }

    updatePassengerCounts(adults, kids) {
        const totalPax = adults + kids;
        if (this.totalPaxPreview) this.totalPaxPreview.textContent = totalPax;
        if (this.adultsCount) this.adultsCount.textContent = adults;
        if (this.kidsCount) this.kidsCount.textContent = kids;
    }

    updateSummaryDisplay(adults, kids, adultsTotal, kidsTotal, subtotal, gst, grandTotal, currency) {
        const symbol = currency === 'USD' ? '$' : 'ރ';
        if (this.adultsAmount) this.adultsAmount.textContent = `${symbol}${adultsTotal.toFixed(2)}`;
        if (this.kidsAmount) this.kidsAmount.textContent = `${symbol}${kidsTotal.toFixed(2)}`;
        if (this.subtotalAmount) this.subtotalAmount.textContent = `${symbol}${subtotal.toFixed(2)}`;
        if (this.gstAmount) this.gstAmount.textContent = `${symbol}${gst.toFixed(2)}`;
        if (this.grandTotalAmount) this.grandTotalAmount.textContent = `${symbol}${grandTotal.toFixed(2)}`;
        if (this.grandTotalDisplay) this.grandTotalDisplay.textContent = `${symbol}${grandTotal.toFixed(2)} ${currency}`;
    }

    updateReceiptDisplay(receiptNo) {
        if (this.receiptNoHeader) this.receiptNoHeader.textContent = receiptNo;
    }

    generateThermalReceipt(paymentData) {
        const now = new Date();
        const symbol = paymentData.currency === 'USD' ? '$' : 'ރ';
        return `
        <div id="thermalReceipt" style="width:64mm;font-family:'Courier New',monospace;font-size:12px;line-height:1.2;padding:5px;background:white;color:black;">
            <div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:5px;">KOVELI LOUNGE</div>
            <div style="text-align:center;font-size:10px;margin-bottom:5px;">Velana International Airport</div>
            <div style="text-align:center;font-size:10px;margin-bottom:8px;">Tel: +960 304 6677</div>
            <hr style="border:1px dashed #000;margin:5px 0;">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span>Receipt: #${paymentData.receiptNo}</span>
                <span>${now.toLocaleDateString()}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span>${now.toLocaleTimeString()}</span>
                <span>${this.cashierName}</span>
            </div>
            <hr style="border:0.5px solid #000;margin:5px 0;">
            <div style="margin-bottom:3px;"><strong>Passenger:</strong> ${paymentData.name}</div>
            <div style="display:flex;justify-content:space-between;margin-bottom:3px;">
                <span><strong>Flight:</strong> ${paymentData.flightNo}</span>
                <span><strong>Seat:</strong> ${paymentData.seatNo || '-'}</span>
            </div>
            <div style="margin-bottom:5px;"><strong>Airline:</strong> ${paymentData.airline}</div>
            <hr style="border:0.5px solid #000;margin:5px 0;">
            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                <span>Adults (${paymentData.adults}):</span>
                <span>${symbol}${(paymentData.adultsTotal || 0).toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                <span>Kids (${paymentData.kids}):</span>
                <span>${symbol}${(paymentData.kidsTotal || 0).toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                <span>Subtotal:</span>
                <span>${symbol}${(paymentData.subtotal || 0).toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                <span>GST:</span>
                <span>${symbol}${(paymentData.gst || 0).toFixed(2)}</span>
            </div>
            <hr style="border:0.5px solid #000;margin:5px 0;">
            <div style="display:flex;justify-content:space-between;font-weight:bold;margin-bottom:3px;">
                <span>TOTAL:</span>
                <span>${symbol}${(paymentData.grandTotal || 0).toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
                <span>Paid:</span>
                <span>${symbol}${(paymentData.paid || 0).toFixed(2)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:5px;">
                <span>Balance:</span>
                <span>${symbol}${(paymentData.balance || 0).toFixed(2)}</span>
            </div>
            <div style="margin-bottom:3px;"><strong>Payment:</strong> ${paymentData.paymentType}</div>
            <hr style="border:1px dashed #000;margin:8px 0 5px 0;">
            <div style="text-align:center;font-size:10px;margin-bottom:5px;">Thank you for your business!</div>
            <div style="text-align:center;font-size:9px;">${now.toLocaleString()}</div>
        </div>
        `;
    }

    printReceipt(receiptContent) {
        try {
            const printWindow = window.open('', '_blank', 'width=64mm,height=400,scrollbars=no,menubar=no,toolbar=no');
            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Print Receipt</title>
                    <style>body{margin:0;padding:0;background:white}@media print{body{margin:0;padding:0}@page{margin:0;size:64mm auto}}</style>
                </head>
                <body onload="window.print();setTimeout(()=>window.close(),500);">${receiptContent}</body>
                </html>`);
            printWindow.document.close();
        } catch {
            alert("Could not open print window. Check popup blocker.");
        }
    }

    async savePayment() {
        if (this.isSaving) return;
        this.isSaving = true;

        if (!this.nameField.value.trim()) { alert("Enter passenger name"); this.nameField.focus(); this.isSaving=false; return; }
        if (!this.flightField.value.trim()) { alert("Enter flight number"); this.flightField.focus(); this.isSaving=false; return; }

        const totals = this.calculate();
        if (!totals) { alert("Error in calculation. Check rates."); this.isSaving=false; return; }

        try {
            let lastPaymentSnapshot = await walkinDb.collection("payments").orderBy("receiptNo","desc").limit(1).get();
            let nextReceiptNo = lastPaymentSnapshot.empty ? 1 : lastPaymentSnapshot.docs[0].data().receiptNo + 1;

            const paymentData = {
                receiptNo: nextReceiptNo,
                date: new Date().toISOString(),
                cashier: this.cashierName,
                shift: this.currentShiftLabel,
                rateType: this.rateTypeInput.value,
                name: this.nameField.value.trim(),
                flightNo: this.flightField.value.trim(),
                seatNo: this.seatField.value.trim(),
                airline: this.airlineField.value || "Unknown",
                adults: parseInt(this.adultsInput.value)||0,
                kids: parseInt(this.kidsInput.value)||0,
                currency: this.currencyInput.value,
                paymentType: this.paymentTypeInput.value,
                paid: parseFloat(this.paidInput.value)||0,
                balance: parseFloat(this.balanceInput.value)||0,
                subtotal: totals.subtotal,
                gst: totals.gst,
                grandTotal: totals.grandTotal,
                adultsTotal: totals.adultsTotal,
                kidsTotal: totals.kidsTotal
            };

            await walkinDb.collection("payments").doc(nextReceiptNo.toString()).set(paymentData);
            this.updateReceiptDisplay(nextReceiptNo);
            this.printReceipt(this.generateThermalReceipt(paymentData));
            this.clearForm();

        } catch (error) {
            console.error("Firebase save error:", error);
            alert("Error saving payment. Check console for details.");
        } finally {
            this.isSaving = false;
        }
    }

    clearForm() {
        this.nameField.value = "";
        this.flightField.value = "";
        this.seatField.value = "";
        this.airlineField.value = "";
        this.adultsInput.value = 1;
        this.kidsInput.value = 0;
        this.paidInput.value = 0;
        this.balanceInput.value = 0;
        this.qrInput.value = "";
        this.currencyInput.value = "USD";
        this.rateTypeInput.value = "A";
        this.paymentTypeInput.value = "Cash";
        setTimeout(()=>this.qrInput.focus(),100);
        this.calculate();
    }

    initializeEventListeners() {
        this.adultsInput.addEventListener('input', () => this.calculate());
        this.kidsInput.addEventListener('input', () => this.calculate());
        this.currencyInput.addEventListener('change', () => this.calculate());
        this.rateTypeInput.addEventListener('change', () => this.calculate());
        this.paymentTypeInput.addEventListener('change', () => { this.togglePaymentFields(); this.calculate(); });
        this.paidInput.addEventListener('input', () => this.calculate());

        let qrTimeout = null;
        this.qrInput.addEventListener('input', (e) => {
            clearTimeout(qrTimeout);
            qrTimeout = setTimeout(() => {
                const qr = e.target.value;
                if (qr.length > 5) {
                    const { name, flightNo, seatNo } = this.parseQR(qr);
                    this.nameField.value = name;
                    this.flightField.value = flightNo;
                    this.seatField.value = seatNo;
                    this.airlineField.value = this.getAirline(flightNo);
                    this.calculate();
                }
            }, 300);
        });

        if (this.saveBtn) this.saveBtn.addEventListener('click', async () => await this.savePayment());
        if (this.clearBtn) this.clearBtn.addEventListener('click', () => this.clearForm());
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.walkInApp = new WalkInPaymentApp();
});
