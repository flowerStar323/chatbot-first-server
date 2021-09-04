const mongoose = require('mongoose');

const { model, Schema } = mongoose;

const schema = new Schema({
  participantId: {
    type: Schema.Types.String,
    required: true,
  },
  survey: {
    type: Schema.Types.ObjectId,
    ref: 'surveys',
  },
  content: {
    type: Schema.Types.String,
  },
  file: {
    type: Schema.Types.String,
  },
  fromMe: {
    type: Schema.Types.Boolean,
  },
}, { timestamps: true });

module.exports = model('Message', schema, 'messages');
