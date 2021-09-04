const { Schema, model } = require('mongoose');

const schema = new Schema({
  messageId: {
    type: String,
    required: true,
    unique: true,
  },
  senderId: {
    type: String,
    required: true,
  },
  messageText: {
    type: String,
  },
  messageMedia: [
    {
      type: Object,
    },
  ],
}, { timestamps: true });

module.exports = model('FacebookMessage', schema, 'facebookmessages');
