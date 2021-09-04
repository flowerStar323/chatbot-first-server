//  Survey Path for Users
const mongoose = require('mongoose');

const { Model, Schema } = mongoose;

const schema = new Schema({
  path: {
    type: Schema.Types.ObjectId,
    ref: 'paths',
  },
  node: {
    type: Schema.Types.ObjectId,
    ref: 'nodes',
    required: true,
  },
  answer: {
    type: Schema.Types.ObjectId,
    ref: 'answers',
  },
  answerText: {
    type: String,
  },
}, { timestamps: true });

class Combination extends Model {
  constructor(pathId, nodeId, answerId = null, answerText = '') {
    super({
      path: pathId, node: nodeId, answer: answerId, answerText,
    });
  }
}

module.exports = mongoose.model(Combination, schema, 'combinations');
