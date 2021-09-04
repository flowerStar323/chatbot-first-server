const { Schema, model } = require('mongoose');

const InstagramAccount = require('./InstagramAccount');

const schema = new Schema({
  accountId: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
  },
  name: {
    type: String,
    required: true,
  },
  picture: {
    type: String,
  },
  accessToken: {
    type: String,
    required: true,
  },
  instagramAccounts: [{
    type: Schema.Types.ObjectId,
    ref: 'InstagramAccount',
  }],
}, { timestamps: true });

schema.post('findOneAndDelete', (doc, next) => {
  doc.instagramAccounts
    .forEach((cur) => InstagramAccount.findByIdAndDelete(cur, (_err, _deleted) => { }));
  // eslint-disable-next-line no-unused-expressions
  next && next();
});

module.exports = model('FacebookAccountInstagram', schema, 'facebookaccountinstagrams');
