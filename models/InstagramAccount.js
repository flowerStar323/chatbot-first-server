const { Schema, model } = require('mongoose');
const InstagramMessage = require('./InstagramMessage');

const schema = new Schema({
  pageId: {
    type: String,
    required: true,
    unique: true,
  },
  accountId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  picture: {
    type: String,
  },
  pictureExpireAt: {
    type: String,
  },
  accessToken: {
    type: String,
    required: true,
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true,
  },
  messages: [{
    type: Schema.Types.ObjectId,
    ref: 'InstagramMessage',
  }],
}, { timestamps: true });

schema.post('findOneAndDelete', (doc, next) => {
  doc.messages.forEach((cur) => InstagramMessage.findByIdAndDelete(cur, (_err, _deleted) => { }));
  // eslint-disable-next-line no-unused-expressions
  next && next();
});

module.exports = model('InstagramAccount', schema, 'instagramaccounts');
