// Walk-in Payment Calculator Application
class WalkInPaymentApp {
    constructor() {
        this.initializeElements();
        this.currentShiftLabel = "No Shift Open";
        this.shiftData = null;
        this.cashierName = "Cashier";
        this.initializeApp();
    }

    initializeElements() {
        // Form elements
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

        // Header elements
        this.receiptNoHeader = document.getElementById('receiptNoHeader');
        this.shiftNameHeader = document.getElementById('shiftNameHeader');
        this.currentDateHeader = document.getElementById('currentDateHeader');
        this.currentCashier = document.getElementById('currentcashier');

        // UI elements
        this.cashFieldsDiv = document.getElementById('cashFields');
        this.saveBtn = document.getElementById('saveBtn');
        this.paidReceiptSection = document.getElementById('paidReceiptSection');
        this.connectionStatus = document.getElementById('connectionStatus');

        // Company info
        this.companyName = document.getElementById('companyName');
        this.companyAddress = document.getElementById('companyAddress');
        this.companyPhone = document.getElementById('companyPhone');

        // Summary elements
        this.adultsAmount = document.getElementById('adultsAmount');
        this.kidsAmount = document.getElementById('kidsAmount');
        this.subtotalAmount = document.getElementById('subtotalAmount');
        this.gstAmount = document.getElementById('gstAmount');
        this.grandTotalAmount = document.getElementById('grandTotalAmount');
        this.grandTotalDisplay = document.getElementById('grandTotalDisplay');
        this.totalPaxPreview = document.getElementById('totalPaxPreview');
        this.adultsCount = document.getElementById('adultsCount');
        this.kidsCount = document.getElementById('kidsCount');

        // Receipt preview elements
        this.receiptNoPreview = document.getElementById('receiptNoPreview');
        this.receiptDatePreview = document.getElementById('receiptDatePreview');
        this.cashierPreview = document.getElementById('cashierPreview');
        this.shiftPreview = document.getElementById('shiftPreview');
        this.namePreview = document.getElementById('namePreview');
        this.flightPreview = document.getElementById('flightPreview');
        this.seatPreview = document.getElementById('seatPreview');
        this.airlinePreview = document.getElementById('airlinePreview');
        this.adultsReceipt = document.getElementById('adultsReceipt');
        this.kidsReceipt = document.getElementById('kidsReceipt');
        this.subtotalReceipt = document.getElementById('subtotalReceipt');
        this.gstReceipt = document.getElementById('gstReceipt');
        this.grandTotalReceipt = document.getElementById('grandTotalReceipt');
        this.paymentTypePreview = document.getElementById('paymentTypePreview');
        this.paidReceipt = document.getElementById('paidReceipt');
        this.balanceReceipt = document.getElementById('balanceReceipt');
        this.rateTypePreview = document.getElementById('rateTypePreview');
        this.adultsCountPreview = document.getElementById('adultsCountPreview');
        this.kidsCountPreview = document.getElementById('kidsCountPreview');
    }

    async initializeApp() {
        this.initializeUser();
        this.loadCompanyInfo();
        this.updateCurrentDate();
        this.togglePaymentFields();
        await this.fetchCurrentShift();
        this.initializeEventListeners();
        this.calculate();
        this.initializeLocalReceiptNo();
        this.setupQRInputMask();
        // Don't load from localStorage - start fresh
    }

    setupQRInputMask() {
        if (this.qrInput) {
            this.qrInput.type = 'password';
            this.qrInput.placeholder = 'Scan or enter QR code...';
        }
    }

    initializeLocalReceiptNo() {
        let localReceiptNo = localStorage.getItem('localReceiptNo');
        if (!localReceiptNo) {
            localReceiptNo = 1;
            localStorage.setItem('localReceiptNo', localReceiptNo.toString());
        }
        this.updateReceiptDisplay(localReceiptNo);
    }

    getNextLocalReceiptNo() {
        let localReceiptNo = parseInt(localStorage.getItem('localReceiptNo') || '1');
        localReceiptNo++;
        localStorage.setItem('localReceiptNo', localReceiptNo.toString());
        return localReceiptNo;
    }

