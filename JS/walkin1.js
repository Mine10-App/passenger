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
        this.clearBtn = document.getElementById('clearBtn');
        this.connectionStatus = document.getElementById('connectionStatus');

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
    }

    async initializeApp() {
        console.log("Initializing Walk-in Payment App...");
        this.initializeUser();
        this.updateCurrentDate();
        this.togglePaymentFields();
        await this.fetchCurrentShift();
        this.initializeEventListeners();
        this.initializeLocalReceiptNo();
        this.setupQRInputMask();
        this.calculate(); // Initial calculation
        
        // Focus on QR input for quick scanning
        setTimeout(() => {
            if (this.qrInput) {
                this.qrInput.focus();
                console.log("QR input focused");
            }
        }, 500);
    }

    setupQRInputMask() {
        if (this.qrInput) {
            this.qrInput.type = 'text';
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
            if (this.currentCashier) {
                this.currentCashier.textContent = this.cashierName;
            }
        } else {
            console.warn("No user logged in, redirecting to login page");
            window.location.href = "login.html";
        }
    }

    updateCurrentDate() {
        const now = new Date();
        if (this.currentDateHeader) {
            this.currentDateHeader.textContent = now.toLocaleDateString();
        }
    }

    togglePaymentFields() {
        if (!this.paymentTypeInput || !this.cashFieldsDiv) return;
        
        const isCard = this.paymentTypeInput.value === "Card";
        this.cashFieldsDiv.style.display = isCard ? "none" : "block";
        
        if (isCard) {
            const totals = this.calculate();
            if (totals && this.paidInput) {
                this.paidInput.value = totals.grandTotal.toFixed(2);
            }
            if (this.balanceInput) {
                this.balanceInput.value = "0.00";
            }
        }
    }

    // ---------- QR PARSER (Remove Last 6 Letters from Name) ----------
    parseQR(code) {
        code = code.trim().toUpperCase().replace(/\s+/g, ' ');
        let name = "", flightNo = "", seatNo = "", fqtv = "";
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
            // ----- NAME FIX -----
            const mleIndex = allParts.findIndex(w => w.includes("MLE"));
            if (mleIndex > 0) {
                // Join everything from the first word (without "M1") up to before "MLE"
                let nameParts = allParts.slice(0, mleIndex);
                nameParts[0] = nameParts[0].substring(2); // remove "M1"
                name = nameParts.join(' ').trim();
            } else {
                name = allParts[0].substring(2); // fallback
            }

            // ----- REMOVE LAST 6 CHARACTERS FROM NAME -----
            if (name.length > 6) {
                name = name.substring(0, name.length - 6).trim();
            }

            // ----- FLIGHT / SEAT -----
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

        console.log("Parsed QR data:", { name, flightNo, seatNo });
        return { name, flightNo, seatNo };
    }

    getAirline(flightNo) {
        if (!flightNo || flightNo.length < 2) return "Unknown";
        
        const code = flightNo.substring(0, 2).toUpperCase();
        const iata = {
            "BA": "British Airways", "TK": "Turkish Airlines", "QR": "Qatar Airways", 
            "EK": "Emirates", "EY": "Etihad Airways", "LH": "Lufthansa", 
            "AF": "Air France", "KL": "KLM", "AA": "American Airlines",
            "UA": "United Airlines", "DL": "Delta Air Lines", "SQ": "Singapore Airlines",
            "CX": "Cathay Pacific", "NH": "All Nippon Airways", "JL": "Japan Airlines",
            "KE": "Korean Air", "PG": "Bangkok Airways", "TG": "Thai Airways",
            "MH": "Malaysia Airlines", "GA": "Garuda Indonesia", "QF": "Qantas",
            "NZ": "Air New Zealand", "AC": "Air Canada", "LX": "Swiss International Air Lines",
            "OS": "Austrian Airlines", "SN": "Brussels Airlines", "SK": "SAS Scandinavian Airlines",
            "AY": "Finnair", "LO": "LOT Polish Airlines", "SU": "Aeroflot",
            "AZ": "Alitalia", "IB": "Iberia", "Q2": "Maldivian", "SV": "Saudia",
            "ET": "Ethiopian Airlines", "MS": "EgyptAir", "RJ": "Royal Jordanian",
            "OD": "Batik Air", "JD": "Beijing Capital Airlines", "UL": "Srilankan Airlines"
        };
        
        return iata[code] || "Unknown";
    }

    async fetchCurrentShift() {
        try {
            if (!db) {
                console.warn("Firebase not initialized");
                this.updateShiftInfo(null);
                return;
            }
            
            const snapshot = await db.collection("shifts").limit(1).get();
            if (!snapshot.empty) {
                this.updateShiftInfo(snapshot.docs[0].data());
            } else {
                this.updateShiftInfo(null);
            }
        } catch (error) {
            console.error("Error fetching shift:", error);
            this.updateShiftInfo(null);
        }
    }

    updateShiftInfo(data) {
        if (!data) {
            this.currentShiftLabel = "No Shift Open";
        } else if (data.shift1?.status === "Open") {
            this.currentShiftLabel = "Morning Shift";
        } else if (data.shift2?.status === "Open") {
            this.currentShiftLabel = "Evening Shift";
        } else {
            this.currentShiftLabel = "No Shift Open";
        }

        if (this.shiftNameHeader) {
            this.shiftNameHeader.textContent = this.currentShiftLabel;
        }
    }

    calculate() {
        try {
            const adults = parseInt(this.adultsInput.value) || 0;
            const kids = parseInt(this.kidsInput.value) || 0;
            const currency = this.currencyInput.value;
            const rateType = this.rateTypeInput.value;
            const paid = parseFloat(this.paidInput.value) || 0;

            this.updatePassengerCounts(adults, kids);

            // Check if rates are available
            if (typeof rates === 'undefined') {
                console.error("Rates not loaded");
                this.showError("Rates configuration not loaded. Please check rate.js");
                return null;
            }

            // Get rates based on type and currency
            const adultRateKey = `Adult${rateType}${currency}`;
            const kidsRateKey = `Kids${rateType}${currency}`;
            
            console.log("Looking for rates:", adultRateKey, kidsRateKey);
            console.log("Available rates:", rates);

            const adultRate = rates[adultRateKey];
            const kidsRate = rates[kidsRateKey];
            
            if (!adultRate || !kidsRate) {
                console.error("Rates not found:", { adultRate, kidsRate });
                this.showError(`Rates not configured for ${rateType}${currency}`);
                return null;
            }

            console.log("Found rates:", { adultRate, kidsRate });

            // Calculate amounts
            const adultsTotal = adults * adultRate.price;
            const kidsTotal = kids * kidsRate.price;
            const subtotal = adultsTotal + kidsTotal;
            const gst = subtotal * (adultRate.GST / 100);
            const grandTotal = subtotal + gst;

            // Calculate balance
            let balance = 0;
            if (this.paymentTypeInput.value === "Card") {
                balance = 0;
            } else {
                balance = paid - grandTotal;
            }
            
            if (this.balanceInput) {
                this.balanceInput.value = balance.toFixed(2);
            }

            this.updateSummaryDisplay(adults, kids, adultsTotal, kidsTotal, subtotal, gst, grandTotal, currency);
            return { adultsTotal, kidsTotal, subtotal, gst, grandTotal };
            
        } catch (error) {
            console.error("Calculation error:", error);
            this.showError("Error in calculation. Please check inputs.");
            return null;
        }
    }

    showError(message) {
        // Simple error display - you can enhance this with a proper notification system
        console.error("Error:", message);
        alert(message); // Temporary - replace with better UI notification
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
        if (this.receiptNoHeader) {
            this.receiptNoHeader.textContent = receiptNo;
        }
    }

    saveToLocalStorage(paymentData) {
        try {
            const localReceipts = JSON.parse(localStorage.getItem('localReceipts') || '{}');
            localReceipts[paymentData.localReceiptNo] = paymentData;
            localStorage.setItem('localReceipts', JSON.stringify(localReceipts));
            console.log("Saved to localStorage:", paymentData);
        } catch (error) {
            console.error("Error saving to localStorage:", error);
        }
    }

    generateThermalReceipt(paymentData) {
        const now = new Date();
        const symbol = paymentData.currency === 'USD' ? '$' : 'ރ';
        
        return `
            <div id="thermalReceipt" style="width: 64mm; font-family: 'Courier New', monospace; font-size: 12px; line-height: 1.2; padding: 5px; background: white; color: black;">
                <div style="text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 5px;">
                    KOVELI LOUNGE
                </div>
                <div style="text-align: center; font-size: 10px; margin-bottom: 5px;">
                    Velana International Airport
                </div>
                <div style="text-align: center; font-size: 10px; margin-bottom: 8px;">
                    Tel: +960 304 6677
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
                    <span>${symbol}${(paymentData.adultsTotal || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>Kids (${paymentData.kids}):</span>
                    <span>${symbol}${(paymentData.kidsTotal || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>Subtotal:</span>
                    <span>${symbol}${(paymentData.subtotal || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>GST:</span>
                    <span>${symbol}${(paymentData.gst || 0).toFixed(2)}</span>
                </div>
                <hr style="border: 0.5px solid #000; margin: 5px 0;">
                <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 3px;">
                    <span>TOTAL:</span>
                    <span>${symbol}${(paymentData.grandTotal || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
                    <span>Paid:</span>
                    <span>${symbol}${(paymentData.paid || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <span>Balance:</span>
                    <span>${symbol}${(paymentData.balance || 0).toFixed(2)}</span>
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
    }

    printReceipt(receiptContent) {
        try {
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
        } catch (error) {
            console.error("Print error:", error);
            alert("Could not open print window. Please check popup blocker.");
        }
    }

    async savePayment() {
        // Validate required fields
        if (!this.nameField.value.trim()) {
            alert("Please enter passenger name");
            this.nameField.focus();
            return false;
        }

        if (!this.flightField.value.trim()) {
            alert("Please enter flight number");
            this.flightField.focus();
            return false;
        }

        const totals = this.calculate();
        if (!totals) {
            alert("Error in calculation. Please check the rates configuration.");
            return false;
        }

        const localReceiptNo = this.getNextLocalReceiptNo();
        
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
            createdAt: new Date().toISOString()
        };

        // Save locally
        this.saveToLocalStorage(paymentData);
        this.updateReceiptDisplay(localReceiptNo);
        
        // Generate and print receipt
        const receiptContent = this.generateThermalReceipt(paymentData);
        this.printReceipt(receiptContent);

        // Save to Firebase in background (if available)
        try {
            if (typeof walkinDb !== 'undefined') {
                const firebaseReceiptNo = await this.getNextAvailableReceiptNo();
                paymentData.receiptNo = firebaseReceiptNo;

                // Update local storage with Firebase receipt number
                const localReceipts = JSON.parse(localStorage.getItem('localReceipts') || '{}');
                if (localReceipts[localReceiptNo]) {
                    localReceipts[localReceiptNo].receiptNo = firebaseReceiptNo;
                    localStorage.setItem('localReceipts', JSON.stringify(localReceipts));
                }

                await walkinDb.collection("payments").doc(firebaseReceiptNo.toString()).set(paymentData);
                console.log("Payment saved to Firebase with receipt:", firebaseReceiptNo);
            }
        } catch (error) {
            console.error("Failed to save to Firebase:", error);
        }

        this.clearFormForNextEntry();
        return true;
    }

    async getNextAvailableReceiptNo() {
        try {
            if (typeof walkinDb === 'undefined') return 1;
            
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
        } catch (error) {
            console.error("Error getting receipt number:", error);
            return 1;
        }
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

        // Reset to default values
        this.currencyInput.value = "USD";
        this.rateTypeInput.value = "A";
        this.paymentTypeInput.value = "Cash";

        // Focus back on QR input for next entry
        setTimeout(() => {
            this.qrInput.focus();
        }, 100);

        // Recalculate
        this.calculate();
    }

    clearForm() {
        this.clearFormForNextEntry();
    }

    initializeEventListeners() {
        // Calculation triggers
        this.adultsInput.addEventListener('input', () => this.calculate());
        this.kidsInput.addEventListener('input', () => this.calculate());
        this.currencyInput.addEventListener('change', () => this.calculate());
        this.rateTypeInput.addEventListener('change', () => this.calculate());
        this.paymentTypeInput.addEventListener('change', () => { 
            this.togglePaymentFields(); 
            this.calculate(); 
        });
        this.paidInput.addEventListener('input', () => this.calculate());

        // QR code processing
        this.qrInput.addEventListener('input', (e) => {
            const qr = e.target.value;
            if (qr.length > 5) { // Only process if we have substantial input
                const { name, flightNo, seatNo } = this.parseQR(qr);
                this.nameField.value = name;
                this.flightField.value = flightNo;
                this.seatField.value = seatNo;
                this.airlineField.value = this.getAirline(flightNo);
                this.calculate();
            }
        });

        // Save button
        this.saveBtn.addEventListener('click', async () => {
            this.saveBtn.disabled = true;
            this.saveBtn.textContent = "Processing...";
            
            try {
                const success = await this.savePayment();
                if (success) {
                    console.log("Payment processed successfully!");
                }
            } catch (error) {
                console.error("Error processing payment:", error);
                alert("Error processing payment. Please try again.");
            } finally {
                this.saveBtn.disabled = false;
                this.saveBtn.textContent = "💾 Save & Print Receipt";
            }
        });

        // Clear button
        if (this.clearBtn) {
            this.clearBtn.addEventListener('click', () => this.clearForm());
        }

        // Dashboard buttons
        const dashboardBtn = document.getElementById('dashboardBtn');
        const reportsBtn = document.getElementById('reportsBtn');
        const settingsBtn = document.getElementById('settingsBtn');

        if (dashboardBtn) {
            dashboardBtn.addEventListener('click', () => {
                window.location.href = "dashboard.html";
            });
        }

        if (reportsBtn) {
            reportsBtn.addEventListener('click', () => {
                window.location.href = "reports.html";
            });
        }

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                window.location.href = "settings.html";
            });
        }

        console.log("Event listeners initialized");
    }
}

// Initialize the application when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded, initializing Walk-in Payment App");
    window.walkInApp = new WalkInPaymentApp();
});

// Fallback initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.walkInApp = new WalkInPaymentApp();
    });
} else {
    window.walkInApp = new WalkInPaymentApp();
}