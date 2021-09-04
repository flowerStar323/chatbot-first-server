const router = require('express').Router();
const TeamnameModel = require('../models/TeamnameModel');
// const UserModel = require('../models/TeamnameModel');

router.get('/get_teamnames', (req, res) => {
  TeamnameModel.find().then((sx) => {
    // res.status(200).json(sx);
    console.log(sx);
  })
    .catch((e) => {
      console.log(e);
      res.status(500).json('error');
    });
});

// router.post('/admin/plans', (req, res) => {
//   const {
//     _id,
//     name,
//     agentsCount,
//     waBots,
//     triggerBots,
//     webBots,
//     price,
//   } = req.body;

//   if (!_id || !agentsCount || !waBots || !triggerBots || !webBots) {
//     res.status(400).json({ message: 'missing parameters' });
//   } else {
//     Settings.findOne({}).then((sx) => {
//       for (let i = 0; i < sx.plans.length; i += 1) {
//         if (sx.plans[i]._id.toString() === _id) {
//           sx.plans[i] = {
//             _id,
//             name,
//             agentsCount,
//             waBots,
//             triggerBots,
//             webBots,
//             price,
//           };
//           break;
//         }
//       }

//       sx.save().then(() => {
//         res.status(200).json({ plans: sx.plans });
//       });
//     })
//       .catch((e) => {
//         console.log(e);
//         res.status(500).json({ message: 'An unexpected error occured!' });
//       });
//   }
// });

module.exports = router;
