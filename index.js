const { createApp } = require('./server/app');
const port = Number(process.env.PORT) || 3001;
createApp().listen(port, '127.0.0.1', () => console.log(`Forma server: http://localhost:${port}`));
