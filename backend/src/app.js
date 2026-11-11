const express = require('express');
const documentRoutes = require('./routes/documentRoutes');
const errorController = require('./controllers/errorController');
const config = require('./config');

const app = express();

app.use(express.json());

// Endpoint de verificação de saúde.
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use(documentRoutes);
app.use(errorController);

if (require.main === module) {
  app.listen(config.port, config.host, () => {
    console.log(`DMS backend ouvindo em ${config.host}:${config.port}`);
  });
}

module.exports = app;
