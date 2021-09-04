require('dotenv').config();
const Settings = require('./models/Settings');

const connect = require('./db');

connect(async () => {
  await Settings.create({
    plans: [{
      name: 'small',
      agentsCount: 0,
      waBots: 0,
      triggerBots: 0,
      webBots: 0,
      price: 0,
    }, {
      name: 'premium',
      agentsCount: 0,
      waBots: 0,
      triggerBots: 0,
      webBots: 0,
      price: 0,
    }, {
      name: 'high traffic',
      agentsCount: 0,
      waBots: 0,
      triggerBots: 0,
      webBots: 0,
      price: 0,
    }, {
      name: 'mega plan',
      agentsCount: 0,
      waBots: 0,
      triggerBots: 0,
      webBots: 0,
      price: 0,
    }],
  });
  console.log('done');
},
() => {
  console.log('Database connection failed!');
});
