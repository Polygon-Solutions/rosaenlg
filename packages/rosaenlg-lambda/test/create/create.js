const assert = require('assert');
const fs = require('fs');
const S3rver = require('s3rver');
const aws = require('aws-sdk');

process.env.IS_TESTING = '1';

const bucketName = 'test-bucket';
const hostname = 'localhost';
const s3port = 4569;
const s3endpoint = `http://${hostname}:${s3port}`;

// config of the lambda BEFORE including it
process.env.S3_BUCKET = bucketName;
process.env.S3_ENDPOINT = s3endpoint;
process.env.S3_ACCESSKEYID = 'S3RVER';
process.env.S3_SECRETACCESSKEY = 'S3RVER';
const create = require('../../dist/create/createFrench');
const render = require('../../dist/render/renderFrench');

describe('create', function() {
  describe('nominal', function() {
    let s3instance;
    const s3client = new aws.S3({
      accessKeyId: 'S3RVER',
      secretAccessKey: 'S3RVER',
      s3ForcePathStyle: true,
      endpoint: s3endpoint,
    });
    const testFolder = 'test-fake-s3-create';

    before(function(done) {
      fs.mkdir(testFolder, () => {
        s3instance = new S3rver({
          port: s3port,
          hostname: hostname,
          silent: false,
          directory: `./${testFolder}`,
          configureBuckets: [
            {
              name: bucketName,
            },
          ],
        }).run(done);
      });
    });

    after(function(done) {
      s3client.deleteObject(
        {
          Bucket: bucketName,
          Key: 'DEFAULT_USER/chanson.json',
        },
        err => {
          if (err) {
            console.log(err);
          }
          s3instance.close(() => {
            fs.rmdir(`${testFolder}/${bucketName}`, () => {
              fs.rmdir(testFolder, done);
            });
          });
        },
      );
    });

    describe('create and render', function() {
      let templateSha1;
      it(`create`, function(done) {
        fs.readFile('./test/templates/chanson.json', 'utf8', (_err, data) => {
          create.handler(
            {
              headers: {
                'X-RapidAPI-Proxy-Secret': 'IS_TESTING',
              },
              body: data,
            },
            {},
            (err, result) => {
              assert(!err);
              assert(result != null);
              //console.log(result);
              assert.equal(result.statusCode, '201');
              const parsed = JSON.parse(result.body);
              assert.equal(parsed.templateId, 'chanson');
              assert(parsed.templateSha1 != null);
              templateSha1 = parsed.templateSha1;
              done();
            },
          );
        });
      });
      it(`has been written on disk`, function(done) {
        s3client.getObject(
          {
            Bucket: bucketName,
            Key: 'DEFAULT_USER/chanson.json',
          },
          (err, data) => {
            const rawTemplateData = data.Body.toString();
            // console.log(rawTemplateData);
            parsedData = JSON.parse(rawTemplateData);
            assert(parsedData.comp != null);
            assert(parsedData.comp.compiledWithVersion != null);
            assert(parsedData.comp.compiledBy != null);
            assert(parsedData.comp.compiledWhen != null);
            done();
          },
        );
      });

      it(`render`, function(done) {
        render.handler(
          {
            headers: {
              'X-RapidAPI-Proxy-Secret': 'IS_TESTING',
            },
            pathParameters: {
              templateId: 'chanson',
              templateSha1: templateSha1,
            },
            body: JSON.stringify({
              language: 'fr_FR',
              chanson: { auteur: 'Édith Piaf', nom: 'Non, je ne regrette rien du tout' },
            }),
          },
          {},
          (err, result) => {
            assert(!err);
            assert(result != null);
            // console.log(result);
            assert.equal(result.statusCode, '200');
            assert(
              JSON.parse(result.body).renderedText.indexOf(
                `<p>Il chantera "Non, je ne regrette rien du tout" d\'Édith Piaf</p>`,
              ) > -1,
            );
            done();
          },
        );
      });
    });
  });
});
