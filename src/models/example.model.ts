import { Schema, model } from 'mongoose';

const ExampleSchema = new Schema({
  name: { type: String, required: true },
  value: { type: Number, required: true }
});

export default model('Example', ExampleSchema);
