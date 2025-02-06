const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const crypto = require('crypto');
const xml2js = require('xml2js');

const app = express();
const port = 3000;

// API ključ i API secret – u produkciji ove podatke držite van koda
const API_KEY = '42G87lDu4UikE0kal8lbJIlPi6GyhPLdIs8VnJTZ';
const API_SECRET = 'CUhLrhpFzLe5KGRPZtx7dcJYmZYNgRTpibJhtWiG';

// Konfigurišemo EJS kao view engine
app.set('view engine', 'ejs');

// Parsiranje podataka iz formi (URL-encoded i JSON)
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

/**
 * Funkcija za generisanje HMAC SHA256 potpisa.
 * Ako payload (objekat) postoji i ima ključeva, koristi se JSON.stringify(payload);
 * inače, koristi se prazan string.
 */
function generateSignature(payload) {
  const payloadStr = payload && Object.keys(payload).length > 0 ? JSON.stringify(payload) : '';
  return crypto.createHmac('sha256', API_SECRET).update(payloadStr).digest('hex');
}

// Početna stranica – meni sa linkovima ka pojedinim funkcionalnostima
app.get('/', (req, res) => {
  res.render('index');
});

// Ruta za dohvat XML tečajeva (float rate)
app.get('/xml-rates', async (req, res) => {
  try {
    const response = await axios.get('https://ff.io/rates/float.xml');
    // Parsiramo XML u JSON
    xml2js.parseString(response.data, { explicitArray: false }, (err, result) => {
      if (err) {
        console.error('Greška pri parsiranju XML-a:', err);
        res.send("Greška pri parsiranju XML-a.");
      } else {
        res.render('xmlRates', { rates: result.rates });
      }
    });
  } catch (error) {
    console.error('Greška pri dohvaćanju XML-a:', error.message);
    res.send("Greška pri dohvaćanju XML tečajeva: " + error.message);
  }
});

// Forma za dobijanje cene (exchange rate)
app.get('/price', (req, res) => {
  res.render('price');
});

// Procesiranje forme za dobijanje cene – poziva se endpoint /api/v2/price
app.post('/price', async (req, res) => {
  const { type, fromCcy, toCcy, amount, direction, ccies, usd, refcode, afftax } = req.body;
  
  // Formiramo payload prema dokumentaciji API-ja
  let payload = {
    type: type,               // npr. "float" ili "fixed"
    fromCcy: fromCcy,         // npr. "BTC"
    toCcy: toCcy,             // npr. "USDTTRC"
    amount: parseFloat(amount),
    direction: direction      // "from" ili "to"
  };

  // Opcioni parametri
  if (ccies) {
    payload.ccies = ccies.toLowerCase() === 'true';
  }
  if (usd) {
    payload.usd = usd.toLowerCase() === 'true';
  }
  if (refcode) {
    payload.refcode = refcode;
  }
  if (afftax) {
    payload.afftax = parseFloat(afftax);
  }

  // Generišemo potpis
  const signature = generateSignature(payload);

  try {
    const response = await axios.post('https://ff.io/api/v2/price', payload, {
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': API_KEY,
        'X-API-SIGN': signature,
        'Content-Type': 'application/json; charset=UTF-8'
      }
    });
    res.render('price', { result: response.data });
  } catch (error) {
    console.error('Greška u /price:', error.response ? error.response.data : error.message);
    res.render('price', { result: error.response ? error.response.data : { msg: error.message } });
  }
});

// Forma za kreiranje order-a (naloga)
app.get('/create-order', (req, res) => {
  res.render('order', { result: null });
});

// Procesiranje forme za kreiranje order-a – poziva se endpoint /api/v2/create
app.post('/create-order', async (req, res) => {
  const { type, fromCcy, toCcy, direction, amount, toAddress, tag, refcode, afftax } = req.body;
  
  let payload = {
    type: type,             // "float" ili "fixed"
    fromCcy: fromCcy,
    toCcy: toCcy,
    direction: direction,   // "from" ili "to"
    amount: parseFloat(amount),
    toAddress: toAddress
  };

  if (tag) {
    payload.tag = tag;
  }
  if (refcode) {
    payload.refcode = refcode;
  }
  if (afftax) {
    payload.afftax = parseFloat(afftax);
  }

  const signature = generateSignature(payload);

  try {
    const response = await axios.post('https://ff.io/api/v2/create', payload, {
      headers: {
        'Accept': 'application/json',
        'X-API-KEY': API_KEY,
        'X-API-SIGN': signature,
        'Content-Type': 'application/json; charset=UTF-8'
      }
    });
    res.render('order', { result: response.data });
  } catch (error) {
    console.error('Greška u /create-order:', error.response ? error.response.data : error.message);
    res.render('order', { result: error.response ? error.response.data : { msg: error.message } });
  }
});

// Pokrećemo server
app.listen(port, () => {
  console.log(`Server pokrenut na adresi http://localhost:${port}`);
});
