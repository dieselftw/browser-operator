import { Request, Response } from 'express';
import ExampleModel from '../models/example.model';

export const getExamples = async (req: Request, res: Response) => {
  try {
    const examples = await ExampleModel.find();
    res.status(200).json(examples);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching examples', error });
  }
};

export const createExample = async (req: Request, res: Response) => {
  try {
    const { name, value } = req.body;

    if (!name || value === undefined) {
      return res.status(400).json({ message: 'Name and value are required' });
    }

    const newExample = new ExampleModel({ name, value });
    await newExample.save();

    res.status(201).json(newExample);
  } catch (error) {
    res.status(500).json({ message: 'Error creating example', error });
  }
};
