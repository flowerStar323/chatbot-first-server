// require('dotenv').config();
// const connect = require('./db');
// const { login } = require('./utility/utility');

// connect(async () => {
//   await login();
//   //  process.exit(0);
// },
// () => {
//   console.log('Database connection failed!');
//   process.exit(0);
// });

const st = 'How are you %zeuz% maria? do you get %game% ?';
const reg = new RegExp(/%[a-z]{1,}%/igm);
const res = st.match(reg);

console.log(res);
