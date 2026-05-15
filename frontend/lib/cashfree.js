export const loadCashfreeSdk = () => {
  return new Promise((resolve, reject) => {
    if (window.Cashfree) {
      resolve(window.Cashfree);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js';
    script.onload = () => resolve(window.Cashfree);
    script.onerror = () => reject(new Error('Failed to load Cashfree SDK'));
    document.head.appendChild(script);
  });
};

export const initiateCashfreePayment = async (paymentSessionId) => {
  const Cashfree = await loadCashfreeSdk();
  const cashfree = Cashfree({
    mode: 'sandbox',
  });

  return new Promise((resolve, reject) => {
    cashfree.checkout({
      paymentSessionId,
      redirectTarget: '_modal',
      returnUrl: window.location.href,
    }).then((result) => {
      if (result.error) {
        reject(new Error(result.error.message || 'Payment failed'));
        return;
      }
      if (result.paymentDetails) {
        const status = result.paymentDetails.paymentMessage;
        if (status === 'Payment finished. Check status.') {
          resolve(result);
        } else {
          reject(new Error('Payment was not successful'));
        }
      } else if (result.redirect) {
        resolve(result);
      } else {
        resolve(result);
      }
    }).catch((err) => {
      reject(err);
    });
  });
};

