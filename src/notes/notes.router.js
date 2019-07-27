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
  folder_id: Number(note.folder_id),
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
    const {name, folder_id, content} = req.body;
    const folderNumCheck = Number(folder_id);
    for(const field of ['name', 'folder_id']){
      if(!req.body[field]) {       
        logger.error(`'${field}' is required`);
        return res.status(400).send({
          error: {message: `'${field}' is required`}
        });
      }      
    }

    if(folder_id && (!Number.isInteger(folderNumCheck))){      
      logger.error(`A valid 'folder_id' is required`);
      return res.status(400).send({
        error: {message: `A valid 'folder_id' is required`}
      });
    }      
    
    const newNote = {name, folder_id, content};
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

notesRouter
  .route('/:note_id')
  .all((req, res, next) => {
    const { note_id } = req.params;
    NotesService.getById(req.app.get('db'), note_id)    
      .then(note => {
        if (!note) {
          logger.error(`Note with id ${note_id} not found.`);
          return res.status(404).json({
            error: { message: `Note Not Found` }
          });
        }        
        res.note = note;
        next();        
      })
      .catch(next);
  })
  .get((req,res, next) => {
    res.json(serializeNote(res.note));
  })
  .delete((req, res, next) => {
    const {note_id} = req.params;
    NotesService.deleteNote(
      req.app.get('db'),
      note_id
    )
      .then(() => {
        logger.info(`Folder with id ${note_id} deleted`);
        res.status(204).end();
      })
      .catch(next);

  })
  .patch(bodyParser, (req, res, next) => {
    const {name, folder_id, content} = req.body;
    const noteToUpdate = {name, folder_id, content};  
    const numberOfValues = Object.values(noteToUpdate).filter(Boolean).length;
    const folderNumCheck = Number(folder_id);
    
    if (numberOfValues === 0) {
      logger.error(`Invalid update without required fields`)
      return res.status(400).json({
        error: {
          message: `Request body must contain either 'name', 'folder_id', or 'content'`
        }
      });
    }
    if(folder_id && (!Number.isInteger(folderNumCheck))){
      logger.error(`Invalid update with 'folder_id'`);
      return res.status(400).send({
        error: {message: `Request body must contain a valid 'folder_id'`}
      });
    }     
    
    NotesService.updateNote(
      req.app.get('db'),
      req.params.note_id,
      noteToUpdate
    )
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  });

module.exports = notesRouter;