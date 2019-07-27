const express = require('express');
const logger = require('../logger');
const xss = require('xss');
const notesRouter = express.Router();
const bodyParser = express.json();
const NotesService = require('./notes-service');

const serializeNote = note => ({
  id: note.id,
  name: xss(note.name),
  modified: note.modified,
  folder_id: note.folder_id,
  content: xss(note.content)
});

notesRouter
  .route('/')
  .get((req, res, next) => {   
    NotesService.getAllNotes(req.app.get('db')) 
      .then(notes => {
        return res.json(notes.map(serializeNote));
      })
      .catch(next);   
  })
  .post(bodyParser, (req, res, next) => {
    for(const field of ['name', 'folder_id']){
      if(!req.body[field]) {
        console.log('req:', req.body);
        console.log('req with field:', req.body[field]);
        logger.error(`'${field}' is required`);
        return res.status(400).send({
          error: {message: `'${field}' is required`}
        });
      }      
    }      
    const {name, folder_id} = req.body;
    const newNote = {name, folder_id};
    NotesService.insertNote(
      req.app.get('db'),
      newNote
    )
      .then(note => {
        logger.info(`Note with id ${note.id} was created`);
        res.status(201).location(`/${note.id}`).json(serializeNote(note));
      })
      .catch(next);
  });

module.exports = notesRouter;