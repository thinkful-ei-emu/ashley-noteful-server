const knex = require('knex');
const {makeNotesArray, makeMaliciousNote} = require('./notes-fixtures');

const app = require('../src/app');

describe('Notes Endpoints', () => {
  let db;

  before('make knex instance', () => {
    db = knex({
      client: 'pg',
      connection: process.env.TEST_DB_URL,
    });
    app.set('db', db);
  });

  after('disconnect from db', () => db.destroy());

  before('cleanup', () => db.raw('truncate notes, folders RESTART IDENTITY'));

  afterEach('cleanup', () =>db.raw('truncate notes, folders RESTART IDENTITY'));

  describe('GET /api/notes', () => {
    context(`Given no notes`, () => {
      it(`responds with 200 and an empty list`, () => {
        return supertest(app)
          .get('/api/notes')          
          .expect(200, []);
      });
    });

    context('Given there are notes in the database', () => {
      const testNotes = makeNotesArray();
            
      beforeEach('insert notes', () => {
        return db
          .into('notes')
          .insert(testNotes);
      });

      it('gets the notes from the store', () => {
        return supertest(app)
          .get('/api/notes')          
          .expect(200, testNotes);
      });
    });

    context(`Given an XSS attack note`, () => {
      const { maliciousNote, expectedNote } = makeMaliciousNote();
      
      beforeEach('insert malicious note', () => {
        return db
          .into('notes')
          .insert([maliciousNote]);
      });
     
     

      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/api/notes`)          
          .expect(200)
          .expect(res => {
            expect(res.body[0].name).to.eql(expectedNote.name);
            expect(res.body[0].content).to.eql(expectedNote.content);           
          });
      });
    });
  });

  describe('GET /api/notes/:id', () => {
    context(`Given no notes`, () => {
      it(`responds 404 whe note doesn't exist`, () => {
        return supertest(app)
          .get(`/api/notes/123`)          
          .expect(404, {
            error: { message: `Note Not Found` }
          });
      });
    });

    context('Given there are notes in the database', () => {
      const testNotes = makeNotesArray();

      beforeEach('insert notes', () => {
        return db
          .into('notes')
          .insert(testNotes);
      });

      it('responds with 200 and the specified note', () => {
        const noteId = 2;
        const expectedNote = testNotes[noteId - 1];
        return supertest(app)
          .get(`/api/notes/${noteId}`)          
          .expect(200, expectedNote);
      });
    });

    context(`Given an XSS attack note`, () => {
      const { maliciousNote, expectedNote } = makeMaliciousNote();

      beforeEach('insert malicious note', () => {
        return db
          .into('notes')
          .insert([maliciousNote]);
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/api/notes/${maliciousNote.id}`)          
          .expect(200)
          .expect(res => {
            expect(res.body.name).to.eql(expectedNote.name);
            expect(res.body.content.to.eql(expectedNote.content));          
          });
      });
    });
  });
  describe('DELETE /api/notes/:id', () => {
    context(`Given no notess`, () => {
      it(`responds 404 whe note doesn't exist`, () => {
        return supertest(app)
          .delete(`/api/notes/123`)          
          .expect(404, {
            error: { message: `Note Not Found` }
          });
      });
    });

    context('Given there are notes in the database', () => {
      const testNotes = makeNotesArray();

      beforeEach('insert notes', () => {
        return db
          .into('notes')
          .insert(testNotes);
      });

      it('removes the note by ID from the store', () => {
        const idToRemove = 2;
        const expectedNotes = testNotes.filter(note => note.id !== idToRemove);
        return supertest(app)
          .delete(`/api/notes/${idToRemove}`)         
          .expect(204)
          .then(() =>
            supertest(app)
              .get(`/api/notes`)              
              .expect(expectedNotes)
          );
      });
    });
  });
  describe('POST /api/notes', () => {
    ['name', 'folder_id', 'content'].forEach(field => {
      const newnote = {
        name: 'test-name',
        folder_id: '1',                       
      };

      it(`responds with 400 missing '${field}' if not supplied`, () => {
        delete newnote[field];

        return supertest(app)
          .post(`/api/notes`)
          .send(newnote)          
          .expect(400, {
            error: { message: `'${field}' is required` }
          });
      });
    });    

    it('adds a new note to the store', () => {
      const newnote = {
        name: 'test-name',
        folder_id: '1',
        content: 'test content'
      };
      return supertest(app)
        .post(`/api/notes`)
        .send(newnote)        
        .expect(201)
        .expect(res => {
          expect(res.body.name).to.eql(newnote.name);        
          expect(res.body).to.have.property('id');
          expect(res.headers.location).to.eql(`/api/notes/${res.body.id}`);
        })
        .then(res =>
          supertest(app)
            .get(`/api/notes/${res.body.id}`)            
            .expect(res.body)
        );
    });

    it('removes XSS attack content from response', () => {
      const { maliciousNote, expectedNote } = makeMaliciousNote();
      return supertest(app)
        .post(`/api/notes`)
        .send(maliciousNote)       
        .expect(201)
        .expect(res => {
          expect(res.body.name).to.eql(expectedNote.name);
          
        });
    });
  });
  describe(`PATCH /api/notes/:note_id`, () => {
    context(`Given no notes`, () => {
      it(`responds with 404`, () => {
        const noteId = 123456;
        return supertest(app)
          .patch(`/api/notes/${noteId}`)          
          .expect(404, { error: { message: `Note Not Found` } });
      });
    });
    context('Given there are notes in the database', () => {
      const testNotes = makeNotesArray();

      beforeEach('insert notes', () => {
        return db
          .into('notes')
          .insert(testNotes);
      });

      it('responds with 204 and updates the note', () => {
        const idToUpdate = 2;
        const updateNote = {
          name: 'updated note name',
          folder_id: '1',
          content: 'test content'          
        };
        const expectedArticle = {
          ...testNotes[idToUpdate - 1],
          ...updateNote
        };
        return supertest(app)
          .patch(`/api/notes/${idToUpdate}`)          
          .send(updateNote)
          .expect(204)
          .then(res =>
            supertest(app)
              .get(`/api/notes/${idToUpdate}`)              
              .expect(expectedArticle)
          );
      });

      it(`responds with 400 when no required fields supplied`, () => {
        const idToUpdate = 2;
        return supertest(app)
          .patch(`/api/notes/${idToUpdate}`)          
          .send({ irrelevantField: 'foo' })
          .expect(400, {
            error: {
              message: `Request body must contain either 'name', 'folder_id', or 'content'`
            }
          });
      });

      it(`responds with 204 when updating only a subset of fields`, () => {
        const idToUpdate = 2;
        const updateNote = {
          name: 'updated note name',
        };
        const expectedNote = {
          ...testNotes[idToUpdate - 1],
          ...updateNote
        };

        return supertest(app)
          .patch(`/api/notes/${idToUpdate}`)          
          .send({
            ...updateNote,
            fieldToIgnore: 'should not be in GET response'
          })
          .expect(204)
          .then(res =>
            supertest(app)
              .get(`/api/notes/${idToUpdate}`)             
              .expect(expectedNote)
          );

      });

      it(`responds with 400 invalid 'folder_id' if not a number`, () => {
        const idToUpdate = 2;
        const updateInvalidRating = {
          folder_id: 'invalid',
        };
        return supertest(app)
          .patch(`/api/bookmarks/${idToUpdate}`)          
          .send(updateInvalidRating)
          .expect(400, {
            error: {
              message: `Request body must contain a valid 'folder_id'`
            }
          });
      });

    });

  }); 
  
});


