//  Question, Answers, Successors
const mongoose = require('mongoose');

const { Schema } = mongoose;

const schema = new Schema({
  name: {
    type: String,
    required: true,
  },
  question: {
    type: String,
    required: true,
  },
  questionType: {
    type: Number,
    required: true,
    enum: [0, 1, 2],
  },
  survey: {
    type: Schema.Types.ObjectId,
    ref: 'surveys',
  },
  nextNode: {
    type: Schema.Types.ObjectId,
    ref: 'nodes',
  },
  tag: {
    type: Number,
    required: true,
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
  variableName: {
    type: String,
    required: false,
  },
  endActionType: {
    type: Number,
    required: false,
    enum: [0, 1, 2],
    default: null,
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
  conditions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'conditions',
  }],
  buttons: [
    {
      buttonType: String,
      title: String,
      payload: String,
      url: String,
    },
  ],
}, { timestamps: true });

module.exports = mongoose.model('Node', schema, 'nodes');
