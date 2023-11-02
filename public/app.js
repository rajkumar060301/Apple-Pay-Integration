
async function setupApplepay() {
  const applepay = paypal.Applepay();
    const {
      isEligible,
      countryCode,
      currencyCode,
      merchantCapabilities,
      supportedNetworks,
    } = await  applepay.config();

  if (!isEligible) {
    throw new Error("applepay is not eligible");
  }

  document.getElementById("applepay-container").innerHTML =
    '<apple-pay-button id="btn-appl" buttonstyle="black" type="buy" locale="en">';

  document.getElementById("btn-appl").addEventListener("click", onClick);

  async function onClick() {
    console.log({ merchantCapabilities, currencyCode, supportedNetworks })

    const paymentRequest = {
      countryCode,
      currencyCode: 'USD',
      merchantCapabilities,
      supportedNetworks,
      requiredBillingContactFields: [
        "name",
        "phone",
        "email",
        "postalAddress",
      ],
      requiredShippingContactFields: [
      ],
      total: {
        label: "Demo (Card is not charged)",
        amount: "10.00",
        type: "final",
      },
    };

    // eslint-disable-next-line no-undef
    let session = new ApplePaySession(4, paymentRequest);

    session.onvalidatemerchant = (event) => {
      applepay
        .validateMerchant({
          validationUrl: event.validationURL,
        })
        .then((payload) => {
          session.completeMerchantValidation(payload.merchantSession);
        })
        .catch((err) => {
          console.error(err);
          session.abort();
        });
    };

    session.onpaymentmethodselected = () => {
      session.completePaymentMethodSelection({
        newTotal: paymentRequest.total,
      });
    };

    session.onpaymentauthorized = async (event) => {
      try {
        /* Create Order on the Server Side */
        const orderResponse = await fetch(`/api/orders`,{
          method:'POST',
          headers : {
            'Content-Type': 'application/json'
          }
        })
        if(!orderResponse.ok) {
            throw new Error("error creating order")
        }

        const { id } = await orderResponse.json()
        console.log({ id })
        /**
         * Confirm Payment 
         */
        await applepay.confirmOrder({ orderId: id, token: event.payment.token, billingContact: event.payment.billingContact , shippingContact: event.payment.shippingContact });

        /*
        * Capture order (must currently be made on server)
        */
        await fetch(`/api/orders/${id}/capture`, {
          method: 'POST',
        });

        session.completePayment({
          status: window.ApplePaySession.STATUS_SUCCESS,
        });
      } catch (err) {
        console.error(err);
        session.completePayment({
          status: window.ApplePaySession.STATUS_FAILURE,
        });
      }
    };

    session.oncancel  = () => {
      console.log("Apple Pay Cancelled !!")
    }

    session.begin();
  }
}

if (!window.ApplePaySession) {
  console.error('This device does not support Apple Pay');
}
if (!ApplePaySession.canMakePayments()) {
  console.error('This device is not capable of making Apple Pay payments');
}
const applepay = paypal.Applepay();
applepay.config()
.then(applepayConfig => {
  if (applepayConfig.isEligible) {
    document.getElementById("applepay-container").innerHTML = '<apple-pay-button id="btn-appl" buttonstyle="black" type="buy" locale="en">';
  }
})
.catch(applepayConfigError => {
  console.error('Error while fetching Apple Pay configuration.');
});

document.addEventListener("DOMContentLoaded", () => {

  // eslint-disable-next-line no-undef
  if(ApplePaySession?.supportsVersion(4) && ApplePaySession?.canMakePayments()) {
    setupApplepay().catch(console.error);
  }
});
