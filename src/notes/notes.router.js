const express = require('express');
const logger = require('../logger');
const xss = require('xss');
const notesRouter = express.Router();
const bodyParser = express.json();
const NotesService = require('./notes-service');

notesRouter
  .route('/')
  .get((req, res, next) => {   
    NotesService.getAllNotes(req.app.get('db')) 
      .then(notes => {
        return res.json(notes);
      })
      .catch(next);   
  });

module.exports = notesRouter;