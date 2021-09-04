//  A set of Nodes, Paths and Participants
const mongoose = require('mongoose');

const { Schema } = mongoose;

const schema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  terminated: {
    type: Boolean,
    default: false,
  },
  ready: {
    type: Boolean,
    default: false,
  },
  user: {
    type: Schema.Types.ObjectId,
    ref: 'users',
  },
  optIn: {
    type: Boolean,
    default: false,
  },
  optinQuestion: {
    type: String,
    default: 'Do you want to participate?\nSend:',
  },
  optinYesText: {
    type: String,
    default: 'To Agree',
  },
  optinNoText: {
    type: String,
    default: 'To disagree',
  },
  type: {
    type: String,
    enum: ['broadcast', 'trigger', 'website', 'facebook'],
    default: 'broadcast',
  },
  scheduled: {
    type: Boolean,
    default: false,
  },
  scheduledTime: {
    type: Date,
    default: null,
  },
  offline: {
    type: Boolean,
    default: false,
  },
  offlineType: {
    type: String,
    enum: ['none', 'hours', 'date'],
    default: 'none',
  },
  offlineFrom: {
    type: String,
  },
  offlineTo: {
    type: String,
  },
  offlineMessage: {
    type: String,
  },
  facebookPageId: {
    type: String,
  },
  accountId: {
    type: String,
  },
}, { timestamps: true });

module.exports = mongoose.model('Survey', schema, 'surveys');
