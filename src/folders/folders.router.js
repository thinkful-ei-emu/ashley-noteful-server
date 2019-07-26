const express = require('express');
const logger = require('../logger');
const xss = require('xss');
const foldersRouter = express.Router();
const bodyParser = express.json();
const FoldersService = require('./folders-service');


const serializeFolder = folder => ({
  id: folder.id,
  name: xss(folder.name),  
});

foldersRouter
  .route('/')
  .get((req, res, next) => {   
    FoldersService.getAllFolders(req.app.get('db')) 
      .then(folders => {        
        return res.json(folders.map(serializeFolder));
      })
      .catch(next);   
  })
  .post(bodyParser, (req, res, next) => {
    const {name} = req.body;    
    if (!name)    {     
      logger.error(`folderName is required`);
      return res.status(400).send({
        error: { message: `'folder name' is required` }
      });
    }     
    const newFolder = {name};
    FoldersService.insertFolder(
      req.app.get('db'),
      newFolder
    ).then(folder => {
      logger.info(`Folder with id ${folder.id} was created`);
      res.status(201).location(`/${folder.id}`).json(serializeFolder(folder));
    }).catch(next);

  });
foldersRouter
  .route('/:folder_id')
  .all((req, res, next) => {
    const { folder_id } = req.params;
    FoldersService.getById(req.app.get('db'), folder_id)    
      .then(folder => {
        if (!folder) {
          logger.error(`Bookmark with id ${folder_id} not found.`);
          return res.status(404).json({
            error: { message: `Bookmark Not Found` }
          });
        }
        
        res.folder = folder;
        next();        
      })
      .catch(next);
  })
  .get((req,res, next) => {
    res.json(serializeFolder(res.folder));
  })
  .delete((req, res, next) => {
    const {folder_id} = req.params;
    FoldersService.deleteFolder(
      req.app.get('db'),
      folder_id
    )
      .then(() => {
        logger.info(`Folder with id ${folder_id} deleted`);
        res.status(204).end();
      })
      .catch(next);

  })
  .patch(bodyParser, (req, res, next) => {
    const {name} = req.body;
    const folderToUpdate = {name};
    
    if (!name) {
      logger.error(`Invalid update without required fields`)
      return res.status(400).json({
        error: {
          message: `Request body must contain name`
        }
      });
    }
    
    FoldersService.updateFolder(
      req.app.get('db'),
      req.params.folder_id,
      folderToUpdate
    )
      .then(() => {
        res.status(204).end();
      })
      .catch(next);
  });
  


      


module.exports = foldersRouter;