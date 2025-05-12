import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion:"2022-11-15" });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { name, country } = req.body;
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: { name: "IQ Challenge Global" },
          unit_amount: 100
        },
        quantity: 1
      }],
      mode: "payment",
      success_url: `${req.headers.origin}/?success=true`,
      cancel_url:  `${req.headers.origin}/?canceled=true`
    });
    res.json({ url: session.url });
  } catch (err) {
    res.json({ error: err.message });
  }
}
