import Stripe from "stripe";
// Ensure your price ID is exported for use in other components
export const STRIPE_PRICE_ID = 'price_1T2J3uISoOtTw4gtpBcYR1Cr';

// test price id
//export const STRIPE_PRICE_ID = 'price_1St9DXIfd6AnPI39bhYpzt6P';


/**
 * Starts the payment process by calling our Next.js API route.
 * This replaces the direct Firestore-Stripe library call.
 */
export const startPayment = async (auditId: string) => {
  try {
    console.log("Initiating payment for audit:", auditId);

    // We call our internal API route which will handle the Stripe session creation
    const response = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auditId: auditId,
        priceId: STRIPE_PRICE_ID,
      }),
    });

    const session = await response.json();

    if (session.url) {
      // Redirect the user to Stripe Checkout
      window.location.assign(session.url);
    } else {
      throw new Error("Failed to create checkout session");
    }
  } catch (error) {
    console.error("Stripe Checkout Error:", error);
    alert("There was an issue connecting to Stripe. Please try again.");
  }
};

const stripeSecretKey = process.env.STRIPE_SECRET_KEY!;

export const stripe = new Stripe(stripeSecretKey, {
  // @ts-ignore
  apiVersion: '2025-01-27.acacia',
});