    initializeUser() {
        const userData = JSON.parse(localStorage.getItem("loggedInUser"));
        if (userData) {
            this.cashierName = userData.name || userData.username;
            this.currentCashier.textContent = this.cashierName;
            this.cashierPreview.textContent = this.cashierName;
        } else {
            window.location.href = "login.html";
        }
    }

    loadCompanyInfo() {
        if (typeof companyInfo !== 'undefined') {
            this.companyName.textContent = companyInfo.name;
            this.companyAddress.textContent = companyInfo.address;
            this.companyPhone.textContent = companyInfo.phone;
        }
    }

    updateCurrentDate() {
        const now = new Date();
        this.currentDateHeader.textContent = now.toLocaleDateString();
        this.receiptDatePreview.textContent = `Date: ${now.toLocaleString()}`;
    }

    togglePaymentFields() {
        const isCard = this.paymentTypeInput.value === "Card";
        this.cashFieldsDiv.style.display = isCard ? "none" : "block";
        this.paidReceiptSection.style.display = isCard ? "none" : "block";
        if (isCard) {
            const totals = this.calculate();
            if (totals) this.paidInput.value = totals.grandTotal.toFixed(2);
            this.balanceInput.value = "0.00";
        }
    }

    parseQR(code) {
        code = code.trim().toUpperCase();
        let name = "", flightNo = "", seatNo = "";
        const parts = code.split(' ');

        if (code.startsWith("TKVCPO")) {
            const tkIndex = code.indexOf("TK0");
            if (tkIndex !== -1) {
                flightNo = code.substring(tkIndex, tkIndex + 6);
                name = code.substring(6, tkIndex).trim();
            }
            const mlePos = code.indexOf("MLE");
            if (mlePos !== -1) {
                const afterMLE = code.substring(mlePos).split(' ')[0];
                if (afterMLE.length >= 11) seatNo = afterMLE.substring(8, 11);
            }
        } else {
            name = parts[0].substring(2);
            const mleIndex = parts.findIndex(w => w.includes("MLE"));
            if (mleIndex !== -1) {
                const mleWord = parts[mleIndex];
                const nextWord = (mleIndex + 1 < parts.length) ? parts[mleIndex + 1] : "";
                flightNo = mleWord.slice(-2) + nextWord;
                const partsAfterMLE = parts.slice(mleIndex + 1);
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
            "BA":"British Airways","TK":"Turkish Airlines","QR":"Qatar Airways","EK":"Emirates",
            "EY":"Etihad Airways","LH":"Lufthansa","AF":"Air France","KL":"KLM",
            "AA":"American Airlines","UA":"United Airlines","DL":"Delta Air Lines",
            "SQ":"Singapore Airlines","CX":"Cathay Pacific","NH":"All Nippon Airways",
            "JL":"Japan Airlines","KE":"Korean Air","PG":"Bangkok Airways","TG":"Thai Airways",
            "MH":"Malaysia Airlines","GA":"Garuda Indonesia","QF":"Qantas","NZ":"Air New Zealand",
            "AC":"Air Canada","LX":"Swiss International Air Lines","OS":"Austrian Airlines",
            "SN":"Brussels Airlines","SK":"SAS Scandinavian Airlines","AY":"Finnair",
            "LO":"LOT Polish Airlines","SU":"Aeroflot","AZ":"Alitalia","IB":"Iberia",
            "Q2":"Maldivian","SV":"Saudia","ET":"Ethiopian Airlines","MS":"EgyptAir",
            "RJ":"Royal Jordanian","OD":"Batik Air","JD":"Beijing Capital Airlines","UL":"Srilankan Airlines"
        };
        return iata[code] || "Unknown";
    }

    async fetchCurrentShift() {
        try {
            if (!db) { this.updateShiftInfo(null); return; }
            const snapshot = await db.collection("shifts").limit(1).get();
            if (!snapshot.empty) this.updateShiftInfo(snapshot.docs[0].data());
            else this.updateShiftInfo(null);
        } catch {
            this.updateShiftInfo(null);
        }
    }

    updateShiftInfo(data) {
        if (!data) this.currentShiftLabel = "No Shift Open";
        else if (data.shift1?.status === "Open") this.currentShiftLabel = "Morning Shift";
        else if (data.shift2?.status === "Open") this.currentShiftLabel = "Evening Shift";
        else this.currentShiftLabel = "No Shift Open";

        this.shiftNameHeader.textContent = this.currentShiftLabel;
        this.shiftPreview.textContent = this.currentShiftLabel;
    }

    calculate() {
        try {
            const adults = parseInt(this.adultsInput.value) || 0;
            const kids = parseInt(this.kidsInput.value) || 0;
            const currency = this.currencyInput.value;
            const rateType = this.rateTypeInput.value;
            const paid = parseFloat(this.paidInput.value) || 0;

            this.updatePassengerCounts(adults, kids);

            if (!rates) { alert("Rates not loaded"); return null; }

            const adultRateKey = `Adult${rateType}${currency}`;
            const kidsRateKey = `Kids${rateType}${currency}`;
            const adultRate = rates[adultRateKey];
            const kidsRate = rates[kidsRateKey];
            if (!adultRate || !kidsRate) return null;

            const adultsTotal = adults * adultRate.price;
            const kidsTotal = kids * kidsRate.price;
            const subtotal = adultsTotal + kidsTotal;
            const gst = subtotal * (adultRate.GST / 100);
            const grandTotal = subtotal + gst;

            let balance = 0;
            if (this.paymentTypeInput.value === "Card") balance = 0;
            else balance = paid - grandTotal;
            this.balanceInput.value = balance.toFixed(2);

            this.updateSummaryDisplay(adults, kids, adultsTotal, kidsTotal, subtotal, gst, grandTotal, currency);
            this.updateReceiptPreview(adults, kids, adultsTotal, kidsTotal, subtotal, gst, grandTotal, currency);
            return { adultsTotal, kidsTotal, subtotal, gst, grandTotal };
        } catch {
            return null;
        }
    }

    updatePassengerCounts(adults, kids) {
        const totalPax = adults + kids;
        this.totalPaxPreview.textContent = totalPax;
        this.adultsCount.textContent = adults;
        this.kidsCount.textContent = kids;
        this.adultsCountPreview.textContent = adults;
        this.kidsCountPreview.textContent = kids;
    }

    updateSummaryDisplay(adults, kids, adultsTotal, kidsTotal, subtotal, gst, grandTotal, currency) {
        this.adultsAmount.textContent = `${adultsTotal.toFixed(2)} ${currency}`;
        this.kidsAmount.textContent = `${kidsTotal.toFixed(2)} ${currency}`;
        this.subtotalAmount.textContent = `${subtotal.toFixed(2)} ${currency}`;
        this.gstAmount.textContent = `${gst.toFixed(2)} ${currency}`;
        this.grandTotalAmount.textContent = `${grandTotal.toFixed(2)} ${currency}`;
        this.grandTotalDisplay.textContent = `${grandTotal.toFixed(2)} ${currency}`;
    }

    updateReceiptPreview(adults, kids, adultsTotal, kidsTotal, subtotal, gst, grandTotal, currency) {
        this.receiptNoPreview.textContent = this.receiptNoHeader.textContent;
        this.updateCurrentDate();
        this.namePreview.textContent = this.nameField.value || "-";
        this.flightPreview.textContent = this.flightField.value || "-";
        this.seatPreview.textContent = this.seatField.value || "-";
        this.airlinePreview.textContent = this.airlineField.value || "-";
        this.adultsReceipt.textContent = `${adultsTotal.toFixed(2)} ${currency}`;
        this.kidsReceipt.textContent = `${kidsTotal.toFixed(2)} ${currency}`;
        this.subtotalReceipt.textContent = `${subtotal.toFixed(2)} ${currency}`;
        this.gstReceipt.textContent = `${gst.toFixed(2)} ${currency}`;
        this.grandTotalReceipt.textContent = `${grandTotal.toFixed(2)} ${currency}`;
        this.paymentTypePreview.textContent = this.paymentTypeInput.value;
        this.paidReceipt.textContent = `${this.paidInput.value} ${currency}`;
        this.balanceReceipt.textContent = `${this.balanceInput.value} ${currency}`;
        this.rateTypePreview.textContent = `Rate ${this.rateTypeInput.value}`;
    }

    // ---- MODIFIED TO ENSURE FIREBASE RECEIPT NO IS LAST + 1 ----
    async getNextAvailableReceiptNo() {
        try {
            let receiptNo = 1;
            await walkinDb.runTransaction(async transaction => {
                const counterRef = walkinDb.collection("counters").doc("receiptCounter");
                const counterDoc = await transaction.get(counterRef);
                if (!counterDoc.exists) {
                    transaction.set(counterRef, { lastReceiptNo: receiptNo });
                } else {
                    receiptNo = counterDoc.data().lastReceiptNo + 1;
                    transaction.update(counterRef, { lastReceiptNo: receiptNo });
                }
            });
            return receiptNo;
        } catch {
            return 1;
        }
    }
    // -----------------------------------------------------------

    updateReceiptDisplay(receiptNo) {
        this.receiptNoHeader.textContent = receiptNo;
        this.receiptNoPreview.textContent = receiptNo;
    }

    saveToLocalStorage(paymentData) {
        const localReceipts = JSON.parse(localStorage.getItem('localReceipts') || '{}');
        localReceipts[paymentData.localReceiptNo] = paymentData;
        localStorage.setItem('localReceipts', JSON.stringify(localReceipts));
    }

    generateThermalReceipt(paymentData) {
        const now = new Date();
        const receiptContent = `
            <div id="thermalReceipt" style="width: 64mm; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.2; padding: 5px; background: white; color: black;">
                <div style="text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 5px;">
                    ${this.companyName.textContent}
                </div>
                <div style="text-align: center; font-size: 10px; margin-bottom: 5px;">
                    ${this.companyAddress.textContent}
                </div>
                <div style="text-align: center; font-size: 10px; margin-bottom: 8px;">
                    Tel: ${this.companyPhone.textContent}
                </div>
                <hr style="border: 1px dashed #000; margin: 5px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span>Receipt: #${paymentData.localReceiptNo}</span>
                    <span>${now.toLocaleDateString()}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span>${now.toLocaleTimeString()}</span>
                    <span>${this.cashierName}</span>
                </div>
                <hr style="border: 0.5px solid #000; margin: 5px 0;">
                <div style="margin-bottom: 3px;"><strong>Passenger:</strong> ${paymentData.name}</div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 3px;">
                    <span><strong>Flight:</strong> ${paymentData.flightNo}</span>
                    <span><strong>Seat:</strong> ${paymentData.seatNo || '-'}</span>
                </div>
                <div style="margin-bottom: 5px;"><strong>Airline:</strong> ${paymentData.airline}</div>
                <hr style="border: 0.5px solid #000; margin: 5px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>Adults (${paymentData.adults}):</span>
                    <span>${paymentData.currency} ${(paymentData.adultsTotal || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>Kids (${paymentData.kids}):</span>
                    <span>${paymentData.currency} ${(paymentData.kidsTotal || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>Subtotal:</span>
                    <span>${paymentData.currency} ${(paymentData.subtotal || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>GST:</span>
                    <span>${paymentData.currency} ${(paymentData.gst || 0).toFixed(2)}</span>
                </div>
                <hr style="border: 0.5px solid #000; margin: 5px 0;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 3px;">
                    <span>TOTAL:</span>
                    <span>${paymentData.currency} ${(paymentData.grandTotal || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>Paid:</span>
                    <span>${paymentData.currency} ${(paymentData.paid || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>Balance:</span>
                    <span>${paymentData.currency} ${(paymentData.balance || 0).toFixed(2)}</span>
                </div>
                <div style="margin-bottom: 3px;"><strong>Payment:</strong> ${paymentData.paymentType}</div>
                <hr style="border: 1px dashed #000; margin: 8px 0 5px 0;">
                <div style="text-align: center; font-size: 10px; margin-bottom: 5px;">
                    Thank you for your business!
                </div>
                <div style="text-align: center; font-size: 9px;">
                    ${now.toLocaleString()}
                </div>
            </div>
        `;
        return receiptContent;
    }

    printReceipt(receiptContent) {
        const printWindow = window.open('', '_blank', 'width=64mm,height=400,scrollbars=no,menubar=no,toolbar=no');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print Receipt</title>
                <style>
                    body { margin: 0; padding: 0; background: white; }
                    @media print {
                        body { margin: 0; padding: 0; }
                        @page { margin: 0; size: 64mm auto; }
                    }
                </style>
            </head>
            <body onload="window.print(); setTimeout(() => window.close(), 500);">
                ${receiptContent}
            </body>
            </html>
        `);
        printWindow.document.close();
    }

    async savePayment() {
        if (!this.nameField.value.trim() || !this.flightField.value.trim()) {
            alert("Please enter passenger name and flight number");
            return false;
        }

        const localReceiptNo = this.getNextLocalReceiptNo();
        const totals = this.calculate();
        if (!totals) return false;

        const paymentData = {
            localReceiptNo,
            receiptNo: null,
            date: new Date().toISOString(),
            cashier: this.cashierName,
            shift: this.currentShiftLabel,
            rateType: this.rateTypeInput.value,
            name: this.nameField.value.trim(),
            flightNo: this.flightField.value.trim(),
            seatNo: this.seatField.value.trim(),
            airline: this.airlineField.value || "Unknown",
            adults: parseInt(this.adultsInput.value) || 0,
            kids: parseInt(this.kidsInput.value) || 0,
            currency: this.currencyInput.value,
            paymentType: this.paymentTypeInput.value,
            paid: parseFloat(this.paidInput.value) || 0,
            balance: parseFloat(this.balanceInput.value) || 0,
            subtotal: totals.subtotal,
            gst: totals.gst,
            grandTotal: totals.grandTotal,
            adultsTotal: totals.adultsTotal,
            kidsTotal: totals.kidsTotal,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        this.saveToLocalStorage(paymentData);
        this.updateReceiptDisplay(localReceiptNo);
        const receiptContent = this.generateThermalReceipt(paymentData);
        this.printReceipt(receiptContent);

        // Save to Firebase in background
        try {
            const firebaseReceiptNo = await this.getNextAvailableReceiptNo();
            paymentData.receiptNo = firebaseReceiptNo;

            const localReceipts = JSON.parse(localStorage.getItem('localReceipts') || '{}');
            if (localReceipts[localReceiptNo]) {
                localReceipts[localReceiptNo].receiptNo = firebaseReceiptNo;
                localStorage.setItem('localReceipts', JSON.stringify(localReceipts));
            }

            await walkinDb.collection("payments").doc(firebaseReceiptNo.toString()).set(paymentData);
            console.log("Payment saved to Firebase with receipt:", firebaseReceiptNo);
        } catch (error) {
            console.error("Failed to save to Firebase:", error);
        }

        this.clearFormForNextEntry();
        return true;
    }

    clearFormForNextEntry() {
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

        setTimeout(() => {
            this.qrInput.focus();
        }, 100);

        this.calculate();
    }

    clearForm() {
        this.clearFormForNextEntry();
    }

    initializeEventListeners() {
        this.adultsInput.addEventListener('input', () => this.calculate());
        this.kidsInput.addEventListener('input', () => this.calculate());
        this.currencyInput.addEventListener('change', () => this.calculate());
        this.rateTypeInput.addEventListener('change', () => this.calculate());
        this.paymentTypeInput.addEventListener('change', () => { this.togglePaymentFields(); this.calculate(); });
        this.paidInput.addEventListener('input', () => this.calculate());

        this.qrInput.addEventListener('input', e => {
            const qr = e.target.value;
            const { name, flightNo, seatNo } = this.parseQR(qr);
            this.nameField.value = name;
            this.flightField.value = flightNo;
            this.seatField.value = seatNo;
            this.airlineField.value = this.getAirline(flightNo);
            this.calculate();
        });

        this.saveBtn.addEventListener('click', async () => {
            const success = await this.savePayment();
            if (success) console.log("Payment processed successfully!");
        });

        setTimeout(() => {
            if (this.qrInput) this.qrInput.focus();
        }, 500);
    }
}

document.addEventListener("DOMContentLoaded", () => {
    window.walkInApp = new WalkInPaymentApp();
});
