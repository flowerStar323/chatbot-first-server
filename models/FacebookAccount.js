const { Schema, model } = require('mongoose');

const FacebookPage = require('./FacebookPage');

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
  pages: [{
    type: Schema.Types.ObjectId,
    ref: 'FacebookPage',
  }],
}, { timestamps: true });

schema.post('findOneAndDelete', (doc, next) => {
  doc.pages.forEach((cur) => FacebookPage.findByIdAndDelete(cur, (_err, _deleted) => { }));
  // eslint-disable-next-line no-unused-expressions
  next && next();
});

module.exports = model('FacebookAccount', schema, 'facebookaccounts');
