// index.js
import express from 'express';
import Stripe from 'stripe';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Servimos los archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Inicializa Stripe con tu clave secreta
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2022-11-15',
});

// Creamos la sesión de Checkout
app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],  // solo 'card'
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: 'IQ Challenge Global Test' },
          unit_amount: 100, // 1€ en céntimos
        },
        quantity: 1
      }],
      success_url: `${req.headers.origin}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${req.headers.origin}/?canceled=true`,
    });
    return res.json({ url: session.url });
  } catch (err) {
    console.error("STRIPE ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}`));
