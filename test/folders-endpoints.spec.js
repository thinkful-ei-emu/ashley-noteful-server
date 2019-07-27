const knex = require('knex');
const {makeFoldersArray, makeMaliciousFolder} = require('./folders-fixtures');
const app = require('../src/app');

describe('Folders Endpoints', () => {
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

  describe('GET /api/folders', () => {
    context(`Given no folders`, () => {
      it(`responds with 200 and an empty list`, () => {
        return supertest(app)
          .get('/api/folders')          
          .expect(200, []);
      });
    });

    context('Given there are folders in the database', () => {
      const testfolders = makeFoldersArray();

      beforeEach('insert folders', () => {
        return db
          .into('folders')
          .insert(testfolders);
      });

      it('gets the folders from the store', () => {
        return supertest(app)
          .get('/api/folders')          
          .expect(200, testfolders);
      });
    });

    context(`Given an XSS attack folder`, () => {
      const { maliciousFolder, expectedFolder } = makeMaliciousFolder();

      beforeEach('insert malicious folder', () => {
        return db
          .into('folders')
          .insert([maliciousFolder]);
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/api/folders`)          
          .expect(200)
          .expect(res => {
            expect(res.body[0].name).to.eql(expectedFolder.name);           
          });
      });
    });
  });

  describe('GET /api/folders/:id', () => {
    context(`Given no folders`, () => {
      it(`responds 404 whe folder doesn't exist`, () => {
        return supertest(app)
          .get(`/api/folders/123`)          
          .expect(404, {
            error: { message: `Folder Not Found` }
          });
      });
    });

    context('Given there are folders in the database', () => {
      const testfolders = makeFoldersArray();

      beforeEach('insert folders', () => {
        return db
          .into('folders')
          .insert(testfolders);
      });

      it('responds with 200 and the specified folder', () => {
        const folderId = 2;
        const expectedfolder = testfolders[folderId - 1];
        return supertest(app)
          .get(`/api/folders/${folderId}`)          
          .expect(200, expectedfolder);
      });
    });

    context(`Given an XSS attack folder`, () => {
      const { maliciousFolder, expectedFolder } = makeMaliciousFolder();

      beforeEach('insert malicious folder', () => {
        return db
          .into('folders')
          .insert([maliciousFolder]);
      });

      it('removes XSS attack content', () => {
        return supertest(app)
          .get(`/api/folders/${maliciousFolder.id}`)          
          .expect(200)
          .expect(res => {
            expect(res.body.name).to.eql(expectedFolder.name);          
          });
      });
    });
  });
  describe('DELETE /api/folders/:id', () => {
    context(`Given no folderss`, () => {
      it(`responds 404 whe folder doesn't exist`, () => {
        return supertest(app)
          .delete(`/api/folders/123`)          
          .expect(404, {
            error: { message: `Folder Not Found` }
          });
      });
    });

    context('Given there are folders in the database', () => {
      const testFolders = makeFoldersArray();

      beforeEach('insert folders', () => {
        return db
          .into('folders')
          .insert(testFolders);
      });

      it('removes the folder by ID from the store', () => {
        const idToRemove = 2;
        const expectedFolders = testFolders.filter(folder => folder.id !== idToRemove);
        return supertest(app)
          .delete(`/api/folders/${idToRemove}`)         
          .expect(204)
          .then(() =>
            supertest(app)
              .get(`/api/folders`)              
              .expect(expectedFolders)
          );
      });
    });
  });
  describe('POST /api/folders', () => {
    ['name'].forEach(field => {
      const newFolder = {
        name: 'test-name',        
      };

      it(`responds with 400 missing '${field}' if not supplied`, () => {
        delete newFolder[field];

        return supertest(app)
          .post(`/api/folders`)
          .send(newFolder)          
          .expect(400, {
            error: { message: `folder '${field}' is required` }
          });
      });
    });    

    it('adds a new folder to the store', () => {
      const newFolder = {
        name: 'test-name',       
      };
      return supertest(app)
        .post(`/api/folders`)
        .send(newFolder)        
        .expect(201)
        .expect(res => {
          expect(res.body.name).to.eql(newFolder.name);
          expect(res.body.url).to.eql(newFolder.url);
          expect(res.body.description).to.eql(newFolder.description);
          expect(res.body.rating).to.eql(newFolder.rating);
          expect(res.body).to.have.property('id');
          expect(res.headers.location).to.eql(`/api/folders/${res.body.id}`);
        })
        .then(res =>
          supertest(app)
            .get(`/api/folders/${res.body.id}`)            
            .expect(res.body)
        );
    });

    it('removes XSS attack content from response', () => {
      const { maliciousFolder, expectedFolder } = makeMaliciousFolder();
      return supertest(app)
        .post(`/api/folders`)
        .send(maliciousFolder)       
        .expect(201)
        .expect(res => {
          expect(res.body.name).to.eql(expectedFolder.name);
          
        });
    });
  });


});

