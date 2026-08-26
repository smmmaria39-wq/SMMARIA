   // ===============================================
   // MARZPAY CARD PAYMENT INTERCEPTION (BOTTOM SHEET)
   // ===============================================
   if (method === 'card') {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnText;
    
    const sheet = document.getElementById('cardPaymentSheet');
    const sheetAmount = document.getElementById('cardSheetAmount');
    const confirmBtn = document.getElementById('confirmCardPayBtn');
    const cancelBtn = document.getElementById('cancelCardPayBtn');
    
    if (sheet && confirmBtn) {
     sheetAmount.textContent = formatCurrency(amount);
     sheet.style.display = 'flex';
     sheet.classList.add('active'); // <--- THIS LINE IS REQUIRED TO MAKE IT VISIBLE
     
     // Handle Cancel
     cancelBtn.onclick = () => {
      sheet.classList.remove('active'); // <--- REMOVE CLASS TO HIDE
      sheet.style.display = 'none';
      confirmBtn.disabled = false;
      confirmBtn.innerText = 'Continue to Secure Checkout';
     };
     
     // Handle Click Outside to Close
     sheet.onclick = (e) => {
      if (e.target === sheet) cancelBtn.click();
     };
     
     // Handle Continue to MarzPay
     confirmBtn.onclick = async () => {
      confirmBtn.disabled = true;
      confirmBtn.innerText = 'Redirecting to secure checkout...';
      
      try {
       // Call backend to get MarzPay redirect_url
       const res = await api.createDeposit({ amount, method: 'card', email: userEmail });
       
       if (res.data && res.data.redirect_url) {
        window.location.href = res.data.redirect_url;
       } else {
        throw new Error('Redirect URL not received from server.');
       }
      } catch (error) {
       showToast(error.message || 'Failed to initiate card payment.', 'error');
       confirmBtn.disabled = false;
       confirmBtn.innerText = 'Continue to Secure Checkout';
      }
     };
    }
    return; // Exit function so MTN/Airtel/manual code doesn't run
   }
