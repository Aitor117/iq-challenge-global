// api/create-checkout-session.js
import Cors from 'cors';
import initMiddleware from '../lib/init-middleware.js';
import Stripe from 'stripe';

// 1. Inicializa CORS
const cors = initMiddleware(
  Cors({
    methods: ['POST'],
    origin: '*'  // en producción cambia '*' por tu dominio, p.ej. 'https://iq-challenge-global.vercel.app'
  })
);

// 2. Instancia Stripe con la clave secreta de entorno
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15',
});

export default async function handler(req, res) {
  await cors(req, res);

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { name, country } = JSON.parse(req.body);

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: 'IQ Challenge Global' },
          unit_amount: 100,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.headers.origin}/test?name=${encodeURIComponent(name)}&country=${country}`,
      cancel_url: `${req.headers.origin}/`,
      metadata: { name, country },
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: 'Stripe session creation failed' });
  }
}
