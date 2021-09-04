//  Survey Path for Users
const mongoose = require('mongoose');

const { Model, Schema } = mongoose;

const schema = new Schema({
  participant: {
    type: Schema.Types.ObjectId,
    ref: 'participants',
    required: true,
  },
  survey: {
    type: Schema.Types.ObjectId,
    ref: 'surveys',
  },
  terminated: {
    type: Boolean,
    default: false,
  },
  optinState: {
    type: Number,
    enum: [0, 1, 2],
    default: 0,
  },
}, { timestamps: true });

class Path extends Model {
  constructor(participant, surveyId) {
    super({ participant, survey: surveyId });
  }
}

module.exports = mongoose.model(Path, schema, 'paths');
