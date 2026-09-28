import { Note } from '../models/Note.js';
import { ROLES } from '../models/User.js';
import { notFound } from '../utils/httpError.js';
import { paginateFind } from '../utils/pagination.js';

export async function listMyNotes(req, res) {
  res.json(await paginateFind(Note, { owner: req.user.id }, req.valid.query));
}

export async function createNote(req, res) {
  const note = await Note.create({ ...req.valid.body, owner: req.user.id });
  res.status(201).json(note);
}

export async function getNote(req, res) {
  const filter = { _id: req.valid.params.id };
  if (req.user.role !== ROLES.ADMIN) filter.owner = req.user.id;
  const note = await Note.findOne(filter).lean();
  if (!note) throw notFound('Note');
  res.json(note);
}

export async function updateNote(req, res) {
  const note = await Note.findOneAndUpdate(
    { _id: req.valid.params.id, owner: req.user.id },
    { $set: req.valid.body },
    { new: true, runValidators: true },
  ).lean();
  if (!note) throw notFound('Note');
  res.json(note);
}

export async function deleteNote(req, res) {
  const { deletedCount } = await Note.deleteOne({ _id: req.valid.params.id, owner: req.user.id });
  if (!deletedCount) throw notFound('Note');
  res.status(204).end();
}
