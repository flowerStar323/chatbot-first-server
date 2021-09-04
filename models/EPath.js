const mongoose = require('mongoose');

const { Model, Schema } = mongoose;

const schema = new Schema({
  clientId: {
    type: String,
    required: true,
  },
  survey: {
    type: Schema.Types.ObjectId,
    ref: 'surveys',
  },
  currentNode: {
    type: Schema.Types.ObjectId,
    ref: 'nodes',
    default: null,
  },
  answer: {
    type: Schema.Types.ObjectId,
    ref: 'surveys',
  },
  answerText: {
    type: String,
  },
  terminated: {
    type: Boolean,
    default: false,
  },
}, { timestamps: true });

class EPath extends Model {
  constructor(clientId, surveyId) {
    super({ clientId, survey: surveyId });
  }
}

module.exports = mongoose.model(EPath, schema, 'epaths');
