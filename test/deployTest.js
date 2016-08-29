var plugin = require('../index.js'),
    expect = require('chai').expect,
    sinon = require('sinon'),
    Vinyl = require('vinyl'),
    mavenDeploy = require('maven-deploy'),
    assign = require('lodash.assign'),
    fs = require('fs');

/* globals describe: false, it: false, beforeEach: false, afterEach: false */

describe('gulp-maven-deploy plugin', function () {

    var fileA, fileB, testConfig;

    beforeEach(function () {
        sinon.stub(mavenDeploy, 'config');
        sinon.stub(mavenDeploy, 'deploy');
        mavenDeploy.deploy.yields(null);

        fileA = new Vinyl({
            cwd: "/home/jdoe/gulp-maven-deploy/",
            base: "/home/jdoe/gulp-maven-deploy/test",
            path: "/home/jdoe/gulp-maven-deploy/test/fileA.txt",
            contents: new Buffer('some content of file A')
        });

        fileB = new Vinyl({
            cwd: "/home/jdoe/gulp-maven-deploy/",
            base: "/home/jdoe/gulp-maven-deploy/test",
            path: "/home/jdoe/gulp-maven-deploy/test/fileB.txt",
            contents: new Buffer('some content of file B')
        });

        testConfig = {
            'groupId': 'com.mygroup',
            'repositories': [{
                'id': 'some-repo-id',
                'url': 'http://some-repo/url'
            }]
        };
    });

    afterEach(function () {
        mavenDeploy.config.restore();
        mavenDeploy.deploy.restore();
    });

    describe('deploy method', function () {

        it('is a function', function () {
            expect(plugin).to.have.property('deploy').that.is.a('function');
        });

        it('passes processed config to maven-deploy module', function (done) {
            var stream = plugin.deploy(testConfig);

            stream.on('finish', function() {
                expect(mavenDeploy.config).to.be.calledWith(sinon.match(testConfig));
                done();
            });

            stream.write(fileA);
            stream.end();
        });

        it('calls deploy function of maven-deploy for each piped file', function (done) {
            var stream = plugin.deploy(testConfig);

            stream.on('finish', function() {
                expect(mavenDeploy.deploy).to.be.calledTwice;
                expect(mavenDeploy.deploy).to.be.calledWith(testConfig.repositories[0].id);
                done();
            });

            stream.write(fileA);
            stream.write(fileB);
            stream.end();
        });

        it('calls deploy with a temporary file which has correct content', function (done) {
            var stream = plugin.deploy(testConfig);

            mavenDeploy.deploy.restore();
            sinon.stub(mavenDeploy, 'deploy', function(repoId, filename, snapshot, callback) {
                fs.readFile(filename, 'utf-8', function(err, content) {
                    expect(content).to.be.equal(fileA.contents.toString());
                    callback(null);
                });
            });

            stream.on('finish', function() {
                done();
            });

            stream.write(fileA);
            stream.end();
        });

        it('uses file extension as package type', function (done) {
            var stream = plugin.deploy(testConfig);
            var expectedOptions = {
                type: 'txt'
            };

            stream.on('finish', function() {
                expect(mavenDeploy.config).to.be.calledWith(sinon.match(expectedOptions));
                done();
            });

            stream.write(fileA);
            stream.end();
        });

        it('ensures to work with old vinyl versions', function (done) {
            var stream = plugin.deploy(testConfig);
            var expectedOptions = {
                artifactId: 'fileA'
            };

            stream.on('finish', function() {
                expect(mavenDeploy.config).to.be.calledWith(sinon.match(expectedOptions));
                done();
            });

            var oldVinyFile = Object.create(fileA, {stem: {}});

            stream.write(oldVinyFile);
            stream.end();
        });

        it('uses file name as artifact id', function (done) {
            var stream = plugin.deploy(testConfig);
            var expectedOptions = {
                artifactId: 'fileA'
            };

            stream.on('finish', function() {
                expect(mavenDeploy.config).to.be.calledWith(sinon.match(expectedOptions));
                done();
            });

            stream.write(fileA);
            stream.end();
        });

        it('uses provided artifactId', function (done) {
            var config = assign({}, testConfig);
            config.artifactId = 'file';
            var stream = plugin.deploy(config);
            var expectedOptions = {
                artifactId: 'file'
            };

            stream.on('finish', function() {
                expect(mavenDeploy.config).to.be.calledWith(sinon.match(expectedOptions));
                done();
            });

            stream.write(fileA);
            stream.end();
        });

        it('removes temporary file when finished', function(done) {
            var stream = plugin.deploy(testConfig);

            stream.on('finish', function() {
                fs.stat(mavenDeploy.deploy.firstCall.args[1], function(error) {
                    expect(error).not.to.be.null;
                    expect(error.code).to.be.equal('ENOENT');
                    done();
                });
            });

            stream.write(fileA);
            stream.end();
        });

        it('passes files to next stream handler', function(done) {
            var stream = plugin.deploy(testConfig),
                spy = sinon.spy();

            stream.on('data', spy);

            stream.on('finish', function() {
                expect(spy).to.be.calledTwice;
                expect(spy).to.be.calledWith(fileA);
                expect(spy).to.be.calledWith(fileB);
                done();
            });

            stream.write(fileA);
            stream.write(fileB);
            stream.end();
        });

        it('triggers error event if deploy fails', function(done) {
            var expectedError = 'An error occured',
                stream = plugin.deploy(testConfig);

            // Call deploy callback with no error
            mavenDeploy.deploy.yields(expectedError);

            stream.on('error', function(error) {
                expect(error).to.be.equal(expectedError);
                done();
            });

            stream.write(fileA);
            stream.end();
        });

        it('calls deploy function of maven-deploy for each configured repository', function(done) {
            mavenDeploy.deploy.yields(null);

            testConfig.repositories.push({
                id: 'another-repo-id',
                url: 'http://another-repo/url'
            });

            var stream = plugin.deploy(testConfig);

            stream.on('finish', function() {
                expect(mavenDeploy.deploy).to.be.calledTwice;
                expect(mavenDeploy.deploy).to.be.calledWith(testConfig.repositories[0].id);
                expect(mavenDeploy.deploy).to.be.calledWith(testConfig.repositories[1].id);
                done();
            });

            stream.write(fileA);
            stream.end();
        });

        it('throws error if repository config is missing', function() {
            expect(function() {
                plugin.deploy({});
            }).to.throw('Missing repositories configuration');
        });

        it('throws error if any configured repository is missing id property', function() {
            expect(function() {
                plugin.deploy({repositories: [{
                    id: 'some-repo',
                    url: 'http://some-repo/url'
                }, {
                    id: 'only-an-id'
                }]});
            }).to.throw('Deploy required "id" and "url".');
        });

        it('throws error if any configured repository is missing url property', function() {
            expect(function() {
                plugin.deploy({repositories: [{
                    id: 'some-repo',
                    url: 'http://some-repo/url'
                },{
                    url: 'http://only/an-url'
                }]});
            }).to.throw('Deploy required "id" and "url".');
        });
    });
});
