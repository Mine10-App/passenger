// Cash Count Report JavaScript - Firebase Connected
class CashCountReport {
    constructor() {
        // Denominations
        this.mvrDenoms = [1000, 500, 100, 50, 20, 10, 5, 2, 1];
        this.usdDenoms = [100, 50, 20, 10, 5, 1];
        this.pettyMvrDenoms = [1000, 500, 100, 50, 20, 10, 5, 2, 1];
        this.pettyUsdDenoms = [100, 50, 20, 10, 5, 1];
        
        // System totals and presets
        this.systemMvr = 0;
        this.systemUsd = 0;
        this.pettySetMvr = 500;
        this.pettySetUsd = 100;
        
        // Current user and shift status
        this.currentUser = JSON.parse(localStorage.getItem("loggedInUser"))?.username || "Unknown";
        this.currentShiftStatus = "Not Opened";
        
        // Track if data has been saved
        this.hasBeenSaved = false;
        
        // Initialize the application
        this.init();
    }
    
    init() {
        console.log("Initializing Cash Count Report...");
        
        // Set company name immediately
        document.getElementById("companyName").textContent = companyInfo?.name || "Company";
        
        // Show immediate basic info
        this.showImmediateInfo();
        
        // Create denomination displays
        this.createDenominationSections();
        
        // Add event listeners
        this.addEventListeners();
        
        // Fetch current shift and load from localStorage
        this.fetchCurrentShiftAndLoadData();
    }
    
    showImmediateInfo() {
        const today = new Date();
        const todayStr = today.toLocaleDateString();
        const shiftName = this.getDefaultShiftName();
        
        document.getElementById("currentDate").textContent = todayStr;
        document.getElementById("currentShift").textContent = shiftName;
        document.getElementById("currentCashierInfo").textContent = this.currentUser;
        document.getElementById("shiftStatus").textContent = "Loading...";
        
        // Set preset values immediately
        document.getElementById("pettyMvrPreset").textContent = this.pettySetMvr.toFixed(2);
        document.getElementById("pettyUsdPreset").textContent = this.pettySetUsd.toFixed(2);
        document.getElementById("pettyMvrPreset2").textContent = this.pettySetMvr.toFixed(2);
        document.getElementById("pettyUsdPreset2").textContent = this.pettySetUsd.toFixed(2);
    }
    
    getDefaultShiftName() {
        const now = new Date();
        const hour = now.getHours();
        return hour < 12 ? "Morning Shift" : "Evening Shift";
    }
    
    createDenominationSections() {
        this.createDenominationSection("mvrDenominations", this.mvrDenoms);
        this.createDenominationSection("usdDenominations", this.usdDenoms);
        this.createDenominationSection("pettyMvrDenominations", this.pettyMvrDenoms);
        this.createDenominationSection("pettyUsdDenominations", this.pettyUsdDenoms);
    }
    
    createDenominationSection(containerId, denoms) {
        const container = document.getElementById(containerId);
        container.innerHTML = "";
        
        denoms.forEach(val => {
            const denomItem = document.createElement("div");
            denomItem.className = "denom-item";
            denomItem.innerHTML = `
                <div class="denom-formula">
                    <span class="denom-value">${val}</span>
                    <span>×</span>
                    <input type="number" min="0" value="0" class="denom-input" data-denom="${val}">
                    <span class="denom-equals">=</span>
                    <span class="denom-total">0.00</span>
                </div>
            `;
            container.appendChild(denomItem);
        });
    }
    
    addEventListeners() {
        // Listen to input changes
        document.querySelectorAll(".denom-input").forEach(input => {
            input.addEventListener("input", () => {
                clearTimeout(this.calcTimeout);
                this.calcTimeout = setTimeout(() => {
                    this.calcTotals();
                }, 300);
            });
        });
        
        // Button events
        document.getElementById("saveCashCountBtn").addEventListener("click", () => this.saveToLocalStorage());
        document.getElementById("openShiftBtn").addEventListener("click", () => this.updateShiftStatus("Open"));
        document.getElementById("closeShiftBtn").addEventListener("click", () => this.updateShiftStatus("Close"));
    }
    
