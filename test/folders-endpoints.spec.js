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


});

