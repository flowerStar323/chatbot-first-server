const { Schema, model } = require('mongoose');
const FacebookMessage = require('./FacebookMessage');

const schema = new Schema({
  pageId: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  link: {
    type: String,
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
    ref: 'FacebookMessage',
  }],
}, { timestamps: true });

schema.post('findOneAndDelete', (doc, next) => {
  doc.messages.forEach((cur) => FacebookMessage.findByIdAndDelete(cur, (_err, _deleted) => { }));
  // eslint-disable-next-line no-unused-expressions
  next && next();
});

module.exports = model('FacebookPage', schema, 'facebookpages');
