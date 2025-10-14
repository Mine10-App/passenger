class PaymentApproval {
    constructor() {
        this.walkinDb = window.walkinDb;
        this.currentTransaction = null;
        this.currentUser = JSON.parse(localStorage.getItem("loggedInUser")) || {};
        this.isSupervisor = false;
        this.hasSupervisorAccess = false;
        this.supervisorPassword = "super123"; // Fallback password
        
        this.init();
    }

    async init() {
        if (!this.walkinDb) {
            this.showError('Database not initialized. Please check your connection.');
            return;
        }

        await this.checkUserLevel();
        this.bindEvents();
        this.focusSearch();
        this.displayUserInfo();
    }

    async checkUserLevel() {
        try {
            // Get current logged in user
            const currentUsername = this.currentUser.username;
            
            if (!currentUsername) {
                console.log('No user logged in');
                return;
            }

            // Check if users array is available from user.js
            if (typeof users !== 'undefined' && Array.isArray(users)) {
                const user = users.find(u => u.username === currentUsername);
                if (user) {
                    this.isSupervisor = user.Level === 'Supervisor';
                    console.log(`User ${currentUsername} is ${this.isSupervisor ? 'Supervisor' : 'User'}`);
                    return;
                }
            }

            // Fallback: Check user level from localStorage or default to User
            this.isSupervisor = this.currentUser.level === 'Supervisor' || this.currentUser.Level === 'Supervisor';
            
        } catch (error) {
            console.error('Error checking user level:', error);
            this.isSupervisor = false;
        }
    }

    displayUserInfo() {
        const userInfo = document.getElementById('userInfo');
        const level = this.isSupervisor ? 'Supervisor' : 'User';
        userInfo.innerHTML = `User: ${this.currentUser.username || 'Unknown'} | Level: ${level}`;
        
        // Show supervisor controls if supervisor
        if (this.isSupervisor) {
            const supervisorControls = document.getElementById('supervisorControls');
            if (supervisorControls) {
                supervisorControls.style.display = 'flex';
            }
        }
    }

    bindEvents() {
        // Search functionality
        document.getElementById('searchBtn').addEventListener('click', () => this.searchTransaction());
        document.getElementById('receiptSearch').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.searchTransaction();
        });

        // Action buttons
        document.getElementById('saveBtn').addEventListener('click', () => this.saveTransaction());
        document.getElementById('voidBtn').addEventListener('click', () => this.showVoidModal());
        document.getElementById('newSearchBtn').addEventListener('click', () => this.resetSearch());

        // Supervisor controls
        const fetchDataBtn = document.getElementById('fetchDataBtn');
        if (fetchDataBtn) {
            fetchDataBtn.addEventListener('click', () => this.fetchAdditionalData());
        }
        
        // Modal events
        document.querySelectorAll('.close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => this.hideAllModals());
        });
        
        document.getElementById('cancelVoid').addEventListener('click', () => this.hideAllModals());
        document.getElementById('confirmVoid').addEventListener('click', () => this.voidTransaction());
        
        document.getElementById('cancelPassword').addEventListener('click', () => this.hideAllModals());
        document.getElementById('confirmPassword').addEventListener('click', () => this.verifySupervisorPassword());

        // Close modals when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.hideAllModals();
            });
        });

        // Auto-save when payment fields change (with debounce)
        this.setupAutoSave();
    }

    setupAutoSave() {
        let saveTimeout;

        // This will be set up dynamically after data is loaded
        const setupPaymentFieldsAutoSave = () => {
            const paymentFields = ['approvalCode', 'batchNo', 'paymentType', 'paid'];
            paymentFields.forEach(fieldId => {
                const field = document.getElementById(fieldId);
                if (field) {
                    field.addEventListener('input', () => {
                        clearTimeout(saveTimeout);
                        // Show saving indicator
                        this.showSavingIndicator();
                        
                        saveTimeout = setTimeout(() => {
                            this.autoSavePaymentFields();
                        }, 2000); // Save after 2 seconds of inactivity
                    });
                }
            });
        };

        // Re-setup auto-save when new transaction is loaded
        this.setupPaymentFieldsAutoSave = setupPaymentFieldsAutoSave;
    }

    showSavingIndicator() {
        const saveBtn = document.getElementById('saveBtn');
        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="btn-icon">⏳</i>Saving...';
        
        setTimeout(() => {
            saveBtn.innerHTML = originalText;
        }, 2000);
    }

    async autoSavePaymentFields() {
        if (!this.currentTransaction) return;

        // Validate payment fields before saving
        if (!this.validatePaymentFields()) {
            return;
        }

        try {
            const updates = {
                paymentType: document.getElementById('paymentType')?.value || this.currentTransaction.paymentType,
                approvalCode: document.getElementById('approvalCode')?.value?.trim() || '',
                batchNo: document.getElementById('batchNo')?.value?.trim() || '',
                paid: parseFloat(document.getElementById('paid')?.value) || this.currentTransaction.paid || 0,
                updatedAt: new Date()
            };

            await this.walkinDb.collection('payments')
                .doc(this.currentTransaction.id)
                .update(updates);

            // Update local data
            this.currentTransaction = {
                ...this.currentTransaction,
                ...updates
            };

            this.updateReceiptBadge();
            this.showToast('Payment details saved automatically', 'success');
            
        } catch (error) {
            console.error('Auto-save error:', error);
            this.showToast('Error saving payment details', 'error');
        }
    }

    validatePaymentFields() {
        const approvalCode = document.getElementById('approvalCode')?.value?.trim();
        const batchNo = document.getElementById('batchNo')?.value?.trim();
        const amount = parseFloat(document.getElementById('paid')?.value) || 0;
        const grandTotal = parseFloat(this.currentTransaction?.grandTotal) || 0;

        if (!approvalCode) {
            this.showToast('Please enter approval code', 'warning');
            return false;
        }

        if (!batchNo) {
            this.showToast('Please enter batch number', 'warning');
            return false;
        }

        if (amount < grandTotal) {
            this.showToast('Amount paid cannot be less than total', 'warning');
            return false;
        }

        return true;
    }

    focusSearch() {
        document.getElementById('receiptSearch').focus();
    }

    async searchTransaction() {
        const receiptInput = document.getElementById('receiptSearch').value.trim();
        
        if (!receiptInput) {
            this.showError('Please enter a receipt number');
            return;
        }

        // Convert to number since receiptNo is stored as number
        const receiptNo = parseInt(receiptInput);
        if (isNaN(receiptNo)) {
            this.showError('Please enter a valid receipt number');
            return;
        }

        this.showLoading();
        this.hideTransaction();
        this.hideEmptyState();

        try {
            // Single Firebase read operation
            const snapshot = await this.walkinDb.collection('payments')
                .where('receiptNo', '==', receiptNo)
                .limit(1)
                .get();

            if (snapshot.empty) {
                this.showEmptyState();
                return;
            }

            const doc = snapshot.docs[0];
            this.currentTransaction = {
                id: doc.id,
                ...doc.data()
            };

            console.log('Transaction data:', this.currentTransaction);
            this.displayTransaction();
            
        } catch (error) {
            console.error('Search error:', error);
            this.showError('Error searching for transaction. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    displayTransaction() {
        if (!this.currentTransaction) return;

        const transaction = this.currentTransaction;
        
        // Clear previous fields
        this.clearTransactionDisplay();
        
        // Create dynamic fields based on actual data
        this.createDynamicFields(transaction);
        
        // Show transaction section
        this.showTransaction();
        
        // Setup auto-save for payment fields
        if (this.setupPaymentFieldsAutoSave) {
            this.setupPaymentFieldsAutoSave();
        }
        
        // Reset supervisor access for new transaction
        if (!this.isSupervisor) {
            this.hasSupervisorAccess = false;
        }
    }

    clearTransactionDisplay() {
        // Clear info grid
        const infoGrid = document.querySelector('.info-grid');
        infoGrid.innerHTML = '';

        // Clear details grid
        const detailsGrid = document.querySelector('.details-grid');
        detailsGrid.innerHTML = '';
    }

    createDynamicFields(transaction) {
        // Create Basic Information Section
        this.createBasicInfoSection(transaction);
        
        // Create Customer & Flight Information Section
        this.createCustomerFlightSection(transaction);
        
        // Create Payment Details Section
        this.createPaymentDetailsSection(transaction);
        
        // Create Additional Information Section (if there are other fields)
        this.createAdditionalInfoSection(transaction);
    }

    createBasicInfoSection(transaction) {
        const infoGrid = document.querySelector('.info-grid');
        
        const basicFields = [
            { key: 'receiptNo', label: 'Receipt Number', type: 'text' },
            { key: 'date', label: 'Date & Time', type: 'datetime', formatter: (val) => this.formatDateTime(val || transaction.createdAt) },
            { key: 'cashier', label: 'Cashier', type: 'text' },
            { key: 'grandTotal', label: 'Total Amount', type: 'currency', formatter: (val) => {
                const currency = transaction.currency || 'USD';
                return `${currency === 'MVR' ? 'MVR' : '$'}${parseFloat(val || 0).toFixed(2)}`;
            }},
            { key: 'shift', label: 'Shift', type: 'text' },
            { key: 'currency', label: 'Currency', type: 'text' }
        ];

        basicFields.forEach(field => {
            if (transaction[field.key] !== undefined) {
                const value = field.formatter ? field.formatter(transaction[field.key]) : transaction[field.key];
                const infoGroup = this.createInfoGroup(field.label, value, field.key === 'grandTotal');
                infoGrid.appendChild(infoGroup);
            }
        });
    }

    createCustomerFlightSection(transaction) {
        const detailsGrid = document.querySelector('.details-grid');
        
        const customerSection = document.createElement('div');
        customerSection.className = 'detail-section';
        customerSection.innerHTML = '<h4>Customer & Flight Information</h4>';

        const customerFields = [
            { key: 'name', label: 'Name', type: 'text', editable: true },
            { key: 'flightNo', label: 'Flight Number', type: 'text', editable: true },
            { key: 'airline', label: 'Airline', type: 'text', editable: false },
            { key: 'seatNo', label: 'Seat Number', type: 'text', editable: false },
            { key: 'adults', label: 'Adults', type: 'number', editable: false },
            { key: 'kids', label: 'Kids', type: 'number', editable: false },
            { key: 'rateType', label: 'Rate Type', type: 'text', editable: false }
        ];

        customerFields.forEach(field => {
            if (transaction[field.key] !== undefined) {
                const editableField = this.createEditableField(field.label, field.key, transaction[field.key], field.type, field.editable);
                customerSection.appendChild(editableField);
            }
        });

        detailsGrid.appendChild(customerSection);
    }

    createPaymentDetailsSection(transaction) {
        const detailsGrid = document.querySelector('.details-grid');
        
        const paymentSection = document.createElement('div');
        paymentSection.className = 'detail-section';
        paymentSection.innerHTML = '<h4>Payment Details</h4>';

        const paymentFields = [
            { key: 'paymentType', label: 'Payment Type', type: 'select', options: ['Visa', 'Master', 'Amex', 'Unionpay', 'Mobile Pay'], editable: true },
            { key: 'approvalCode', label: 'Approval Code', type: 'text', editable: true },
            { key: 'batchNo', label: 'Batch No', type: 'text', editable: true },
            { key: 'paid', label: 'Amount Paid', type: 'number', editable: true },
            { key: 'subtotal', label: 'Subtotal', type: 'currency', editable: false },
            { key: 'gst', label: 'GST', type: 'currency', editable: false },
            { key: 'grandTotal', label: 'Grand Total', type: 'currency', editable: false },
            { key: 'balance', label: 'Balance', type: 'currency', editable: false }
        ];

        paymentFields.forEach(field => {
            if (transaction[field.key] !== undefined || field.editable) {
                let value = transaction[field.key];
                if (field.type === 'currency' && typeof value === 'number') {
                    value = parseFloat(value).toFixed(2);
                }
                const editableField = this.createEditableField(field.label, field.key, value, field.type, field.editable, field.options);
                paymentSection.appendChild(editableField);
            }
        });

        detailsGrid.appendChild(paymentSection);
    }

    createAdditionalInfoSection(transaction) {
        const detailsGrid = document.querySelector('.details-grid');
        
        // Find fields that haven't been displayed yet
        const displayedFields = [
            'receiptNo', 'date', 'cashier', 'grandTotal', 'shift', 'currency',
            'name', 'flightNo', 'airline', 'seatNo', 'adults', 'kids', 'rateType',
            'paymentType', 'approvalCode', 'batchNo', 'paid', 'subtotal', 'gst', 'balance'
        ];

        const additionalFields = Object.keys(transaction).filter(key => 
            !displayedFields.includes(key) && 
            key !== 'id' && 
            key !== 'createdAt' && 
            key !== 'updatedAt' &&
            key !== 'voided' &&
            key !== 'voidedAt' &&
            key !== 'voidedBy' &&
            key !== 'voidReason'
        );

        if (additionalFields.length > 0) {
            const additionalSection = document.createElement('div');
            additionalSection.className = 'detail-section';
            additionalSection.innerHTML = '<h4>Additional Information</h4>';

            additionalFields.forEach(key => {
                const value = transaction[key];
                const label = this.formatFieldName(key);
                const editableField = this.createEditableField(label, key, value, typeof value === 'number' ? 'number' : 'text', false);
                additionalSection.appendChild(editableField);
            });

            detailsGrid.appendChild(additionalSection);
        }
    }

    createInfoGroup(label, value, isAmount = false) {
        const infoGroup = document.createElement('div');
        infoGroup.className = 'info-group';
        
        infoGroup.innerHTML = `
            <label>${label}</label>
            <div class="info-value ${isAmount ? 'amount' : ''}">${value || '-'}</div>
        `;
        
        return infoGroup;
    }

    createEditableField(label, fieldId, value, type = 'text', editable = false, options = []) {
        const editableField = document.createElement('div');
        editableField.className = 'editable-field';
        
        if (editable) {
            editableField.classList.add('payment-field');
        } else {
            editableField.classList.add('supervisor-field');
        }

        let inputHtml = '';
        
        if (type === 'select' && editable) {
            inputHtml = `
                <select id="${fieldId}" class="detail-select" ${editable ? '' : 'disabled'}>
                    ${options.map(option => 
                        `<option value="${option}" ${value === option ? 'selected' : ''}>${option}</option>`
                    ).join('')}
                </select>
            `;
        } else {
            const inputType = type === 'currency' ? 'number' : type;
            const step = type === 'currency' ? '0.01' : '1';
            inputHtml = `
                <input type="${inputType}" id="${fieldId}" class="detail-input" 
                       value="${value || ''}" 
                       ${type === 'number' || type === 'currency' ? `step="${step}"` : ''}
                       ${editable ? '' : 'readonly'}>
            `;
        }

        editableField.innerHTML = `
            <label>${label}</label>
            ${inputHtml}
        `;

        return editableField;
    }

    formatFieldName(fieldName) {
        // Convert camelCase or snake_case to Title Case with spaces
        return fieldName
            .replace(/([A-Z])/g, ' $1')
            .replace(/_/g, ' ')
            .replace(/^./, str => str.toUpperCase())
            .trim();
    }

    async fetchAdditionalData() {
        if (!this.currentTransaction) return;

        const fieldSelector = document.getElementById('fieldSelector');
        const selectedField = fieldSelector?.value;

        if (!selectedField) {
            this.showError('Please select a field to edit');
            return;
        }

        // If not supervisor, require password
        if (!this.isSupervisor && !this.hasSupervisorAccess) {
            this.showPasswordModal();
            return;
        }

        this.showLoading();

        try {
            // Re-fetch the transaction data
            const doc = await this.walkinDb.collection('payments')
                .doc(this.currentTransaction.id)
                .get();

            if (!doc.exists) {
                this.showError('Transaction not found');
                return;
            }

            const freshData = doc.data();
            this.currentTransaction = { ...this.currentTransaction, ...freshData };

            // Update specific fields based on selection
            if (selectedField === 'name' || selectedField === 'all') {
                const nameField = document.getElementById('name');
                if (nameField) {
                    nameField.value = freshData.name || '';
                    this.unlockField('name');
                }
            }

            if (selectedField === 'flightNo' || selectedField === 'all') {
                const flightNoField = document.getElementById('flightNo');
                if (flightNoField) {
                    flightNoField.value = freshData.flightNo || '';
                    this.unlockField('flightNo');
                }
            }

            if (selectedField === 'all') {
                // Update all fields with fresh data
                const paymentTypeField = document.getElementById('paymentType');
                if (paymentTypeField) {
                    paymentTypeField.value = freshData.paymentType === 'Card' ? 'Visa' : freshData.paymentType;
                }
                
                const approvalCodeField = document.getElementById('approvalCode');
                if (approvalCodeField) {
                    approvalCodeField.value = freshData.approvalCode || '';
                }
                
                const batchNoField = document.getElementById('batchNo');
                if (batchNoField) {
                    batchNoField.value = freshData.batchNo || '';
                }
                
                const paidField = document.getElementById('paid');
                if (paidField) {
                    paidField.value = parseFloat(freshData.paid || freshData.grandTotal || 0).toFixed(2);
                }

                // Unlock all customer fields
                this.unlockField('name');
                this.unlockField('flightNo');
            }

            this.showSuccess('Data fetched successfully!');
            if (fieldSelector) {
                fieldSelector.value = '';
            }

        } catch (error) {
            console.error('Fetch error:', error);
            this.showError('Error fetching data. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    unlockField(fieldId) {
        const field = document.getElementById(fieldId);
        if (field) {
            field.readOnly = false;
            // Add visual indicator that field is now editable
            field.parentElement.classList.add('payment-field');
            field.parentElement.classList.remove('supervisor-field');
        }
    }

    updateReceiptBadge() {
        const badge = document.getElementById('receiptBadge');
        if (!badge) return;
        
        if (this.currentTransaction.voided) {
            badge.textContent = 'VOIDED';
            badge.style.background = 'var(--danger)';
        } else if (this.currentTransaction.approvalCode) {
            badge.textContent = 'APPROVED';
            badge.style.background = 'var(--success)';
        } else {
            badge.textContent = 'PENDING';
            badge.style.background = 'var(--warning)';
        }
        badge.style.color = 'white';
    }

    formatDateTime(dateValue) {
        if (!dateValue) return '-';
        
        try {
            const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return '-';
        }
    }

    showPasswordModal() {
        document.getElementById('supervisorPassword').value = '';
        document.getElementById('passwordError').style.display = 'none';
        document.getElementById('passwordModal').style.display = 'flex';
    }

    verifySupervisorPassword() {
        const password = document.getElementById('supervisorPassword').value;
        
        if (password === this.supervisorPassword) {
            this.hasSupervisorAccess = true;
            this.hideAllModals();
            this.showSuccess('Supervisor access granted!');
            // Retry the fetch operation
            setTimeout(() => this.fetchAdditionalData(), 500);
        } else {
            document.getElementById('passwordError').style.display = 'block';
        }
    }

    async saveTransaction() {
        if (!this.currentTransaction) return;

        // Validate before saving
        if (!this.validatePaymentFields()) {
            return;
        }

        try {
            const updates = {
                paymentType: document.getElementById('paymentType')?.value || this.currentTransaction.paymentType,
                approvalCode: document.getElementById('approvalCode')?.value?.trim() || '',
                batchNo: document.getElementById('batchNo')?.value?.trim() || '',
                paid: parseFloat(document.getElementById('paid')?.value) || this.currentTransaction.paid || 0,
                updatedAt: new Date()
            };

            // Only include customer fields if supervisor or has access
            if (this.isSupervisor || this.hasSupervisorAccess) {
                if (document.getElementById('name')) {
                    updates.name = document.getElementById('name').value.trim();
                }
                if (document.getElementById('flightNo')) {
                    updates.flightNo = document.getElementById('flightNo').value.trim();
                }
            }

            await this.walkinDb.collection('payments')
                .doc(this.currentTransaction.id)
                .update(updates);

            // Update local transaction data
            this.currentTransaction = {
                ...this.currentTransaction,
                ...updates
            };

            this.showSuccess('Transaction saved successfully!');
            this.printReceipt();
            this.updateReceiptBadge();
            
        } catch (error) {
            console.error('Save error:', error);
            this.showError('Error saving transaction. Please try again.');
        }
    }

    showVoidModal() {
        if (!this.currentTransaction) return;

        if (this.currentTransaction.voided) {
            this.showError('Transaction is already voided');
            return;
        }

        document.getElementById('voidReason').value = '';
        document.getElementById('voidModal').style.display = 'flex';
    }

    hideAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }

    async voidTransaction() {
        const voidReason = document.getElementById('voidReason').value.trim();
        
        if (!voidReason) {
            this.showError('Please provide a reason for voiding the transaction');
            return;
        }

        try {
            await this.walkinDb.collection('payments')
                .doc(this.currentTransaction.id)
                .update({
                    voided: true,
                    voidedAt: new Date(),
                    voidedBy: this.currentUser.username || 'Unknown',
                    voidReason: voidReason
                });

            // Update local data
            this.currentTransaction.voided = true;
            this.currentTransaction.voidedAt = new Date();
            this.currentTransaction.voidReason = voidReason;

            this.showSuccess('Transaction voided successfully!');
            this.updateReceiptBadge();
            this.hideAllModals();
            
        } catch (error) {
            console.error('Void error:', error);
            this.showError('Error voiding transaction. Please try again.');
        }
    }

    printReceipt() {
        const transaction = this.currentTransaction;
        const receiptDiv = document.getElementById('receipt');
        const currency = transaction.currency || 'USD';
        const currencySymbol = currency === 'MVR' ? 'MVR' : '$';
        const isCashPayment = transaction.paymentType === 'Cash';
        
        const receiptHTML = `
            <div style="text-align: center; font-family: 'Courier New', monospace; padding: 10px;">
                <h3 style="color: var(--primary-gold); margin-bottom: 8px; border-bottom: 2px solid var(--primary-gold); padding-bottom: 8px;">${companyInfo?.name || 'GOLDEN LINE ENTERPRISES'}</h3>
                <p style="font-size: 12px; margin: 4px 0;">${companyInfo?.address || 'Business Address'}</p>
                <p style="font-size: 12px; margin: 4px 0;">Tel: ${companyInfo?.phone || 'Contact Number'}</p>
                <hr style="border: none; border-top: 1px dashed #c8a951; margin: 12px 0;">
                
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0;">
                    <span>Receipt:</span>
                    <span>${transaction.receiptNo}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0;">
                    <span>Date:</span>
                    <span>${this.formatDateTime(transaction.date || transaction.createdAt)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0;">
                    <span>Cashier:</span>
                    <span>${transaction.cashier || 'Cashier'}</span>
                </div>
                
                <hr style="border: none; border-top: 1px dashed #c8a951; margin: 12px 0;">
                
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0;">
                    <span>Name:</span>
                    <span>${document.getElementById('name')?.value || transaction.name || ''}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0;">
                    <span>Flight:</span>
                    <span>${document.getElementById('flightNo')?.value || transaction.flightNo || ''}</span>
                </div>
                ${transaction.airline ? `
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0;">
                    <span>Airline:</span>
                    <span>${transaction.airline}</span>
                </div>
                ` : ''}
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0;">
                    <span>Payment:</span>
                    <span>${document.getElementById('paymentType')?.value || transaction.paymentType || ''}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0;">
                    <span>Approval:</span>
                    <span>${document.getElementById('approvalCode')?.value || ''}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0;">
                    <span>Batch No:</span>
                    <span>${document.getElementById('batchNo')?.value || ''}</span>
                </div>
                
                <hr style="border: none; border-top: 1px dashed #c8a951; margin: 12px 0;">
                
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0;">
                    <span>Subtotal:</span>
                    <span>${currencySymbol}${parseFloat(transaction.subtotal || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0;">
                    <span>Tax:</span>
                    <span>${currencySymbol}${parseFloat(transaction.gst || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin: 8px 0; border-top: 1px solid #000; padding-top: 4px;">
                    <span>Total:</span>
                    <span>${currencySymbol}${parseFloat(transaction.grandTotal || 0).toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0;">
                    <span>Paid:</span>
                    <span>${currencySymbol}${parseFloat(document.getElementById('paid')?.value || transaction.paid || 0).toFixed(2)}</span>
                </div>
                ${isCashPayment ? `
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin: 4px 0;">
                    <span>Balance:</span>
                    <span>${currencySymbol}${(parseFloat(document.getElementById('paid')?.value || transaction.paid || 0) - parseFloat(transaction.grandTotal || 0)).toFixed(2)}</span>
                </div>
                ` : ''}
                
                <hr style="border: none; border-top: 1px dashed #c8a951; margin: 12px 0;">
                <p style="font-size: 12px; font-weight: bold; text-align: center; margin: 16px 0; color: var(--primary-gold);">Thank you for your payment!</p>
            </div>
        `;
        
        receiptDiv.innerHTML = receiptHTML;
        receiptDiv.style.display = 'block';
        window.print();
        receiptDiv.style.display = 'none';
    }

    resetSearch() {
        document.getElementById('receiptSearch').value = '';
        this.currentTransaction = null;
        this.hideTransaction();
        this.hideEmptyState();
        this.focusSearch();
        this.hasSupervisorAccess = false;
    }

    // UI State Management
    showLoading() {
        document.getElementById('loadingState').style.display = 'block';
    }

    hideLoading() {
        document.getElementById('loadingState').style.display = 'none';
    }

    showTransaction() {
        document.getElementById('transactionSection').style.display = 'block';
    }

    hideTransaction() {
        document.getElementById('transactionSection').style.display = 'none';
    }

    showEmptyState() {
        document.getElementById('emptyState').style.display = 'block';
    }

    hideEmptyState() {
        document.getElementById('emptyState').style.display = 'none';
    }

    showError(message) {
        this.showToast(message, 'error');
    }

    showSuccess(message) {
        this.showToast(message, 'success');
    }

    showToast(message, type = 'success') {
        // Remove existing toasts
        const existingToasts = document.querySelectorAll('.toast');
        existingToasts.forEach(toast => toast.remove());

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Show toast
        setTimeout(() => toast.classList.add('show'), 100);

        // Hide toast after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    new PaymentApproval();
});