//  Text, Reference to next node
const mongoose = require('mongoose');

const { Schema } = mongoose;

const schema = new Schema({
  text: {
    type: String,
    required: true,
  },
  node: {
    type: Schema.Types.ObjectId,
    ref: 'nodes',
  },
  nextNode: {
    type: Schema.Types.ObjectId,
    ref: 'nodes',
  },
  endActionType: {
    type: Number,
    required: false,
    enum: [0, 1, 2],
  },
  endActionData: {
    type: String,
    required: false,
  },
  emailData: {
    type: String,
    required: false,
  },
  subjectData: {
    type: String,
    required: false,
  },
  contentData: {
    type: String,
    required: false,
  },
  mediaName: {
    type: String,
    required: false,
  },
  mediaUrl: {
    type: String,
    required: false,
  },
  mediaMimeType: {
    type: String,
    required: false,
  },
}, { timestamps: true });

module.exports = mongoose.model('Answer', schema, 'answers');