    async fetchCurrentShiftAndLoadData() {
        try {
            const todayStr = new Date().toISOString().slice(0, 10);
            const shiftName = await this.getCurrentShiftName();
            
            // Update UI with shift info
            document.getElementById("currentShift").textContent = shiftName;
            
            // Get system totals from Firebase payments - same day, same shift, cash payments only
            const systemTotals = await this.getSystemCashTotals(todayStr, shiftName);
            this.systemMvr = systemTotals.mvr;
            this.systemUsd = systemTotals.usd;
            
            document.getElementById("sysMvr").textContent = this.systemMvr.toFixed(2);
            document.getElementById("sysUsd").textContent = this.systemUsd.toFixed(2);
            document.getElementById("sysMvr2").textContent = this.systemMvr.toFixed(2);
            document.getElementById("sysUsd2").textContent = this.systemUsd.toFixed(2);
            
            // Load from localStorage
            this.loadFromLocalStorage(todayStr, shiftName);
            
            // Get current shift status from Firebase
            await this.getCurrentShiftStatus(todayStr, shiftName);
            
            this.calcTotals();
            
        } catch (err) {
            console.error("Error initializing:", err);
            this.handleDataLoadError();
        }
    }
    
    async getCurrentShiftName() {
        try {
            if (!db) return this.getDefaultShiftName();
            
            const snapshot = await db.collection("shifts").limit(1).get();
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                if (data.shift1?.status === "Open") return "Morning Shift";
                if (data.shift2?.status === "Open") return "Evening Shift";
            }
            return this.getDefaultShiftName();
        } catch (err) {
            console.error("Error getting shift name:", err);
            return this.getDefaultShiftName();
        }
    }
    
    async getSystemCashTotals(dateStr, shiftName) {
        try {
            console.log(`Fetching cash sales for date: ${dateStr}, shift: ${shiftName}`);
            
            const paymentsSnap = await walkinDb.collection("payments")
                .where("shift", "==", shiftName)
                .where("paymentType", "==", "Cash")
                .get();
                
            let systemMvr = 0;
            let systemUsd = 0;
            
            paymentsSnap.forEach(doc => {
                const payment = doc.data();
                const paymentDate = new Date(payment.date);
                const paymentDateStr = paymentDate.toISOString().slice(0, 10);
                
                // Check if payment is from the same date
                if (paymentDateStr === dateStr) {
                    if (payment.currency === "MVR") {
                        systemMvr += payment.grandTotal || 0;
                        console.log(`MVR Payment: ${payment.grandTotal}, Total: ${systemMvr}`);
                    } else if (payment.currency === "USD") {
                        systemUsd += payment.grandTotal || 0;
                        console.log(`USD Payment: ${payment.grandTotal}, Total: ${systemUsd}`);
                    }
                }
            });
            
            console.log(`Final totals - MVR: ${systemMvr}, USD: ${systemUsd}`);
            return { mvr: systemMvr, usd: systemUsd };
            
        } catch (err) {
            console.error("Error getting system cash totals:", err);
            return { mvr: 0, usd: 0 };
        }
    }
    
    async getCurrentShiftStatus(dateStr, shiftName) {
        try {
            const querySnap = await walkinDb.collection("cashier")
                .where("username", "==", this.currentUser)
                .where("date", "==", dateStr)
                .where("shift", "==", shiftName)
                .limit(1)
                .get();
                
            if (!querySnap.empty) {
                const data = querySnap.docs[0].data();
                this.currentShiftStatus = data.status;
                this.updateStatusDisplay(data.status);
            } else {
                this.currentShiftStatus = "Not Opened";
                this.updateStatusDisplay("Not Opened");
            }
            
        } catch (err) {
            console.error("Error getting shift status:", err);
            this.currentShiftStatus = "Not Opened";
            this.updateStatusDisplay("Not Opened");
        }
    }
    
    updateStatusDisplay(status) {
        const statusElement = document.getElementById("shiftStatus");
        statusElement.textContent = status;
        
        // Update status badge class
        statusElement.className = "status-badge";
        if (status === "Open") {
            statusElement.classList.add("status-open");
        } else if (status === "Close") {
            statusElement.classList.add("status-closed");
        } else {
            statusElement.classList.add("status-not-opened");
        }
    }
    
    loadFromLocalStorage(dateStr, shiftName) {
        const storageKey = `cashCount_${this.currentUser}_${dateStr}_${shiftName}`;
        const savedData = localStorage.getItem(storageKey);
        
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.prefillDenominations("mvrDenominations", data.mvrCounts);
                this.prefillDenominations("usdDenominations", data.usdCounts);
                this.prefillDenominations("pettyMvrDenominations", data.pettyMvrCounts);
                this.prefillDenominations("pettyUsdDenominations", data.pettyUsdCounts);
                this.hasBeenSaved = true;
                console.log("Loaded data from localStorage");
            } catch (err) {
                console.error("Error loading from localStorage:", err);
            }
        }
    }
    
    saveToLocalStorage() {
        const todayStr = new Date().toISOString().slice(0, 10);
        const shiftName = document.getElementById("currentShift").textContent;
        
        const storageKey = `cashCount_${this.currentUser}_${todayStr}_${shiftName}`;
        
        const dataToSave = {
            mvrCounts: this.getCounts("mvrDenominations"),
            usdCounts: this.getCounts("usdDenominations"),
            pettyMvrCounts: this.getCounts("pettyMvrDenominations"),
            pettyUsdCounts: this.getCounts("pettyUsdDenominations"),
            timestamp: new Date().toISOString()
        };
        
        localStorage.setItem(storageKey, JSON.stringify(dataToSave));
        this.hasBeenSaved = true;
        console.log("Saved to localStorage");
        
        // Show confirmation
        this.showSaveConfirmation();
    }
    
    showSaveConfirmation() {
        const saveIndicator = document.getElementById("saveIndicator");
        saveIndicator.classList.add("show");
        
        setTimeout(() => {
            saveIndicator.classList.remove("show");
        }, 2000);
    }
    
    prefillDenominations(containerId, savedObj) {
        if (!savedObj) return;
        
        document.querySelectorAll(`#${containerId} .denom-input`).forEach(input => {
            const denom = input.getAttribute("data-denom");
            if (savedObj[denom] !== undefined) {
                input.value = savedObj[denom];
            }
        });
    }
    
    calcTotals() {
        const totals = { 
            mvr: 0, 
            usd: 0, 
            pettyMvr: 0, 
            pettyUsd: 0 
        };
        
        const containers = [
            ["mvrDenominations", "mvrTotal", "sumMvr", "mvr"],
            ["usdDenominations", "usdTotal", "sumUsd", "usd"],
            ["pettyMvrDenominations", "pettyMvrTotal", "sumPettyMvr", "pettyMvr"],
            ["pettyUsdDenominations", "pettyUsdTotal", "sumPettyUsd", "pettyUsd"]
        ];
        
        containers.forEach(([containerId, totalId, sumId, key]) => {
            let total = 0;
            document.querySelectorAll(`#${containerId} .denom-item`).forEach(item => {
                const denom = parseInt(item.querySelector(".denom-value").textContent);
                const count = parseInt(item.querySelector(".denom-input").value) || 0;
                const rowTotal = denom * count;
                item.querySelector(".denom-total").textContent = rowTotal.toFixed(2);
                total += rowTotal;
            });
            document.getElementById(totalId).textContent = total.toFixed(2);
            document.getElementById(sumId).textContent = total.toFixed(2);
            totals[key] = total;
        });
        
        this.updateSummaryItems(totals);
        this.updateButtons(totals);
    }
    
    updateSummaryItems({mvr, usd, pettyMvr, pettyUsd}) {
        // Update MVR summary
        const mvrSummary = document.getElementById("summaryMvr");
        mvrSummary.className = "summary-item";
        if (mvr >= this.systemMvr) {
            mvrSummary.classList.add("ok");
        } else {
            mvrSummary.classList.add("warn");
        }
        
        // Update USD summary
        const usdSummary = document.getElementById("summaryUsd");
        usdSummary.className = "summary-item";
        if (usd >= this.systemUsd) {
            usdSummary.classList.add("ok");
        } else {
            usdSummary.classList.add("warn");
        }
        
        // Update Petty MVR summary
        const pettyMvrSummary = document.getElementById("summaryPettyMvr");
        pettyMvrSummary.className = "summary-item";
        if (pettyMvr >= this.pettySetMvr) {
            pettyMvrSummary.classList.add("ok");
        } else {
            pettyMvrSummary.classList.add("warn");
        }
        
        // Update Petty USD summary
        const pettyUsdSummary = document.getElementById("summaryPettyUsd");
        pettyUsdSummary.className = "summary-item";
        if (pettyUsd >= this.pettySetUsd) {
            pettyUsdSummary.classList.add("ok");
        } else {
            pettyUsdSummary.classList.add("warn");
        }
    }
    
    updateButtons({mvr, usd, pettyMvr, pettyUsd}) {
        const openBtn = document.getElementById("openShiftBtn");
        const closeBtn = document.getElementById("closeShiftBtn");
        
        const enoughCash = mvr >= this.systemMvr && 
                           usd >= this.systemUsd &&
                           pettyMvr >= this.pettySetMvr && 
                           pettyUsd >= this.pettySetUsd;
        
        if (this.currentShiftStatus === "Open") {
            openBtn.disabled = true;
            openBtn.textContent = "Already Opened";
            closeBtn.disabled = !enoughCash;
            closeBtn.textContent = "Close Cashier";
        } else if (this.currentShiftStatus === "Close") {
            openBtn.disabled = !enoughCash;
            openBtn.textContent = "Open Cashier";
            closeBtn.disabled = true;
            closeBtn.textContent = "Already Closed";
        } else { // Not Opened
            openBtn.disabled = !enoughCash;
            openBtn.textContent = "Open Cashier";
            closeBtn.disabled = true;
            closeBtn.textContent = "Close Cashier";
        }
    }
    
    async updateShiftStatus(status) {
        try {
            const todayStr = new Date().toISOString().slice(0, 10);
            const shiftName = document.getElementById("currentShift").textContent;
            
            // Check if we have enough cash
            const totals = this.getCurrentTotals();
            const enoughCash = totals.mvr >= this.systemMvr && 
                              totals.usd >= this.systemUsd &&
                              totals.pettyMvr >= this.pettySetMvr && 
                              totals.pettyUsd >= this.pettySetUsd;
            
            if (!enoughCash) {
                alert("Not enough cash! Please count properly before opening/closing cashier.");
                return;
            }
            
            // Save to localStorage ONLY when opening/closing shift
            this.saveToLocalStorage();
            
            // Update to Firebase - only username and status
            const querySnap = await walkinDb.collection("cashier")
                .where("username", "==", this.currentUser)
                .where("date", "==", todayStr)
                .where("shift", "==", shiftName)
                .limit(1)
                .get();
                
            const firebaseData = {
                username: this.currentUser,
                date: todayStr,
                shift: shiftName,
                status: status,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            if (querySnap.empty) {
                await walkinDb.collection("cashier").add(firebaseData);
            } else {
                await walkinDb.collection("cashier").doc(querySnap.docs[0].id).update(firebaseData);
            }
            
            // Update local status
            this.currentShiftStatus = status;
            this.updateStatusDisplay(status);
            
            alert(`Cashier ${status.toLowerCase()}d successfully!`);
            
            this.calcTotals(); // Refresh buttons
            
        } catch (err) {
            console.error("Error updating cashier status:", err);
            alert("Error updating shift status. Please check console for details.");
        }
    }
    
    getCounts(containerId) {
        const obj = {};
        document.querySelectorAll(`#${containerId} .denom-item`).forEach(item => {
            const denom = item.querySelector(".denom-value").textContent;
            const count = parseInt(item.querySelector(".denom-input").value) || 0;
            obj[denom] = count;
        });
        return obj;
    }
    
    getCurrentTotals() {
        const totals = { mvr: 0, usd: 0, pettyMvr: 0, pettyUsd: 0 };
        
        document.querySelectorAll("#mvrDenominations .denom-item").forEach(item => {
            totals.mvr += parseFloat(item.querySelector(".denom-total").textContent) || 0;
        });
        document.querySelectorAll("#usdDenominations .denom-item").forEach(item => {
            totals.usd += parseFloat(item.querySelector(".denom-total").textContent) || 0;
        });
        document.querySelectorAll("#pettyMvrDenominations .denom-item").forEach(item => {
            totals.pettyMvr += parseFloat(item.querySelector(".denom-total").textContent) || 0;
        });
        document.querySelectorAll("#pettyUsdDenominations .denom-item").forEach(item => {
            totals.pettyUsd += parseFloat(item.querySelector(".denom-total").textContent) || 0;
        });
        
        return totals;
    }
    
    handleDataLoadError() {
        document.getElementById("currentCashierInfo").textContent = this.currentUser;
        document.getElementById("shiftStatus").textContent = "Error Loading";
        document.getElementById("shiftStatus").className = "status-badge status-not-opened";
        
        // Set system totals to 0 on error
        document.getElementById("sysMvr").textContent = "0.00";
        document.getElementById("sysUsd").textContent = "0.00";
        document.getElementById("sysMvr2").textContent = "0.00";
        document.getElementById("sysUsd2").textContent = "0.00";
    }
}

// Initialize the application when DOM is loaded
window.addEventListener("DOMContentLoaded", () => {
    new CashCountReport();
});

// Store instance globally for debugging
window.cashCountInstance = new CashCountReport();