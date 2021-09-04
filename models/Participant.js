const { Schema, model } = require('mongoose');

const schema = new Schema({
  survey: {
    type: Schema.Types.ObjectId,
    ref: 'surveys',
  },
  firstName: {
    type: String,
    required: false,
  },
  lastName: {
    type: String,
    required: false,
  },
  age: {
    type: Number,
    required: false,
  },
  email: {
    type: String,
    required: false,
  },
  phoneNumber: {
    type: String,
    required: false,
  },
  pageId: {
    type: String,
    required: false,
  },
  type: {
    type: String,
    enum: ['whatsapp', 'facebook', 'website', 'instagram'],
  },
  participantId: {
    type: String,
    required: false,
  },
  room: {
    type: String,
    required: false,
  },
  accountId: {
    type: String,
    required: false,
  },
}, { timestamps: true });

module.exports = model('Participant', schema, 'participants');
