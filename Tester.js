require('dotenv').config();
const Survey = require('./models/Survey');
const Utility = require('./utility/utility');
const connect = require('./db');

connect(async () => {
  const survey = await Survey.findOne({ terminated: false, ready: true });
  if (survey) {
    await Utility.runSurvey(survey);
  } else {
    console.log('No runnable survey found!');
    process.exit(0);
  }
},
() => {
  console.log('Database connection failed!');
  process.exit(0);
});
