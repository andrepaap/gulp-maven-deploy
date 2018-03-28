var through = require('through2'),
    gmd = require('maven-deploy'),
    temp = require('temp').track(),
    File = require('vinyl'),
    buildFileOptions = require('./util/buildFileOptions');

module.exports = function install(options) {

    var stream = through.obj(function (file, enc, fileDone) {
        file = new File(file);
        var tempFile = temp.createWriteStream(),
            fileOptions = buildFileOptions(file, options);

        tempFile.on('finish', function() {
            gmd.config(fileOptions);
            gmd.install(tempFile.path, fileDone);
        });

        file.pipe(tempFile);
        this.push(file);
    });

    stream.on('finish', function() {
        temp.cleanup();
    });

    return stream;
};
