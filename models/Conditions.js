const { Schema, model, SchemaTypes } = require('mongoose');

const schema = new Schema({
  type: {
    type: SchemaTypes.String,
    enum: ['greater-than', 'lesser-than', 'equal-to'],
  },
  value: {
    type: SchemaTypes.String,
  },
  goTo: {
    type: SchemaTypes.ObjectId,
    ref: 'nodes',
  },
}, { timestamps: true });

module.exports = model('Condition', schema, 'conditions');
