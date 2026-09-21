const express = require('express');
const postRoutes = require('./routes/postRoutes');
const { resetData } = require('./data/postStore');
const controller = require('./controllers/postController');
const http = require('./utils/http');

function createApp() {
  const app = express();
  app.use(express.json());

  // Resource-oriented routes
  app.use('/posts', postRoutes);

  // Safe internal failure route for testing/demo
  app.get('/explode', controller.explode);

  // Catch-all for unmatched routes: standardized structured 404
  app.use((req, res) => {
    return http.sendError(res, 404, { message: 'Not found' });
  });

  // Central error handler: ensures safe 500 responses without leaking internals
  app.use((err, req, res, next) => {
    const status = err.statusCode || 500;
    return http.sendError(res, status, { message: 'Internal server error' });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const port = 3000;
  app.listen(port, () => {
    console.log(`Starter API listening on port ${port}`);
  });
}

module.exports = {
  createApp,
  resetData
};
